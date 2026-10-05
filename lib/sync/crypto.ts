/**
 * 올리기 전에 브라우저에서 잠그는 자물쇠.
 *
 * 서버에는 알아볼 수 없는 덩어리만 올라간다. 푸는 열쇠는 서버로 가지 않으므로,
 * 서버가 통째로 털려도 금액이 드러나지 않는다. "저희도 못 봅니다"가 계속 사실이려면
 * 이 파일의 약속이 지켜져야 한다. 여기서 만든 열쇠를 네트워크에 싣지 말 것.
 *
 * 열쇠를 핀 6자리로만 만들면 안 된다. 경우의 수가 100만 개뿐이라, 덩어리를 손에 넣은
 * 사람이 컴퓨터로 전부 돌려보면 금방 열린다. 그래서 핀과 '방 열쇠'를 합쳐서 만든다.
 *
 *   방 번호(roomId)    서버가 아는 것. 어느 칸에 넣을지 가리킨다.
 *   방 열쇠(roomSecret) 서버가 모르는 것. 초대 링크의 # 뒤와 각 기기에만 있다.
 *   핀(pin)            사람이 외우는 6자리. 어디에도 안 보낸다.
 *
 * 이러면 서버 쪽 덩어리만으로는 아무리 돌려봐도 못 연다. 방 열쇠를 모르기 때문이다.
 * 사람은 여전히 6자리만 기억하면 된다.
 */

/** 열쇠를 늘리는 횟수. 높을수록 찍어 맞추기가 느려지고, 처음 한 번 계산이 느려진다. */
export const KDF_ROUNDS = 300_000;

export const PIN_LENGTH = 6;

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error('이 브라우저는 암호 기능을 지원하지 않아요.');
  }
  return c.subtle;
}

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    s += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** 새 방을 연다. 방 번호는 서버로 가고, 방 열쇠는 안 간다. */
export function newRoom(): { roomId: string; roomSecret: string } {
  return { roomId: toBase64Url(randomBytes(16)), roomSecret: toBase64Url(randomBytes(32)) };
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/**
 * 핀과 방 열쇠를 합쳐 자물쇠 열쇠를 만든다.
 *
 * 소금으로 방 번호를 쓴다. 방마다 소금이 달라서, 한 방을 푼 계산이 다른 방에
 * 재활용되지 않는다.
 */
export async function deriveKey(
  pin: string,
  roomSecret: string,
  roomId: string,
): Promise<CryptoKey> {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(`${pin}:${roomSecret}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(`nanaegi.sync.v1:${roomId}`),
      iterations: KDF_ROUNDS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
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

/**
 * 연다. 핀이 틀리면 null이 나온다.
 *
 * AES-GCM은 내용이 손대졌거나 열쇠가 다르면 여는 단계에서 터진다. 그래서 핀이
 * 맞는지 따로 물어볼 필요가 없고, 핀 확인용 값을 서버에 둘 필요도 없다.
 * 그런 값을 두면 그게 바로 찍어 맞추기 과녁이 된다.
 */
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
