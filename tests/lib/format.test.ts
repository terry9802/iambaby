import { describe, expect, it } from 'vitest';
import {
  addMonths,
  diffDays,
  formatKRW,
  formatManwon,
  formatMoneyPair,
  monthsBetween,
  parseDate,
  toISODate,
} from '@/lib/format';

describe('숫자·날짜 표기', () => {
  it('만원 단위로 요약한다', () => {
    expect(formatManwon(25000000)).toBe('2,500만원');
    expect(formatManwon(700000)).toBe('70만원');
    expect(formatManwon(9999)).toBe('9,999원');
    expect(formatManwon(123450000)).toBe('1억 2,345만원');
    expect(formatManwon(100000000)).toBe('1억원');
  });

  it('끝자리가 남으면 정확값이 아님을 드러낸다', () => {
    expect(formatManwon(1234567)).toBe('약 123만원');
  });

  it('정확값과 요약값을 함께 쓴다', () => {
    expect(formatMoneyPair(25000000)).toBe('25,000,000원 (2,500만원)');
    expect(formatKRW(2500000)).toBe('2,500,000원');
  });

  it("'YYYY-MM-DD'를 로컬 자정으로 읽어 하루가 밀리지 않는다", () => {
    const d = parseDate('2026-03-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
    expect(toISODate(d)).toBe('2026-03-01');
  });

  it('존재하지 않는 날짜로 넘어가면 말일로 맞춘다', () => {
    expect(toISODate(addMonths(parseDate('2026-01-31'), 1))).toBe('2026-02-28');
  });

  it('날짜 차이와 월령을 센다', () => {
    expect(diffDays(parseDate('2026-03-01'), parseDate('2026-03-31'))).toBe(30);
    expect(monthsBetween(parseDate('2026-03-01'), parseDate('2026-03-01'))).toBe(0);
    expect(monthsBetween(parseDate('2026-03-01'), parseDate('2027-09-01'))).toBe(18);
    expect(monthsBetween(parseDate('2026-03-15'), parseDate('2026-04-14'))).toBe(0);
  });
});
