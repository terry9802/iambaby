import { describe, expect, it } from 'vitest';
import { calcSeverancePay } from '@/lib/calculators/severance-pay';

const MAN = 10000;

describe('퇴직금 계산기', () => {
  it('정상: 딱 1년 근무하고 월 300만원이면 1일 평균임금의 30일치', () => {
    const out = calcSeverancePay({
      joinDate: '2025-01-01',
      leaveDate: '2026-01-01',
      monthlyWage: 300 * MAN,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.servedDays).toBe(365);
    expect(out.result.value.threeMonthDays).toBe(92); // 10·11·12월 = 31+30+31
    expect(out.result.value.dailyAverageWage).toBe(97826); // 900만 ÷ 92일
    expect(out.result.value.severance).toBe(2934783);
  });

  it('재직 기간에 비례해 늘어난다', () => {
    const twoYears = calcSeverancePay({
      joinDate: '2024-01-01',
      leaveDate: '2026-01-01',
      monthlyWage: 300 * MAN,
    });
    const oneYear = calcSeverancePay({
      joinDate: '2025-01-01',
      leaveDate: '2026-01-01',
      monthlyWage: 300 * MAN,
    });
    if (!twoYears.ok || !oneYear.ok) throw new Error('계산 실패');
    const ratio = twoYears.result.value.severance / oneYear.result.value.severance;
    expect(ratio).toBeGreaterThan(1.99);
    expect(ratio).toBeLessThan(2.01);
  });

  it('하한: 1년을 못 채우면 대상이 아니고 1년이 되는 날을 알려준다', () => {
    const out = calcSeverancePay({
      joinDate: '2025-06-01',
      leaveDate: '2026-01-01',
      monthlyWage: 300 * MAN,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.eligible).toBe(false);
    expect(out.result.value.severance).toBe(0);
    expect(out.result.warnings[0]).toContain('2026-06-01');
  });

  it('상여금과 연차수당은 1년치의 3개월분만 더한다', () => {
    const withBonus = calcSeverancePay({
      joinDate: '2025-01-01',
      leaveDate: '2026-01-01',
      monthlyWage: 300 * MAN,
      annualBonus: 600 * MAN,
      annualLeaveAllowance: 120 * MAN,
    });
    if (!withBonus.ok) throw new Error('계산 실패');
    // 900만 + 600만×3/12 + 120만×3/12 = 900만 + 150만 + 30만
    expect(withBonus.result.value.threeMonthTotal).toBe(1080 * MAN);
  });

  it('통상임금이 평균임금보다 높으면 통상임금으로 계산한다', () => {
    const out = calcSeverancePay({
      joinDate: '2025-01-01',
      leaveDate: '2026-01-01',
      monthlyWage: 300 * MAN,
      ordinaryMonthlyWage: 400 * MAN,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.usedOrdinary).toBe(true);
    expect(out.result.value.dailyOrdinaryWage).toBe(153110); // 400만 ÷ 209시간 × 8시간
    expect(out.result.value.appliedDailyWage).toBe(153110);
  });

  it('통상임금이 더 낮으면 평균임금을 쓴다', () => {
    const out = calcSeverancePay({
      joinDate: '2025-01-01',
      leaveDate: '2026-01-01',
      monthlyWage: 300 * MAN,
      ordinaryMonthlyWage: 200 * MAN,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.usedOrdinary).toBe(false);
  });

  it('0·빈 입력은 무엇이 부족한지 돌려준다', () => {
    const out = calcSeverancePay({});
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.missing.map((m) => m.field)).toEqual(['joinDate', 'leaveDate', 'monthlyWage']);
    }
    const zero = calcSeverancePay({ joinDate: '2025-01-01', leaveDate: '2026-01-01', monthlyWage: 0 });
    expect(zero.ok).toBe(false);
  });

  it('14일 이내 지급과 3년 소멸시효를 알려준다', () => {
    const out = calcSeverancePay({
      joinDate: '2025-01-01',
      leaveDate: '2026-01-01',
      monthlyWage: 300 * MAN,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('14일'))).toBe(true);
    expect(out.result.warnings.some((w) => w.includes('3년'))).toBe(true);
    expect(out.result.basis[0].source).toContain('근로자퇴직급여 보장법');
  });
});
