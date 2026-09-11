import { describe, expect, it } from 'vitest';
import { compareJobChange } from '@/lib/calculators/job-change';
import { calcNetSalary, grossForNet, progressiveTax } from '@/lib/calculators/net-salary';

const MAN = 10000;

describe('실수령액 계산', () => {
  it('연봉 5,000만원이면 월 실수령액이 340~360만원 사이', () => {
    const { breakdown } = calcNetSalary(5000 * MAN);
    expect(breakdown.netMonthly).toBeGreaterThan(340 * MAN);
    expect(breakdown.netMonthly).toBeLessThan(360 * MAN);
  });

  it('떼는 돈을 더하면 세전 금액이 된다', () => {
    const { breakdown } = calcNetSalary(6000 * MAN);
    expect(breakdown.netMonthly + breakdown.insuranceTotal + breakdown.taxTotal).toBeCloseTo(
      breakdown.grossMonthly,
      -1,
    );
  });

  it('상한: 국민연금은 기준소득월액 상한에서 더 오르지 않는다', () => {
    const high = calcNetSalary(20000 * MAN).breakdown;
    const higher = calcNetSalary(30000 * MAN).breakdown;
    expect(high.pension).toBe(higher.pension);
    // 상한 659만원 × 9.5% × 50%
    expect(high.pension).toBe(313025);
  });

  it('하한: 아주 낮은 연봉도 국민연금 하한액 기준으로 낸다', () => {
    const low = calcNetSalary(300 * MAN).breakdown;
    // 하한 41만원 × 9.5% × 50%
    expect(low.pension).toBe(19475);
  });

  it('비과세 수당은 세금도 보험료도 붙지 않는다', () => {
    const without = calcNetSalary(5000 * MAN, { taxFreeMonthly: 0 }).breakdown;
    const withMeal = calcNetSalary(5000 * MAN, { taxFreeMonthly: 200000 }).breakdown;
    expect(withMeal.insuranceTotal).toBeLessThan(without.insuranceTotal);
    expect(withMeal.netMonthly).toBeGreaterThan(without.netMonthly);
  });

  it('세금은 구간별로 나눠 매긴다', () => {
    const brackets = [
      { upTo: 14000000, rate: 0.06 },
      { upTo: 50000000, rate: 0.15 },
      { upTo: null, rate: 0.24 },
    ];
    expect(progressiveTax(10000000, brackets)).toBe(600000);
    // 1,400만×6% + 600만×15%
    expect(progressiveTax(20000000, brackets)).toBe(840000 + 900000);
    expect(progressiveTax(0, brackets)).toBe(0);
  });

  it('목표 실수령액에서 필요한 세전 연봉을 되짚는다', () => {
    const target = calcNetSalary(7000 * MAN).breakdown.netMonthly;
    const gross = grossForNet(target);
    expect(Math.abs(gross - 7000 * MAN)).toBeLessThan(2 * MAN);
  });
});

describe('이직 연봉 비교', () => {
  it('정상: 연봉이 오르면 실수령액도 오르고 차액을 알려준다', () => {
    const out = compareJobChange({ currentSalary: 5000 * MAN, offeredSalary: 6000 * MAN });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.better).toBe(true);
    expect(out.result.value.monthlyDiff).toBeGreaterThan(0);
    expect(out.result.value.annualDiff).toBe(out.result.value.monthlyDiff * 12);
  });

  it('조건이 같으면 본전 연봉은 지금 연봉과 거의 같다', () => {
    const out = compareJobChange({ currentSalary: 5000 * MAN, offeredSalary: 5500 * MAN });
    if (!out.ok) throw new Error('계산 실패');
    expect(Math.abs(out.result.value.breakEvenSalary - 5000 * MAN)).toBeLessThan(3 * MAN);
  });

  it('지금 회사 식대가 더 크면 본전 연봉이 지금 연봉보다 높아진다', () => {
    const out = compareJobChange({
      currentSalary: 5000 * MAN,
      offeredSalary: 5100 * MAN,
      currentTaxFree: 200000,
      offeredTaxFree: 0,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.breakEvenSalary).toBeGreaterThan(5000 * MAN);
    expect(out.result.warnings.some((w) => w.includes('비과세 수당'))).toBe(true);
  });

  it('연봉이 올라도 실수령액이 줄면 그 사실을 경고한다', () => {
    const out = compareJobChange({
      currentSalary: 5000 * MAN,
      offeredSalary: 5010 * MAN,
      currentTaxFree: 200000,
      offeredTaxFree: 0,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.monthlyDiff).toBeLessThan(0);
    expect(out.result.warnings.some((w) => w.includes('실수령액은'))).toBe(true);
  });

  it('0·빈 입력은 무엇이 부족한지 돌려준다', () => {
    const out = compareJobChange({});
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.missing.map((m) => m.field)).toEqual(['currentSalary', 'offeredSalary']);
    }
  });

  it('소득세가 근사치라는 것을 반드시 경고한다', () => {
    const out = compareJobChange({ currentSalary: 5000 * MAN, offeredSalary: 6000 * MAN });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('근사치'))).toBe(true);
  });
});
