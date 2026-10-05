import { fromBase64Url, toBase64Url } from '@/lib/sync/crypto';
import { normalizeId } from './schema';

/**
 * 아이디와 핀 하나로 세 가지를 만든다. 셋은 서로를 되돌릴 수 없다.
 *
 *   계정 번호(accountId)  서버가 어느 칸인지 알아보는 이름. 아이디를 구긴 값이라
 *                        서버 자료만 봐서는 아이디가 무엇인지 알 수 없다.
 *   증표(verifier)        "핀을 안다"를 서버에 보이는 값. 핀 자체는 안 보낸다.
 *   열쇠(key)             가계부를 잠그고 푸는 값. 서버로 절대 안 간다.
 *
 * 핀이 여섯 자리면 경우의 수가 백만뿐이다. 서버 자료를 통째로 들고 간 사람이
 * 가만히 앉아 백만 번 돌려보면 뚫린다. 그래서 세 가지로 받친다.
 *
 *   1. 서버가 시도 횟수를 막는다. 바깥에서 찍어 보는 길은 닫힌다.
 *   2. 열쇠에 '서버 조각'을 섞는다. 이 조각은 로그인에 성공해야 받는다.
 *      자료만 들고 가서는 섞을 조각이 없어 못 푼다.
 *   3. 느리게 만든다. 30만 번을 돌려야 열쇠 하나가 나온다.
 *
 * 그래도 자료와 서버 열쇠를 둘 다 가져간 사람 앞에서는 여섯 자리가 버티지 못한다.
 * 그 말을 개인정보처리방침에 적어 뒀다. 핀을 길게 쓰시면 그만큼 강해진다.
 */

export const KDF_ROUNDS = 300_000;

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('이 브라우저는 암호 기능을 지원하지 않아요.');
  return c.subtle;
}

async function sha256(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new Uint8Array(await subtle().digest('SHA-256', bytes as BufferSource));
}

async function stretch(
  password: string,
  salt: string,
  bits: number,
): Promise<Uint8Array> {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const out = await subtle().deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: KDF_ROUNDS,
      hash: 'SHA-256',
    },
    material,
    bits,
  );
  return new Uint8Array(out);
}

/** 서버가 보는 이름. 아이디를 한 방향으로 구긴 값이라 되돌릴 수 없다. */
export async function accountIdOf(id: string): Promise<string> {
  return toBase64Url((await sha256(`nanaegi.account.v1:${normalizeId(id)}`)).subarray(0, 16));
}

/**
 * "핀을 안다"를 보이는 값.
 *
 * 핀을 그대로 보내지 않는 이유는, 보내는 순간 서버 기록이나 중간 어딘가에
 * 핀이 글자로 남을 수 있어서다. 30만 번 돌린 값만 보낸다.
 */
export async function verifierOf(id: string, pin: string): Promise<string> {
  const who = normalizeId(id);
  return toBase64Url(await stretch(`verify:${who}:${pin}`, `nanaegi.verify.v1:${who}`, 256));
}

/**
 * 가계부를 잠그는 열쇠.
 *
 * 증표와 같은 재료를 쓰지만 소금이 달라서 서로를 되돌릴 수 없다. 증표를 손에
 * 넣어도 열쇠는 안 나온다. 서버 조각(keySalt)까지 섞으므로, 로그인에 성공해
 * 그 조각을 받은 쪽만 열쇠를 만들 수 있다.
 */
export async function keyOf(id: string, pin: string, keySalt: string): Promise<CryptoKey> {
  const who = normalizeId(id);
  const bits = await stretch(`unlock:${who}:${pin}:${keySalt}`, `nanaegi.key.v1:${who}`, 256);
  return subtle().importKey('raw', bits as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** 잠근다. 앞 12바이트가 이번에만 쓰는 번호(IV)다. */
export async function seal(key: CryptoKey, value: unknown): Promise<string> {
  const iv = randomBytes(12);
  const body = new TextEncoder().encode(JSON.stringify(value));
  const packed = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, body as BufferSource),
  );
  const out = new Uint8Array(iv.length + packed.length);
  out.set(iv, 0);
  out.set(packed, iv.length);
  return toBase64Url(out);
}

/** 연다. 열쇠가 다르거나 내용이 손대졌으면 null. */
export async function unseal<T>(key: CryptoKey, token: string): Promise<T | null> {
  const bytes = fromBase64Url(token);
  if (!bytes || bytes.length <= 12) return null;
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: bytes.subarray(0, 12) as BufferSource },
      key,
      bytes.subarray(12) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}
