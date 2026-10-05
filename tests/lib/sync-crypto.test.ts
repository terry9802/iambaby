import { describe, expect, it } from 'vitest';
import {
  deriveKey,
  fromBase64Url,
  isValidPin,
  newRoom,
  seal,
  toBase64Url,
  unseal,
} from '@/lib/sync/crypto';

describe('자물쇠', () => {
  it('잠근 걸 같은 핀으로 열면 그대로 나온다', async () => {
    const { roomId, roomSecret } = newRoom();
    const key = await deriveKey('123456', roomSecret, roomId);
    const token = await seal(key, { entries: [{ id: 'a', amount: 42000 }] });
    expect(await unseal(key, token)).toEqual({ entries: [{ id: 'a', amount: 42000 }] });
  });

  it('핀이 틀리면 안 열린다', async () => {
    const { roomId, roomSecret } = newRoom();
    const token = await seal(await deriveKey('123456', roomSecret, roomId), { x: 1 });
    const wrong = await deriveKey('123457', roomSecret, roomId);
    expect(await unseal(wrong, token)).toBeNull();
  });

  it('핀을 알아도 방 열쇠가 없으면 못 연다 — 서버만 털려서는 안 열린다는 뜻', async () => {
    const { roomId, roomSecret } = newRoom();
    const token = await seal(await deriveKey('123456', roomSecret, roomId), { x: 1 });
    const attacker = await deriveKey('123456', newRoom().roomSecret, roomId);
    expect(await unseal(attacker, token)).toBeNull();
  });

  it('잠근 덩어리에 금액이 글자로 안 보인다', async () => {
    const { roomId, roomSecret } = newRoom();
    const key = await deriveKey('123456', roomSecret, roomId);
    const token = await seal(key, { memo: '스타벅스', amount: 42000 });
    expect(token).not.toMatch(/42000|스타벅스/);
  });

  it('같은 걸 두 번 잠그면 다른 덩어리가 나온다 — 같은 내용인지도 안 들킨다', async () => {
    const { roomId, roomSecret } = newRoom();
    const key = await deriveKey('123456', roomSecret, roomId);
    expect(await seal(key, { x: 1 })).not.toBe(await seal(key, { x: 1 }));
  });

  it('덩어리를 한 바이트라도 고치면 안 열린다', async () => {
    const { roomId, roomSecret } = newRoom();
    const key = await deriveKey('123456', roomSecret, roomId);
    const token = await seal(key, { x: 1, memo: '점심' });
    const bytes = fromBase64Url(token)!;
    /*
      바이트를 직접 뒤집는다. 맨 끝 글자를 바꾸는 식으로는 안 된다. base64는 남는
      비트를 버리므로 끝 글자가 달라도 같은 바이트로 풀릴 수 있다. 그러면 자물쇠가
      멀쩡한데도 시험을 통과한 것처럼 보인다.
    */
    for (let i = 0; i < bytes.length; i += 1) {
      const bent = Uint8Array.from(bytes);
      bent[i] ^= 0x01;
      expect(await unseal(key, toBase64Url(bent))).toBeNull();
    }
  });

  it('방마다 번호와 열쇠가 다르다', () => {
    const a = newRoom();
    const b = newRoom();
    expect(a.roomId).not.toBe(b.roomId);
    expect(a.roomSecret).not.toBe(b.roomSecret);
    expect(a.roomId.length).toBeGreaterThanOrEqual(20);
    expect(a.roomSecret.length).toBeGreaterThanOrEqual(40);
  });

  it('핀은 숫자 여섯 자리만 받는다', () => {
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('12345a')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });
});
