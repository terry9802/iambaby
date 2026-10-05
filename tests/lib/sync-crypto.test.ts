import { describe, expect, it } from 'vitest';
import {
  CODE_LENGTH,
  codeOf,
  deriveKey,
  formatCode,
  fromBase64Url,
  isValidCode,
  isValidPin,
  newCode,
  newRoom,
  normalizeCode,
  roomFromCode,
  roomIdFromCode,
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

describe('가계부 번호', () => {
  it('열두 자리이고 헷갈리는 글자가 안 섞인다', () => {
    for (let i = 0; i < 300; i += 1) {
      const code = newCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).not.toMatch(/[ILOU]/);
      expect(code).toMatch(/^[0-9A-Z]+$/);
    }
  });

  it('만들 때마다 다르다', () => {
    const seen = new Set(Array.from({ length: 500 }, () => newCode()));
    expect(seen.size).toBe(500);
  });

  it('소문자·줄표·띄어쓰기를 써도 같은 번호로 본다', () => {
    const code = newCode();
    expect(normalizeCode(formatCode(code).toLowerCase())).toBe(code);
    expect(normalizeCode(` ${formatCode(code)} `)).toBe(code);
    expect(normalizeCode(code.split('').join(' '))).toBe(code);
  });

  it('눈으로 구분 안 되는 글자는 바로잡는다 — 옮겨 적다 틀리는 자리다', () => {
    expect(normalizeCode('IL0O')).toBe('1100');
    expect(normalizeCode('ilou')).toBe('110V');
  });

  it('길이가 안 맞으면 번호가 아니다', () => {
    expect(isValidCode(newCode())).toBe(true);
    expect(isValidCode('ABC')).toBe(false);
    expect(isValidCode('')).toBe(false);
    expect(isValidCode(newCode() + 'A')).toBe(false);
  });

  it('네 글자씩 끊어 보여 준다', () => {
    expect(formatCode('ABCD2345EFGH')).toBe('ABCD-2345-EFGH');
  });

  it('같은 번호는 늘 같은 방으로, 다른 번호는 다른 방으로 간다', async () => {
    const a = newCode();
    const b = newCode();
    expect(await roomIdFromCode(a)).toBe(await roomIdFromCode(a));
    // 적는 모양이 달라도 같은 방이어야 한다
    expect(await roomIdFromCode(formatCode(a).toLowerCase())).toBe(await roomIdFromCode(a));
    expect(await roomIdFromCode(a)).not.toBe(await roomIdFromCode(b));
  });

  it('방 번호로는 가계부 번호를 되돌릴 수 없다 — 서버가 털려도 못 연다', async () => {
    const code = newCode();
    const roomId = await roomIdFromCode(code);
    expect(roomId).not.toContain(code);
    expect(roomId.length).toBeLessThanOrEqual(24);
  });

  it('번호로 만든 방은 번호를 되찾을 수 있고, 링크로 만든 옛 방은 아니다', async () => {
    const code = newCode();
    const byCode = await roomFromCode(code);
    expect(await codeOf(byCode)).toBe(code);

    const old = newRoom();
    expect(await codeOf(old)).toBeNull();
  });

  it('번호와 핀이 둘 다 맞아야 열린다', async () => {
    const code = newCode();
    const room = await roomFromCode(code);
    const token = await seal(await deriveKey('123456', room.roomSecret, room.roomId), { x: 1 });

    expect(await unseal(await deriveKey('123456', room.roomSecret, room.roomId), token)).toEqual({
      x: 1,
    });
    // 핀만 틀려도
    expect(await unseal(await deriveKey('123457', room.roomSecret, room.roomId), token)).toBeNull();
    // 번호만 틀려도
    const other = await roomFromCode(newCode());
    expect(await unseal(await deriveKey('123456', other.roomSecret, room.roomId), token)).toBeNull();
  });
});
