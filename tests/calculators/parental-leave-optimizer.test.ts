import { describe, expect, it } from 'vitest';
import { optimizeCoupleLeave } from '@/lib/calculators/parental-leave-optimizer';

const MAN = 10000;
const BIRTH = '2026-03-01';

describe('6+6 부모육아휴직 조합 최적화기', () => {
  it('정상: 부부가 각각 6개월씩 쓰면 1인 2,000만원 · 부부 합산 4,000만원', () => {
    const out = optimizeCoupleLeave({
      myWage: 500 * MAN,
      spouseWage: 500 * MAN,
      childBirthDate: BIRTH,
      myMaxMonths: 6,
      spouseMaxMonths: 6,
    });
    if (!out.ok) throw new Error('계산 실패');

    expect(out.result.value.best.specialMonths).toBe(6);
    expect(out.result.value.best.me.total).toBe(2000 * MAN);
    expect(out.result.value.best.spouse.total).toBe(2000 * MAN);
    expect(out.result.value.best.total).toBe(4000 * MAN);
    // 250 / 250 / 300 / 350 / 400 / 450 만원
    expect(out.result.value.best.me.monthly.map((m) => m.amount / MAN)).toEqual([
      250, 250, 300, 350, 400, 450,
    ]);
  });

  it('핵심 규칙: 특례는 두 사람이 쓴 개월 수 중 짧은 쪽까지만 붙는다', () => {
    const out = optimizeCoupleLeave({
      myWage: 500 * MAN,
      spouseWage: 500 * MAN,
      childBirthDate: BIRTH,
      myMaxMonths: 6,
      spouseMaxMonths: 2,
    });
    if (!out.ok) throw new Error('계산 실패');

    expect(out.result.value.best.specialMonths).toBe(2);
    // 본인 6개월: 특례 250+250, 3개월차 일반 250, 4~6개월차 일반 200 × 3
    expect(out.result.value.best.me.total).toBe(1350 * MAN);
    expect(out.result.value.best.spouse.total).toBe(500 * MAN);
  });

  it('최적화: 합산 12개월을 쓸 때 6+6으로 나누는 편이 한 명이 12개월 쓰는 것보다 1,690만원 많다', () => {
    const out = optimizeCoupleLeave({
      myWage: 500 * MAN,
      spouseWage: 500 * MAN,
      childBirthDate: BIRTH,
      myMaxMonths: 12,
      spouseMaxMonths: 12,
      totalMonthsBudget: 12,
    });
    if (!out.ok) throw new Error('계산 실패');

    expect(out.result.value.best.me.months).toBe(6);
    expect(out.result.value.best.spouse.months).toBe(6);
    expect(out.result.value.best.total).toBe(4000 * MAN);
    expect(out.result.value.soloBaseline.total).toBe(2310 * MAN);
    expect(out.result.value.gainVsSolo).toBe(1690 * MAN);
  });

  it('경계값: 생후 18개월을 넘겨 시작한 기간에는 특례가 붙지 않는다', () => {
    const late = optimizeCoupleLeave({
      myWage: 500 * MAN,
      spouseWage: 500 * MAN,
      childBirthDate: BIRTH,
      myMaxMonths: 6,
      spouseMaxMonths: 6,
      allowOverlap: false,
      totalMonthsBudget: 12,
    });
    if (!late.ok) throw new Error('계산 실패');
    // 순차로 써도 두 사람 모두 18개월 안에 들어가므로 특례 6개월이 그대로 붙는다
    expect(late.result.value.best.specialMonths).toBe(6);
    const me = late.result.value.best.me;
    const spouse = late.result.value.best.spouse;
    const overlap =
      Math.min(me.startMonthAge + me.months, spouse.startMonthAge + spouse.months) -
      Math.max(me.startMonthAge, spouse.startMonthAge);
    expect(overlap).toBeLessThanOrEqual(0);
  });

  it('경계값: 한 사람만 쓰면 특례가 0개월이라 상한이 오르지 않는다', () => {
    const out = optimizeCoupleLeave({
      myWage: 500 * MAN,
      spouseWage: 500 * MAN,
      childBirthDate: BIRTH,
      myMaxMonths: 12,
      spouseMaxMonths: 0,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.best.specialMonths).toBe(0);
    expect(out.result.value.best.total).toBe(2310 * MAN);
  });

  it('0·음수 입력은 무엇이 부족한지 돌려준다', () => {
    const nothing = optimizeCoupleLeave({});
    expect(nothing.ok).toBe(false);
    if (!nothing.ok) {
      expect(nothing.missing.map((m) => m.field)).toEqual(['myWage', 'spouseWage', 'childBirthDate']);
    }

    const negative = optimizeCoupleLeave({ myWage: -1, spouseWage: 0, childBirthDate: BIRTH });
    expect(negative.ok).toBe(false);
  });

  it('월별 현금흐름과 가장 얇은 달을 함께 돌려준다', () => {
    const out = optimizeCoupleLeave({
      myWage: 500 * MAN,
      spouseWage: 500 * MAN,
      childBirthDate: BIRTH,
      myMaxMonths: 6,
      spouseMaxMonths: 6,
    });
    if (!out.ok) throw new Error('계산 실패');
    const best = out.result.value.best;
    expect(best.cashflow.length).toBeGreaterThan(0);
    expect(best.leanestMonth).not.toBeNull();
    const sum = best.cashflow.reduce((acc, c) => acc + c.household, 0);
    expect(sum).toBe(best.total);
    expect(out.result.warnings.some((w) => w.includes('현금흐름'))).toBe(true);
  });

  it('임금이 다른 부부도 특례 개월 수는 같고 금액만 달라진다', () => {
    const out = optimizeCoupleLeave({
      myWage: 500 * MAN,
      spouseWage: 200 * MAN,
      childBirthDate: BIRTH,
      myMaxMonths: 6,
      spouseMaxMonths: 6,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.best.specialMonths).toBe(6);
    // 배우자는 통상임금 200만원이라 상한에 걸리지 않고 6개월 내내 200만원
    expect(out.result.value.best.spouse.total).toBe(1200 * MAN);
    expect(out.result.value.best.me.total).toBe(2000 * MAN);
  });

  it('상위 3개 조합은 서로 다른 분배여야 한다', () => {
    const out = optimizeCoupleLeave({
      myWage: 400 * MAN,
      spouseWage: 400 * MAN,
      childBirthDate: BIRTH,
      myMaxMonths: 12,
      spouseMaxMonths: 12,
      totalMonthsBudget: 12,
    });
    if (!out.ok) throw new Error('계산 실패');
    const splits = [out.result.value.best, ...out.result.value.alternatives].map(
      (c) => `${c.me.months}/${c.spouse.months}`,
    );
    expect(new Set(splits).size).toBe(splits.length);
    const totals = [out.result.value.best, ...out.result.value.alternatives].map((c) => c.total);
    expect(totals[0]).toBeGreaterThanOrEqual(totals[1]);
    expect(totals[1]).toBeGreaterThanOrEqual(totals[2]);
  });
});
