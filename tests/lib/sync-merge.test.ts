import { describe, expect, it } from 'vitest';
import { buryIds, mergeSides, type Side } from '@/lib/ledger/sync-merge';
import type { Entry } from '@/lib/ledger/schema';

function e(over: Partial<Entry> & { id: string }): Entry {
  return {
    date: '2026-03-14',
    amount: 10000,
    purse: 'personal',
    method: 'credit',
    holder: 'me',
    category: 'general',
    ...over,
  };
}

const side = (entries: Entry[], graves: Side['graves'] = []): Side => ({ entries, graves });

describe('기기끼리 맞추기', () => {
  it('서로 다른 줄은 둘 다 남는다', () => {
    const out = mergeSides(side([e({ id: 'a' })]), side([e({ id: 'b' })]));
    expect(out.entries.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('같은 줄을 양쪽에서 고쳤으면 나중에 고친 쪽이 이긴다', () => {
    const old = e({ id: 'a', purse: 'personal', at: '2026-03-01T00:00:00Z' });
    const neu = e({ id: 'a', purse: 'group', at: '2026-03-02T00:00:00Z' });
    expect(mergeSides(side([old]), side([neu])).entries[0]?.purse).toBe('group');
    // 순서를 바꿔도 같은 답이어야 한다
    expect(mergeSides(side([neu]), side([old])).entries[0]?.purse).toBe('group');
  });

  it('시각이 없는 옛 줄은 시각이 적힌 줄에 양보한다', () => {
    const old = e({ id: 'a', amount: 1000 });
    const neu = e({ id: 'a', amount: 2000, at: '2026-03-02T00:00:00Z' });
    expect(mergeSides(side([old]), side([neu])).entries[0]?.amount).toBe(2000);
    expect(mergeSides(side([neu]), side([old])).entries[0]?.amount).toBe(2000);
  });

  it('한쪽에서 지운 줄은 다른 쪽에도 안 되살아난다', () => {
    const row = e({ id: 'a', at: '2026-03-01T00:00:00Z' });
    const phone = side([], [{ id: 'a', at: '2026-03-05T00:00:00Z' }]);
    const pc = side([row]);
    expect(mergeSides(pc, phone).entries).toHaveLength(0);
    expect(mergeSides(phone, pc).entries).toHaveLength(0);
  });

  it('지운 뒤에 다시 적은 줄은 살아난다', () => {
    const again = e({ id: 'a', at: '2026-03-09T00:00:00Z' });
    const phone = side([], [{ id: 'a', at: '2026-03-05T00:00:00Z' }]);
    const out = mergeSides(side([again]), phone);
    expect(out.entries.map((x) => x.id)).toEqual(['a']);
    // 살아난 줄의 묘비는 버린다. 안 그러면 세 번째 기기가 또 지운다.
    expect(out.graves.find((g) => g.id === 'a')).toBeUndefined();
  });

  it('두 번 합쳐도 한 번 합친 것과 같다', () => {
    const pc = side([e({ id: 'a', at: '2026-03-01T00:00:00Z' }), e({ id: 'b' })]);
    const phone = side([e({ id: 'b' }), e({ id: 'c' })], [{ id: 'a', at: '2026-03-04T00:00:00Z' }]);
    const once = mergeSides(pc, phone);
    const twice = mergeSides(once, phone);
    expect(twice.entries.map((x) => x.id)).toEqual(once.entries.map((x) => x.id));
    expect(twice.entries.map((x) => x.id).sort()).toEqual(['b', 'c']);
  });

  it('세 기기가 어느 순서로 만나든 같은 자리로 모인다', () => {
    const a = side([e({ id: '1', amount: 100, at: '2026-03-01T00:00:00Z' })]);
    const b = side([e({ id: '1', amount: 200, at: '2026-03-03T00:00:00Z' }), e({ id: '2' })]);
    const c = side([e({ id: '3' })], [{ id: '2', at: '2026-03-02T00:00:00Z' }]);

    const left = mergeSides(mergeSides(a, b), c);
    const right = mergeSides(a, mergeSides(b, c));
    const shape = (s: typeof left) =>
      s.entries.map((x) => `${x.id}:${x.amount}`).sort().join(',');
    expect(shape(left)).toBe(shape(right));
    expect(shape(left)).toBe('1:200,3:10000');
  });

  it('묘비는 아이디와 시각만 들고 금액은 안 들고 간다', () => {
    const graves = buryIds([], ['a'], '2026-03-05T00:00:00Z');
    expect(graves).toEqual([{ id: 'a', at: '2026-03-05T00:00:00Z' }]);
    expect(JSON.stringify(graves)).not.toMatch(/amount|memo/);
  });

  it('묘비가 끝없이 쌓이지 않는다', () => {
    const many = Array.from({ length: 1500 }, (_, i) => ({
      id: `g${i}`,
      at: `2026-03-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    expect(mergeSides(side([], many), side([])).graves.length).toBeLessThanOrEqual(1000);
  });
});
