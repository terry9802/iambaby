import { describe, expect, it } from 'vitest';
import {
  decodeHandoff,
  encodeHandoff,
  handoffLink,
  HANDOFF_MAX_CHARS,
  readHandoffHash,
} from '@/lib/ledger/transfer';
import type { Entry } from '@/lib/ledger/schema';

function entry(over: Partial<Entry> = {}): Entry {
  return {
    id: over.id ?? 'a1',
    date: '2026-03-14',
    amount: 32000,
    purse: 'couple',
    method: 'credit',
    holder: 'me',
    category: 'general',
    spend: '식비',
    memo: '점심',
    ...over,
  };
}

describe('기기 간 옮기기', () => {
  it('실어 보낸 줄이 그대로 돌아온다', async () => {
    const rows = [entry(), entry({ id: 'b2', date: '2026-02-01', method: 'check' })];
    const token = await encodeHandoff(rows, null, '2026-03-20T00:00:00.000Z');
    const read = await decodeHandoff(token);
    if ('error' in read) throw new Error(read.error);
    expect(read.entries).toHaveLength(2);
    expect(read.entries.map((e) => e.id).sort()).toEqual(['a1', 'b2']);
    expect(read.entries.find((e) => e.id === 'a1')?.memo).toBe('점심');
    expect(read.entries.find((e) => e.id === 'b2')?.method).toBe('check');
    expect(read.at).toBe('2026-03-20T00:00:00.000Z');
  });

  it('아이디가 그대로 실려서 두 번 가져와도 겹치는 줄로 걸린다', async () => {
    const rows = [entry({ id: 'keep-me' })];
    const read = await decodeHandoff(await encodeHandoff(rows, null, '2026-03-20'));
    if ('error' in read) throw new Error(read.error);
    expect(read.entries[0]?.id).toBe('keep-me');
  });

  it('프로필을 안 실으면 받는 쪽에도 안 온다', async () => {
    const read = await decodeHandoff(await encodeHandoff([entry()], null, '2026-03-20'));
    if ('error' in read) throw new Error(read.error);
    expect(read.profile).toBeNull();
  });

  it('프로필을 실으면 같이 온다', async () => {
    const token = await encodeHandoff([entry()], { income: { annualSalary: 56_780_000 } }, '2026-03-20');
    const read = await decodeHandoff(token);
    if ('error' in read) throw new Error(read.error);
    expect(read.profile?.income?.annualSalary).toBe(56_780_000);
  });

  it('남이 만든 글자는 거절한다', async () => {
    const fake = await encodeHandoff([entry()], null, '2026-03-20');
    // 꾸러미 표시를 지운 다른 JSON
    const bogus =
      'p' +
      Buffer.from(JSON.stringify({ kind: 'something.else', entries: [] }))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    expect(await decodeHandoff(bogus)).toEqual({
      error: '이 사이트에서 만든 옮기기 링크가 아니에요.',
    });
    expect('error' in (await decodeHandoff(fake))).toBe(false);
  });

  it('중간에 잘린 링크는 왜 안 되는지 말해 준다', async () => {
    const token = await encodeHandoff([entry(), entry({ id: 'b2' })], null, '2026-03-20');
    const read = await decodeHandoff(token.slice(0, Math.floor(token.length / 2)));
    expect('error' in read).toBe(true);
  });

  it('빈 글자는 거절한다', async () => {
    expect('error' in (await decodeHandoff(''))).toBe(true);
    expect('error' in (await decodeHandoff('z'))).toBe(true);
  });

  it('압축해서 싣는다 — 백 줄쯤은 링크 한도 안에 들어간다', async () => {
    const rows = Array.from({ length: 120 }, (_, i) =>
      entry({ id: `row-${i}`, memo: '스타벅스 아메리카노 두 잔', amount: 9000 + i }),
    );
    const token = await encodeHandoff(rows, null, '2026-03-20');
    expect(token[0]).toBe('z');
    expect(token.length).toBeLessThan(HANDOFF_MAX_CHARS);
    const read = await decodeHandoff(token);
    if ('error' in read) throw new Error(read.error);
    expect(read.entries).toHaveLength(120);
  });

  it('주소 조각에서 글자를 꺼낸다', () => {
    expect(readHandoffHash('#h=zABC')).toBe('zABC');
    expect(readHandoffHash('h=zABC')).toBe('zABC');
    expect(readHandoffHash('#tab=ledger&h=zABC')).toBe('zABC');
    expect(readHandoffHash('#tab=ledger')).toBeNull();
    expect(readHandoffHash('')).toBeNull();
    expect(readHandoffHash('#h=')).toBeNull();
  });

  it('만든 링크를 다시 읽을 수 있다', async () => {
    const token = await encodeHandoff([entry()], null, '2026-03-20');
    const link = handoffLink('https://iamstillbaby.com', '/tools/ledger', token);
    expect(link.startsWith('https://iamstillbaby.com/tools/ledger#h=')).toBe(true);
    const back = readHandoffHash(link.slice(link.indexOf('#')));
    expect(back).toBe(token);
  });
});
