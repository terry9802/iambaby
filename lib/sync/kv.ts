import 'server-only';

/**
 * 동기화 칸을 담아 두는 곳. Upstash Redis의 REST 창구를 쓴다.
 *
 * 패키지를 안 쓰고 fetch로 직접 부른다. 하는 일이 읽기 하나, 쓰기 하나뿐이라
 * 의존성을 늘릴 이유가 없다.
 *
 * 여기에 들어오는 값은 이미 브라우저에서 잠긴 덩어리다. 서버는 그게 무슨 뜻인지
 * 모르고, 알 방법도 없다. 그러니 이 파일에서 덩어리를 들여다보거나 기록(로그)에
 * 남기는 코드를 쓰지 말 것. 남기는 순간 "저희도 못 봅니다"가 거짓이 된다.
 */

const URL_ENV = 'UPSTASH_REDIS_REST_URL';
const TOKEN_ENV = 'UPSTASH_REDIS_REST_TOKEN';

/**
 * 서버에만 있는 열쇠 조각.
 *
 * 계정을 만들 때 쓰는 소금을 이 값으로 한 번 더 버무린다. 데이터베이스를 통째로
 * 들고 가도 이 값이 없으면 핀을 찍어 맞출 수가 없다. 자료가 새는 일과 서버
 * 환경변수가 새는 일은 서로 다른 사고라, 둘을 갈라 두는 값이 있다.
 *
 * 안 넣어 두면 빈 글자로 돈다. 그래도 가계부는 돌아가되, 자료만 새어도 핀을
 * 찍어 볼 수 있는 상태가 된다. 그래서 README에 꼭 넣으시라고 적었다.
 */
export function pepper(): string {
  return process.env.VAULT_PEPPER ?? '';
}

export function kvReady(): boolean {
  return !!process.env[URL_ENV] && !!process.env[TOKEN_ENV];
}

async function call(body: unknown): Promise<unknown> {
  const res = await fetch(process.env[URL_ENV]!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env[TOKEN_ENV]}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`kv ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error('kv error');
  return json.result;
}

const key = (room: string) => `nanaegi:sync:${room}`;

/**
 * 안 쓰는 방은 저절로 비워진다.
 *
 * 쓸 때마다 수명이 다시 찬다. 1년 넘게 아무도 안 올리는 방은 지워지는데,
 * 기록은 각 기기에도 그대로 있으므로 잃는 게 아니다. 안 쓰는 남의 자료를
 * 영영 들고 있지 않는 편이 맞다.
 */
export const ROOM_TTL_SECONDS = 400 * 24 * 60 * 60;

/** 담긴 값은 "판수:덩어리" 꼴이다. 판수를 앞에 붙여 두면 덮어쓰기 충돌을 가릴 수 있다. */
export type Slot = { version: number; blob: string };

function parse(raw: unknown): Slot | null {
  if (typeof raw !== 'string') return null;
  const cut = raw.indexOf(':');
  if (cut < 0) return null;
  const version = Number(raw.slice(0, cut));
  if (!Number.isInteger(version) || version < 0) return null;
  return { version, blob: raw.slice(cut + 1) };
}

export async function readRoom(room: string): Promise<Slot | null> {
  return parse(await call(['GET', key(room)]));
}

/*
  ── 계정 ──────────────────────────────────────────────────

  계정 칸에는 세 가지만 둔다. 증표를 구긴 값, 열쇠 조각, 만든 날.
  아이디도 핀도 가계부 내용도 없다. 아이디는 이미 구겨진 채로 칸 이름이 되고,
  핀은 애초에 서버로 오지 않는다.
*/

const acctKey = (account: string) => `nanaegi:acct:${account}`;
const vaultKey = (account: string) => `nanaegi:vault:${account}`;

export type Account = { auth: string; keySalt: string; createdAt: string };

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const out = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...out].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 증표를 그대로 두지 않는다. 서버 조각을 섞어 한 번 더 구겨서 둔다. */
export function sealVerifier(verifier: string): Promise<string> {
  return sha256Hex(`nanaegi.auth.v1:${verifier}:${pepper()}`);
}

export async function readAccount(account: string): Promise<Account | null> {
  const raw = await call(['GET', acctKey(account)]);
  if (typeof raw !== 'string') return null;
  try {
    const p = JSON.parse(raw) as Partial<Account>;
    if (typeof p.auth !== 'string' || typeof p.keySalt !== 'string') return null;
    return { auth: p.auth, keySalt: p.keySalt, createdAt: p.createdAt ?? '' };
  } catch {
    return null;
  }
}

/**
 * 계정을 만든다. 이미 있으면 안 만든다.
 *
 * 'SET ... NX'로 한 번에 처리한다. 읽어 보고 없으면 쓰는 식으로 하면, 두 기기가
 * 동시에 가입을 눌렀을 때 나중 것이 먼저 것을 덮어써서 먼저 만든 쪽이 못 들어가게 된다.
 */
export async function createAccount(account: string, auth: string, keySalt: string) {
  const value: Account = { auth, keySalt, createdAt: new Date().toISOString() };
  const res = await call(['SET', acctKey(account), JSON.stringify(value), 'NX']);
  return res === 'OK';
}

export async function dropAccount(account: string): Promise<void> {
  await call(['DEL', acctKey(account)]);
  await call(['DEL', vaultKey(account)]);
}

/**
 * 틀린 핀을 몇 번이나 넣었는지.
 *
 * 바깥에서 핀을 찍어 보는 길을 닫는 자물쇠다. 성공하면 지운다. 여기서 막지
 * 않으면 여섯 자리는 몇 시간이면 뚫린다.
 */
export async function failedTries(account: string): Promise<number> {
  const n = await call(['GET', `nanaegi:fail:${account}`]);
  return typeof n === 'string' ? Number(n) || 0 : 0;
}

export async function noteFailure(account: string): Promise<number> {
  const key = `nanaegi:fail:${account}`;
  const n = Number(await call(['INCR', key]));
  await call(['EXPIRE', key, '900']);
  return n;
}

export async function clearFailures(account: string): Promise<void> {
  await call(['DEL', `nanaegi:fail:${account}`]);
}

/** 방을 통째로 지운다. 연결을 끊는 것과 달리 서버에 맡겨 둔 덩어리까지 없앤다. */
export async function dropRoom(room: string): Promise<void> {
  await call(['DEL', key(room)]);
}

/*
  먼저 읽은 판수가 아직 그대로일 때만 쓴다.

  둘이 거의 동시에 올리면 늦게 도착한 쪽이 먼저 올린 줄을 지워 버릴 수 있다.
  그래서 "내가 본 판수가 그대로면 써라"를 Redis 안에서 한 번에 처리한다.
  읽고 나서 쓰기까지 사이에 아무도 못 끼어든다. 어긋나면 지금 값을 돌려주고,
  브라우저가 그걸 다시 합쳐서 올린다.
*/
const CAS = `
local cur = redis.call('GET', KEYS[1])
if cur == false then
  if ARGV[1] ~= '0' then return {0, ''} end
  redis.call('SET', KEYS[1], '1:' .. ARGV[2], 'EX', ARGV[3])
  return {1, ''}
end
local seen = string.match(cur, '^(%d+):')
if seen ~= ARGV[1] then return {0, cur} end
redis.call('SET', KEYS[1], (tonumber(seen) + 1) .. ':' .. ARGV[2], 'EX', ARGV[3])
return {1, ''}
`;

export type WriteResult =
  | { ok: true; version: number }
  | { ok: false; current: Slot | null };

export async function writeRoom(
  room: string,
  expectedVersion: number,
  blob: string,
): Promise<WriteResult> {
  return casWrite(key(room), expectedVersion, blob);
}

async function casWrite(
  at: string,
  expectedVersion: number,
  blob: string,
): Promise<WriteResult> {
  const out = (await call([
    'EVAL',
    CAS,
    '1',
    at,
    String(expectedVersion),
    blob,
    String(ROOM_TTL_SECONDS),
  ])) as [number, string];
  if (Number(out?.[0]) === 1) return { ok: true, version: expectedVersion + 1 };
  return { ok: false, current: parse(out?.[1]) };
}

export async function readVault(account: string): Promise<Slot | null> {
  return parse(await call(['GET', vaultKey(account)]));
}

export function writeVault(account: string, expectedVersion: number, blob: string) {
  return casWrite(vaultKey(account), expectedVersion, blob);
}

/**
 * 너무 자주 두드리는 것을 막는다.
 *
 * 방 번호를 알아낸 사람이 끝없이 찍어 보는 걸 늦추고, 한 사람이 서버를 다
 * 쓰는 것도 막는다. 1분 동안 허용치를 넘으면 거절한다.
 */
export async function tooMany(room: string, limit: number): Promise<boolean> {
  const bucket = `nanaegi:rate:${room}:${Math.floor(Date.now() / 60000)}`;
  const n = Number(await call(['INCR', bucket]));
  if (n === 1) await call(['EXPIRE', bucket, '120']);
  return n > limit;
}
