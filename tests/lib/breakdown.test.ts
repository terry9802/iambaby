import { describe, expect, it } from 'vitest';
import { breakdown, MAX_SLICES } from '@/lib/ledger/breakdown';
import type { Entry } from '@/lib/ledger/schema';
import type { SpendCategory } from '@/lib/ledger/categories';

function e(spend: SpendCategory | undefined, amount: number, i = 0): Entry {
  return {
    id: `${spend}-${amount}-${i}`,
    date: '2026-10-01',
    amount,
    purse: 'personal',
    method: 'credit',
    holder: 'me',
    category: 'general',
    ...(spend ? { spend } : {}),
  };
}

describe('무엇에 얼마 썼나', () => {
  it('카테고리별로 더하고 큰 것부터 놓는다', () => {
    const out = breakdown([e('식비', 1000), e('교통', 3000), e('식비', 500)]);
    expect(out.map((s) => s.label)).toEqual(['교통', '식비']);
    expect(out[0]?.amount).toBe(3000);
    expect(out[1]?.amount).toBe(1500);
  });

  it('몫을 더하면 1이 된다', () => {
    const out = breakdown([e('식비', 1000), e('교통', 3000)]);
    expect(out.reduce((n, s) => n + s.share, 0)).toBeCloseTo(1);
  });

  it('카테고리를 안 고른 줄은 기타로 센다', () => {
    expect(breakdown([e(undefined, 5000)])[0]?.label).toBe('기타');
  });

  it(`${MAX_SLICES}조각을 넘으면 작은 것들을 기타로 묶는다`, () => {
    const rows = [
      e('식비', 10000), e('교통', 9000), e('쇼핑', 8000), e('여행', 7000),
      e('구독', 6000), e('운동', 500), e('경조비', 400), e('꾸밈비', 300),
    ];
    const out = breakdown(rows);
    expect(out).toHaveLength(MAX_SLICES);
    const rest = out.find((s) => s.label === '기타');
    expect(rest?.amount).toBe(1200);
    expect(rest?.count).toBe(3);
  });

  it('원래 기타가 있으면 거기에 합친다 — 기타가 둘이면 안 된다', () => {
    const rows = [
      e('식비', 10000), e('교통', 9000), e('쇼핑', 8000), e('여행', 7000),
      e('기타', 6000), e('운동', 500), e('경조비', 400),
    ];
    const out = breakdown(rows);
    expect(out.filter((s) => s.label === '기타')).toHaveLength(1);
    expect(out.find((s) => s.label === '기타')?.amount).toBe(6900);
  });

  it('딱 맞으면 묶지 않는다', () => {
    const rows = [
      e('식비', 6), e('교통', 5), e('쇼핑', 4), e('여행', 3), e('구독', 2), e('운동', 1),
    ];
    expect(breakdown(rows)).toHaveLength(6);
    expect(breakdown(rows).map((s) => s.label)).toContain('운동');
  });

  it('빈 가계부는 빈 줄', () => {
    expect(breakdown([])).toEqual([]);
  });

  it('묶은 뒤에도 몫 합이 1이다', () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      e(['식비', '교통', '쇼핑', '여행', '구독', '운동', '경조비'][i % 7] as SpendCategory, (i + 1) * 100, i),
    );
    const out = breakdown(rows);
    expect(out.reduce((n, s) => n + s.share, 0)).toBeCloseTo(1);
    expect(out.length).toBeLessThanOrEqual(MAX_SLICES);
  });
});
