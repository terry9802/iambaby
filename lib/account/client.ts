import { mergeSides, type Side } from '@/lib/ledger/sync-merge';
import { sanitizeEntries, sanitizeGraves } from '@/lib/ledger/schema';
import { sanitizeProfile, type Profile } from '@/lib/profile/schema';
import { accountIdOf, keyOf, seal, unseal, verifierOf } from './crypto';
import { laterProfile, sameProfile, type Stamped } from './profile-merge';
import { normalizeId } from './schema';
import { isFail, post, type Fail } from './transport';

export type { Fail } from './transport';
export { sayFail } from './transport';

/**
 * 브라우저가 서버와 주고받는 일.
 *
 * 올라가는 건 잠근 덩어리뿐이고, 핀은 이 파일을 거쳐 나가지 않는다.
 * 증표만 나간다.
 */

export type Auth = { id: string; pin: string; account: string; keySalt: string };

/** 가입. 이미 있는 아이디면 taken. */
export async function signUp(id: string, pin: string): Promise<Auth | Fail> {
  const who = normalizeId(id);
  const account = await accountIdOf(who);
  const out = await post({ op: 'signup', account, verifier: await verifierOf(who, pin) });
  if (isFail(out)) return out;
  if (!out.keySalt) return { kind: 'error', message: '가입하지 못했어요.' };
  return { id: who, pin, account, keySalt: out.keySalt };
}

/**
 * 서버에 올라가는 꾸러미.
 *
 * 가계부와 프로필을 한 덩어리에 같이 싣는다. 사장님이 "프로필도 어느 기기에서든
 * 같아야지"라고 하셨고, 맞는 말이다. 따로 두면 또 "저건 왜 안 따라와요"가 된다.
 */
export type Vault = Side & { profile?: Profile; profileAt?: string | null };

export type Opened = { auth: Auth; vault: Vault; version: number };

/** 로그인하고 가계부를 받아 온다. */
export async function logIn(id: string, pin: string): Promise<Opened | Fail> {
  const who = normalizeId(id);
  const account = await accountIdOf(who);
  const out = await post({ op: 'open', account, verifier: await verifierOf(who, pin) });
  if (isFail(out)) return out;
  if (!out.keySalt) return { kind: 'error', message: '열지 못했어요.' };

  const auth: Auth = { id: who, pin, account, keySalt: out.keySalt };
  const vault = await openBlob(auth, out.blob ?? null);
  if (vault === null) {
    /*
      증표는 맞았는데 덩어리가 안 열린다. 서버 조각이 바뀌었거나 저장된 내용이
      상한 경우다. 조용히 빈 가계부를 띄우면 "또 날아갔다"가 되므로 말을 해 준다.
    */
    return { kind: 'error', message: '저장된 가계부를 열지 못했어요. 잠시 뒤에 다시 해 주세요.' };
  }
  return { auth, vault, version: out.version ?? 0 };
}

const EMPTY: Vault = { entries: [], graves: [], profile: {}, profileAt: null };

async function openBlob(auth: Auth, blob: string | null): Promise<Vault | null> {
  if (!blob) return EMPTY;
  const key = await keyOf(auth.id, auth.pin, auth.keySalt);
  const opened = await unseal<unknown>(key, blob);
  if (opened === null) return null;
  const o = (opened ?? {}) as {
    entries?: unknown;
    graves?: unknown;
    profile?: unknown;
    profileAt?: unknown;
  };
  return {
    entries: sanitizeEntries(o.entries),
    graves: sanitizeGraves(o.graves),
    profile: o.profile && typeof o.profile === 'object' ? sanitizeProfile(o.profile) : {},
    profileAt: typeof o.profileAt === 'string' ? o.profileAt : null,
  };
}

/** 올릴 거리가 있는지 보는 지문. 프로필까지 봐야 프로필만 고쳤을 때도 올라간다. */
function fingerprint(v: Vault): string {
  const rows = v.entries.map((e) => `${e.id}@${e.at ?? ''}`).sort().join(',');
  const tombs = v.graves.map((g) => `${g.id}@${g.at}`).sort().join(',');
  return `${rows}|${tombs}|${v.profileAt ?? ''}|${JSON.stringify(sanitizeProfile(v.profile ?? {}))}`;
}

/** 가계부는 줄끼리 합치고, 프로필은 나중에 고친 쪽을 통째로 쓴다. */
function mergeVaults(mine: Vault, theirs: Vault): Vault {
  const side = mergeSides(mine, theirs);
  const picked: Stamped = laterProfile(
    { profile: mine.profile ?? {}, at: mine.profileAt ?? null },
    { profile: theirs.profile ?? {}, at: theirs.profileAt ?? null },
  );
  return { ...side, profile: picked.profile, profileAt: picked.at };
}

export function profileChanged(before: Vault, after: Vault): boolean {
  return (
    !sameProfile(before.profile ?? {}, after.profile ?? {}) ||
    (before.profileAt ?? null) !== (after.profileAt ?? null)
  );
}

export type Synced = { vault: Vault; changed: boolean };

/** 맞서 올리기를 몇 번까지 다시 해볼지. 두 기기가 동시에 올릴 때만 쓰인다. */
const MAX_RETRY = 4;

/**
 * 한 바퀴 맞춘다. 받아서 합치고, 달라졌으면 올린다.
 *
 * 그냥 덮으면 그 사이 다른 기기가 적은 줄이 사라진다. 합치기는 순서를 타지
 * 않으므로 둘이 아무 때나 올려도 결국 같은 자리로 모인다.
 */
export async function syncOnce(auth: Auth, local: Vault): Promise<Synced | Fail> {
  const verifier = await verifierOf(auth.id, auth.pin);
  const got = await post({ op: 'open', account: auth.account, verifier });
  if (isFail(got)) return got;

  let version = got.version ?? 0;
  let remote = await openBlob(auth, got.blob ?? null);
  if (remote === null) return { kind: 'error', message: '저장된 가계부를 열지 못했어요.' };

  const key = await keyOf(auth.id, auth.pin, auth.keySalt);

  for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
    const merged = mergeVaults(local, remote);
    const changed = fingerprint(merged) !== fingerprint(local);
    if (fingerprint(merged) === fingerprint(remote)) return { vault: merged, changed };

    const out = await post({
      op: 'save',
      account: auth.account,
      verifier,
      version,
      blob: await seal(key, merged),
    });
    if (isFail(out)) return out;
    if (out.ok) return { vault: merged, changed };

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
