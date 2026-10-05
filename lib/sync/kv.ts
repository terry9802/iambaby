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
  const out = (await call([
    'EVAL',
    CAS,
    '1',
    key(room),
    String(expectedVersion),
    blob,
    String(ROOM_TTL_SECONDS),
  ])) as [number, string];
  if (Number(out?.[0]) === 1) return { ok: true, version: expectedVersion + 1 };
  return { ok: false, current: parse(out?.[1]) };
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
