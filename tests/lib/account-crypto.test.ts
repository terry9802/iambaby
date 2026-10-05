import { describe, expect, it } from 'vitest';
import { accountIdOf, keyOf, seal, unseal, verifierOf } from '@/lib/account/crypto';

const SALT = 'c2VydmVyLXNhbHQtMzItYnl0ZXMtZXhhbXBsZQ';

describe('계정 자물쇠', () => {
  it('아이디 대소문자·공백이 달라도 같은 계정이다', async () => {
    expect(await accountIdOf('  Terry9802 ')).toBe(await accountIdOf('terry9802'));
  });

  it('계정 번호에 아이디가 글자로 안 남는다', async () => {
    const who = await accountIdOf('terry9802');
    expect(who).not.toContain('terry');
    expect(who).not.toContain('9802');
  });

  it('아이디가 다르면 다른 계정', async () => {
    expect(await accountIdOf('terry9802')).not.toBe(await accountIdOf('terry9803'));
  });

  it('증표는 핀이 같아야 같다', async () => {
    expect(await verifierOf('me', '481526')).toBe(await verifierOf('ME', '481526'));
    expect(await verifierOf('me', '481526')).not.toBe(await verifierOf('me', '481527'));
    expect(await verifierOf('me', '481526')).not.toBe(await verifierOf('you', '481526'));
  });

  it('증표에서 열쇠가 안 나온다 — 서버가 증표를 들고 있어도 못 푼다', async () => {
    const verifier = await verifierOf('me', '481526');
    const key = await keyOf('me', '481526', SALT);
    const token = await seal(key, { 금액: 42000 });
    // 증표를 열쇠인 것처럼 써 봐도 안 열린다
    const fake = await keyOf('me', verifier, SALT);
    expect(await unseal(fake, token)).toBeNull();
  });

  it('서버 조각이 없으면 핀을 알아도 못 연다 — 자료만 훔쳐서는 안 열린다', async () => {
    const token = await seal(await keyOf('me', '481526', SALT), { 금액: 42000 });
    const without = await keyOf('me', '481526', 'ZGlmZmVyZW50LXNhbHQ');
    expect(await unseal(without, token)).toBeNull();
  });

  it('아이디·핀·조각이 다 맞으면 열린다', async () => {
    const token = await seal(await keyOf('me', '481526', SALT), { 금액: 42000, 메모: '카페' });
    expect(await unseal(await keyOf('me', '481526', SALT), token)).toEqual({
      금액: 42000,
      메모: '카페',
    });
  });

  it('핀이 틀리면 안 열린다', async () => {
    const token = await seal(await keyOf('me', '481526', SALT), { x: 1 });
    expect(await unseal(await keyOf('me', '481527', SALT), token)).toBeNull();
  });

  it('잠근 덩어리에 금액이 글자로 안 보인다', async () => {
    const token = await seal(await keyOf('me', '481526', SALT), { memo: '스타벅스', amount: 42000 });
    expect(token).not.toMatch(/42000|스타벅스/);
  });

  it('같은 걸 두 번 잠그면 다른 덩어리가 나온다', async () => {
    const key = await keyOf('me', '481526', SALT);
    expect(await seal(key, { x: 1 })).not.toBe(await seal(key, { x: 1 }));
  });
});
