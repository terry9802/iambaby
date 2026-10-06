import { accountIdOf, keyOf, seal, unseal, verifierOf } from '@/lib/account/crypto';
import { normalizeId } from '@/lib/account/schema';
import { isFail, post, type Fail } from '@/lib/account/transport';
import { sanitizeEntries, sanitizeGraves, type Entry } from '@/lib/ledger/schema';
import { mergeSides, type Side } from '@/lib/ledger/sync-merge';

/**
 * 그룹 가계부.
 *
 * 그룹은 '아이디 + 핀'을 가진 금고 하나다. 내 개인 금고와 똑같이 잠기고 열리므로
 * 서버에 새로 만든 것이 없다. 다른 점은 안에 든 것뿐이다.
 *
 *   개인 금고 — 내가 적은 모든 줄 + 내 프로필
 *   그룹 금고 — 멤버들이 '그룹 지출'로 적은 줄 + 누가 언제 적었는지
 *
 * 내가 그룹 지출로 적은 줄은 두 금고에 다 들어간다. 사장님 말씀대로
 * "그룹 비용으로 추가하면 개인 것에도 적히고 그룹 가계부에도 적힌다".
 *
 * 남이 적은 그룹 줄은 내 개인 금고에 넣지 않는다. 넣으면 연말정산 셈에
 * 남의 카드 사용액이 섞인다. 공제는 카드 명의자 소득에서만 붙기 때문이다.
 * 화면에서는 '그룹'과 '전체'에 같이 보여 준다.
 */

export type Member = {
  /** 멤버의 아이디. 사람이 지은 글자라 그대로 보여 준다. */
  id: string;
  /** 마지막으로 그룹 가계부에 손댄 시각 */
  at: string;
};

export type GroupVault = Side & { members: Member[]; name?: string };

export type GroupAuth = { id: string; pin: string; account: string; keySalt: string };

const EMPTY: GroupVault = { entries: [], graves: [], members: [] };

function sanitizeMembers(input: unknown): Member[] {
  if (!Array.isArray(input)) return [];
  const seen = new Map<string, Member>();
  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const raw = row as Record<string, unknown>;
    if (typeof raw.id !== 'string' || !raw.id) continue;
    const m = { id: raw.id.slice(0, 20), at: typeof raw.at === 'string' ? raw.at : '' };
    const had = seen.get(m.id);
    // 같은 사람이 여럿 적혀 있으면 나중 시각을 남긴다
    if (!had || had.at < m.at) seen.set(m.id, m);
  }
  return [...seen.values()].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 50);
}

async function openBlob(auth: GroupAuth, blob: string | null): Promise<GroupVault | null> {
  if (!blob) return EMPTY;
  const key = await keyOf(auth.id, auth.pin, auth.keySalt);
  const opened = await unseal<unknown>(key, blob);
  if (opened === null) return null;
  const o = (opened ?? {}) as Record<string, unknown>;
  return {
    entries: sanitizeEntries(o.entries),
    graves: sanitizeGraves(o.graves),
    members: sanitizeMembers(o.members),
    ...(typeof o.name === 'string' && o.name ? { name: o.name.slice(0, 30) } : {}),
  };
}

function fingerprint(v: GroupVault): string {
  const rows = v.entries.map((e) => `${e.id}@${e.at ?? ''}`).sort().join(',');
  const tombs = v.graves.map((g) => `${g.id}@${g.at}`).sort().join(',');
  const who = v.members.map((m) => `${m.id}@${m.at}`).sort().join(',');
  return `${rows}|${tombs}|${who}|${v.name ?? ''}`;
}

function mergeGroups(mine: GroupVault, theirs: GroupVault): GroupVault {
  const side = mergeSides(mine, theirs);
  return {
    ...side,
    members: sanitizeMembers([...mine.members, ...theirs.members]),
    // 이름은 먼저 지은 쪽을 둔다. 나중 사람이 들어와 이름을 바꿔 버리면 안 된다.
    ...(theirs.name || mine.name ? { name: theirs.name ?? mine.name } : {}),
  };
}

export type GroupOpened = { auth: GroupAuth; vault: GroupVault };

/** 새 그룹을 연다. */
export async function createGroup(
  id: string,
  pin: string,
  name: string | undefined,
  myId: string,
): Promise<GroupOpened | Fail> {
  const who = normalizeId(id);
  const account = await accountIdOf(`group:${who}`);
  const out = await post({ op: 'signup', account, verifier: await verifierOf(who, pin) });
  if (isFail(out)) return out;
  if (!out.keySalt) return { kind: 'error', message: '그룹을 만들지 못했어요.' };
  const auth: GroupAuth = { id: who, pin, account, keySalt: out.keySalt };
  return {
    auth,
    vault: {
      entries: [],
      graves: [],
      members: [{ id: myId, at: new Date().toISOString() }],
      ...(name ? { name } : {}),
    },
  };
}

/** 이미 있는 그룹에 들어간다. */
export async function joinGroup(id: string, pin: string): Promise<GroupOpened | Fail> {
  const who = normalizeId(id);
  const account = await accountIdOf(`group:${who}`);
  const out = await post({ op: 'open', account, verifier: await verifierOf(who, pin) });
  if (isFail(out)) return out;
  if (!out.keySalt) return { kind: 'error', message: '그룹을 열지 못했어요.' };
  const auth: GroupAuth = { id: who, pin, account, keySalt: out.keySalt };
  const vault = await openBlob(auth, out.blob ?? null);
  if (vault === null) {
    return { kind: 'error', message: '그룹 가계부를 열지 못했어요. 잠시 뒤에 다시 해 주세요.' };
  }
  return { auth, vault };
}

export type GroupSynced = { vault: GroupVault; changed: boolean };

const MAX_RETRY = 4;

/**
 * 그룹 금고를 한 바퀴 맞춘다.
 *
 * @param myGroupRows 내가 '그룹 지출'로 적은 줄. 작성자 표시를 붙여서 올린다.
 * @param myGraves 내가 지운 줄의 묘비. 남이 적은 줄을 내가 지워도 건너가야 한다.
 */
export async function syncGroup(
  auth: GroupAuth,
  myId: string,
  myGroupRows: Entry[],
  myGraves: Side['graves'],
  name?: string,
): Promise<GroupSynced | Fail> {
  const verifier = await verifierOf(auth.id, auth.pin);
  const got = await post({ op: 'open', account: auth.account, verifier });
  if (isFail(got)) return got;

  let version = got.version ?? 0;
  let remote = await openBlob(auth, got.blob ?? null);
  if (remote === null) return { kind: 'error', message: '그룹 가계부를 열지 못했어요.' };

  const key = await keyOf(auth.id, auth.pin, auth.keySalt);
  const stamped = myGroupRows.map((e) => (e.by ? e : { ...e, by: myId }));
  /*
    내 마지막 손길 시각은 내가 적은 줄 중 제일 나중 것으로 삼는다. 화면을 열
    때마다 '지금'으로 찍으면, 아무것도 안 적었는데 상대에게 "업데이트했습니다"가
    간다.
  */
  const myLatest = stamped.reduce((at, e) => ((e.at ?? '') > at ? (e.at ?? '') : at), '');
  const local: GroupVault = {
    entries: stamped,
    graves: myGraves,
    members: myLatest ? [{ id: myId, at: myLatest }] : [],
    ...(name ? { name } : {}),
  };

  for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
    const merged = mergeGroups(local, remote);
    const changed = fingerprint(merged) !== fingerprint(remote);
    if (!changed) return { vault: merged, changed: false };

    const out = await post({
      op: 'save',
      account: auth.account,
      verifier,
      version,
      blob: await seal(key, merged),
    });
    if (isFail(out)) return out;
    if (out.ok) return { vault: merged, changed: true };

    if (out.conflict) {
      version = typeof out.version === 'number' ? out.version : version;
      const now = await openBlob(auth, out.blob ?? null);
      if (now === null) return { kind: 'error', message: '그룹 가계부를 열지 못했어요.' };
      remote = now;
      continue;
    }
    return { kind: 'error', message: out.error ?? '올리지 못했어요.' };
  }
  return { kind: 'error', message: '다른 분과 동시에 적고 계신 것 같아요. 잠시 뒤 다시 맞춥니다.' };
}

/**
 * 나 말고 다른 멤버가 마지막으로 손댄 사람.
 *
 * "○○님이 가계부를 업데이트했습니다"를 띄울지 가리는 데 쓴다. 내가 적은 것으로
 * 나한테 알림이 가면 안 된다.
 */
export function latestOther(members: Member[], myId: string): Member | null {
  const others = members.filter((m) => m.id !== myId && m.at);
  if (others.length === 0) return null;
  return others.reduce((best, m) => (m.at > best.at ? m : best));
}
