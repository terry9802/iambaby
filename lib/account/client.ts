import { mergeSides, type Side } from '@/lib/ledger/sync-merge';
import { sanitizeEntries, sanitizeGraves } from '@/lib/ledger/schema';
import { accountIdOf, keyOf, seal, unseal, verifierOf } from './crypto';
import { normalizeId } from './schema';

/**
 * 브라우저가 서버와 주고받는 일.
 *
 * 올라가는 건 잠근 덩어리뿐이고, 핀은 이 파일을 거쳐 나가지 않는다.
 * 증표만 나간다.
 */

export type Auth = { id: string; pin: string; account: string; keySalt: string };

export type Fail =
  | { kind: 'wrong' }
  | { kind: 'taken' }
  | { kind: 'locked'; message: string }
  | { kind: 'off' }
  | { kind: 'error'; message: string };

type Reply = {
  ok?: boolean;
  error?: string;
  keySalt?: string;
  version?: number;
  blob?: string | null;
  conflict?: boolean;
  taken?: boolean;
  wrong?: boolean;
  locked?: boolean;
};

async function post(body: Record<string, unknown>): Promise<Reply | Fail> {
  let res: Response;
  try {
    res = await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { kind: 'error', message: '지금은 연결이 안 돼요.' };
  }
  let json: Reply = {};
  try {
    json = (await res.json()) as Reply;
  } catch {
    // 아래에서 상태 코드로 가른다
  }
  if (res.status === 503) return { kind: 'off' };
  if (res.ok) return json;
  if (json.locked) return { kind: 'locked', message: json.error ?? '잠시 잠겼어요.' };
  if (json.taken) return { kind: 'taken' };
  if (json.wrong) return { kind: 'wrong' };
  if (res.status === 409) return json; // 덮어쓰기 충돌은 실패가 아니다
  return { kind: 'error', message: json.error ?? '지금은 연결이 안 돼요.' };
}

function isFail(x: Reply | Fail): x is Fail {
  return 'kind' in x;
}

/** 가입. 이미 있는 아이디면 taken. */
export async function signUp(id: string, pin: string): Promise<Auth | Fail> {
  const who = normalizeId(id);
  const account = await accountIdOf(who);
  const out = await post({ op: 'signup', account, verifier: await verifierOf(who, pin) });
  if (isFail(out)) return out;
  if (!out.keySalt) return { kind: 'error', message: '가입하지 못했어요.' };
  return { id: who, pin, account, keySalt: out.keySalt };
}

export type Opened = { auth: Auth; side: Side; version: number };

/** 로그인하고 가계부를 받아 온다. */
export async function logIn(id: string, pin: string): Promise<Opened | Fail> {
  const who = normalizeId(id);
  const account = await accountIdOf(who);
  const out = await post({ op: 'open', account, verifier: await verifierOf(who, pin) });
  if (isFail(out)) return out;
  if (!out.keySalt) return { kind: 'error', message: '열지 못했어요.' };

  const auth: Auth = { id: who, pin, account, keySalt: out.keySalt };
  const side = await openBlob(auth, out.blob ?? null);
  if (side === null) {
    /*
      증표는 맞았는데 덩어리가 안 열린다. 서버 조각이 바뀌었거나 저장된 내용이
      상한 경우다. 조용히 빈 가계부를 띄우면 "또 날아갔다"가 되므로 말을 해 준다.
    */
    return { kind: 'error', message: '저장된 가계부를 열지 못했어요. 잠시 뒤에 다시 해 주세요.' };
  }
  return { auth, side, version: out.version ?? 0 };
}

const EMPTY: Side = { entries: [], graves: [] };

async function openBlob(auth: Auth, blob: string | null): Promise<Side | null> {
  if (!blob) return EMPTY;
  const key = await keyOf(auth.id, auth.pin, auth.keySalt);
  const opened = await unseal<unknown>(key, blob);
  if (opened === null) return null;
  const o = (opened ?? {}) as { entries?: unknown; graves?: unknown };
  return { entries: sanitizeEntries(o.entries), graves: sanitizeGraves(o.graves) };
}

/** 올릴 거리가 있는지 보는 지문. */
function fingerprint(s: Side): string {
  const rows = s.entries.map((e) => `${e.id}@${e.at ?? ''}`).sort().join(',');
  const tombs = s.graves.map((g) => `${g.id}@${g.at}`).sort().join(',');
  return `${rows}|${tombs}`;
}

export type Synced = { side: Side; changed: boolean };

/** 맞서 올리기를 몇 번까지 다시 해볼지. 두 기기가 동시에 올릴 때만 쓰인다. */
const MAX_RETRY = 4;

/**
 * 한 바퀴 맞춘다. 받아서 합치고, 달라졌으면 올린다.
 *
 * 그냥 덮으면 그 사이 다른 기기가 적은 줄이 사라진다. 합치기는 순서를 타지
 * 않으므로 둘이 아무 때나 올려도 결국 같은 자리로 모인다.
 */
export async function syncOnce(auth: Auth, local: Side): Promise<Synced | Fail> {
  const verifier = await verifierOf(auth.id, auth.pin);
  const got = await post({ op: 'open', account: auth.account, verifier });
  if (isFail(got)) return got;

  let version = got.version ?? 0;
  let remote = await openBlob(auth, got.blob ?? null);
  if (remote === null) return { kind: 'error', message: '저장된 가계부를 열지 못했어요.' };

  const key = await keyOf(auth.id, auth.pin, auth.keySalt);

  for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
    const merged = mergeSides(local, remote);
    const changed = fingerprint(merged) !== fingerprint(local);
    if (fingerprint(merged) === fingerprint(remote)) return { side: merged, changed };

    const out = await post({
      op: 'save',
      account: auth.account,
      verifier,
      version,
      blob: await seal(key, merged),
    });
    if (isFail(out)) return out;
    if (out.ok) return { side: merged, changed };

    if (out.conflict) {
      version = typeof out.version === 'number' ? out.version : version;
      const now = await openBlob(auth, out.blob ?? null);
      if (now === null) return { kind: 'error', message: '저장된 가계부를 열지 못했어요.' };
      remote = now;
      continue;
    }
    return { kind: 'error', message: out.error ?? '올리지 못했어요.' };
  }
  return { kind: 'error', message: '다른 기기와 동시에 적고 계신 것 같아요. 잠시 뒤 다시 맞춥니다.' };
}

/** 계정과 저장된 가계부를 서버에서 지운다. 기기에 적힌 기록은 그대로 남는다. */
export async function dropAccount(auth: Auth): Promise<boolean> {
  const out = await post({
    op: 'drop',
    account: auth.account,
    verifier: await verifierOf(auth.id, auth.pin),
  });
  return !isFail(out) && out.ok === true;
}
