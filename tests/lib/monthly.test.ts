import { describe, expect, it } from 'vitest';
import {
  averagePerActiveMonth,
  monthBuckets,
  monthSeries,
  nextMonth,
  totalsOf,
} from '@/lib/ledger/monthly';
import type { Entry } from '@/lib/ledger/schema';

function e(date: string, amount: number, purse: Entry['purse'] = 'personal'): Entry {
  return {
    id: `${date}-${amount}`,
    date,
    amount,
    purse,
    method: 'credit',
    holder: 'me',
    category: 'general',
  };
}

describe('달마다 얼마 썼나', () => {
  it('지갑별로 나눠 센다', () => {
    const rows = [e('2026-09-01', 10000, 'couple'), e('2026-09-02', 5000, 'personal')];
    expect(totalsOf(rows)).toEqual({ all: 15000, personal: 5000, couple: 10000, count: 2 });
  });

  it('달별로 묶고 최근 달이 먼저 온다', () => {
    const rows = [e('2026-07-05', 1000), e('2026-09-01', 3000), e('2026-08-02', 2000)];
    expect(monthBuckets(rows).map((b) => b.month)).toEqual(['2026-09', '2026-08', '2026-07']);
    expect(monthBuckets(rows).map((b) => b.all)).toEqual([3000, 2000, 1000]);
  });

  it('한 해뿐이면 이름에 연도를 안 붙인다', () => {
    expect(monthBuckets([e('2026-09-01', 1000)])[0]?.label).toBe('9월');
  });

  it('해가 걸치면 이름에 연도를 붙인다 — 9월이 두 개면 구분이 안 된다', () => {
    const rows = [e('2026-09-01', 1000), e('2025-09-01', 2000)];
    expect(monthBuckets(rows).map((b) => b.label)).toEqual(['26년 9월', '25년 9월']);
  });

  it('빈 달도 0으로 채워서 이어 둔다', () => {
    const rows = [e('2026-03-01', 1000), e('2026-06-01', 2000)];
    const s = monthSeries(rows, '2026-06-15');
    expect(s.map((b) => b.month)).toEqual(['2026-03', '2026-04', '2026-05', '2026-06']);
    expect(s.map((b) => b.all)).toEqual([1000, 0, 0, 2000]);
  });

  it('기록이 지난달에 끊겨도 이번 달 자리를 비워 보여 준다', () => {
    const s = monthSeries([e('2026-08-01', 1000)], '2026-10-04');
    expect(s.map((b) => b.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(s.at(-1)?.all).toBe(0);
  });

  it('해를 넘어가도 달이 이어진다', () => {
    const s = monthSeries([e('2025-11-01', 1000), e('2026-01-05', 2000)], '2026-01-20');
    expect(s.map((b) => b.month)).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('너무 길면 최근 것만 그린다', () => {
    const s = monthSeries([e('2020-01-01', 1000), e('2026-10-01', 2000)], '2026-10-04', 12);
    expect(s).toHaveLength(12);
    expect(s.at(-1)?.month).toBe('2026-10');
    expect(s[0]?.month).toBe('2025-11');
  });

  it('앞으로 적어 둔 줄이 있으면 거기까지 그린다', () => {
    const s = monthSeries([e('2026-10-01', 1000), e('2026-12-25', 5000)], '2026-10-04');
    expect(s.at(-1)?.month).toBe('2026-12');
  });

  it('기록이 없으면 빈 줄', () => {
    expect(monthSeries([], '2026-10-04')).toEqual([]);
    expect(monthBuckets([])).toEqual([]);
  });

  it('평균은 돈 쓴 달로만 나눈다', () => {
    // 3월 100만, 6월 200만 — 쓴 달은 두 달이므로 150만이지 (4·5월 섞은) 75만이 아니다
    const rows = [e('2026-03-01', 1_000_000), e('2026-06-01', 2_000_000)];
    expect(averagePerActiveMonth(rows)).toBe(1_500_000);
  });

  it('달 넘기기가 연말에서도 맞다', () => {
    expect(nextMonth('2026-12')).toBe('2027-01');
    expect(nextMonth('2026-01')).toBe('2026-02');
    expect(nextMonth('2026-09')).toBe('2026-10');
  });
});
