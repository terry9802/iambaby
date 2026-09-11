import { describe, expect, it } from 'vitest';
import { checkNewlywedJeonseLoan } from '@/lib/calculators/newlywed-jeonse-loan';

const EOK = 100000000;
const MAN = 10000;

describe('신혼부부 전세자금대출 판정기', () => {
  it('정상: 수도권 보증금 3억이면 2.4억까지 빌리고 6천만원을 마련해야 한다', () => {
    const out = checkNewlywedJeonseLoan({
      deposit: 3 * EOK,
      householdIncome: 6000 * MAN,
      netAsset: 1 * EOK,
      marriedYears: 2,
      noHome: true,
      region: 'capital',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.eligible).toBe(true);
    expect(out.result.value.maxLoan).toBe(2.4 * EOK);
    expect(out.result.value.ownFunds).toBe(0.6 * EOK);
  });

  it('상한: 보증금이 커도 수도권 한도 2.5억에서 막힌다', () => {
    const out = checkNewlywedJeonseLoan({
      deposit: 3.8 * EOK,
      householdIncome: 6000 * MAN,
      marriedYears: 1,
      region: 'capital',
    });
    if (!out.ok) throw new Error('계산 실패');
    // 80%면 3.04억이지만 한도가 2.5억
    expect(out.result.value.maxLoan).toBe(2.5 * EOK);
    expect(out.result.warnings.some((w) => w.includes('한도가'))).toBe(true);
  });

  it('수도권 밖은 한도가 1.6억이다', () => {
    const out = checkNewlywedJeonseLoan({
      deposit: 2.5 * EOK,
      householdIncome: 5000 * MAN,
      marriedYears: 3,
      region: 'other',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.maxLoan).toBe(1.6 * EOK);
  });

  it('탈락: 소득이 7,500만원을 넘으면 받을 수 없다', () => {
    const out = checkNewlywedJeonseLoan({
      deposit: 3 * EOK,
      householdIncome: 8000 * MAN,
      marriedYears: 2,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.eligible).toBe(false);
    expect(out.result.value.maxLoan).toBe(0);
    expect(out.result.value.checks.find((c) => c.label === '부부합산 연소득')?.passed).toBe(false);
    expect(out.result.warnings.some((w) => w.includes('일반 버팀목'))).toBe(true);
  });

  it('경계값: 소득 7,500만원 정확히면 통과, 혼인 7년까지 통과', () => {
    const out = checkNewlywedJeonseLoan({
      deposit: 2 * EOK,
      householdIncome: 7500 * MAN,
      netAsset: 3.45 * EOK,
      marriedYears: 7,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.eligible).toBe(true);

    const over = checkNewlywedJeonseLoan({
      deposit: 2 * EOK,
      householdIncome: 7500 * MAN,
      marriedYears: 8,
    });
    if (!over.ok) throw new Error('계산 실패');
    expect(over.result.value.eligible).toBe(false);
  });

  it('결혼 전이어도 3개월 이내 예정이면 통과한다', () => {
    const out = checkNewlywedJeonseLoan({
      deposit: 2 * EOK,
      householdIncome: 5000 * MAN,
      marriedYears: 0,
      marryingSoon: true,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.checks.find((c) => c.label === '혼인 기간')?.passed).toBe(true);
  });

  it('자녀와 전자계약이 있으면 금리가 내려간다', () => {
    const base = checkNewlywedJeonseLoan({
      deposit: 2 * EOK,
      householdIncome: 5000 * MAN,
      marriedYears: 2,
    });
    const discounted = checkNewlywedJeonseLoan({
      deposit: 2 * EOK,
      householdIncome: 5000 * MAN,
      marriedYears: 2,
      children: 2,
      eContract: true,
    });
    if (!base.ok || !discounted.ok) throw new Error('계산 실패');
    expect(discounted.result.value.discount).toBeCloseTo(0.006, 5);
    expect(discounted.result.value.rateMax).toBeLessThan(base.result.value.rateMax);
    expect(discounted.result.value.monthlyInterestMax).toBeLessThan(
      base.result.value.monthlyInterestMax,
    );
  });

  it('0·빈 입력은 무엇이 부족한지 돌려준다', () => {
    const out = checkNewlywedJeonseLoan({});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.missing.map((m) => m.field)).toEqual(['deposit', 'householdIncome']);

    const zero = checkNewlywedJeonseLoan({ deposit: 0, householdIncome: 5000 * MAN });
    expect(zero.ok).toBe(false);
  });

  it('금리를 단정하지 않고 범위로만 알려준다', () => {
    const out = checkNewlywedJeonseLoan({
      deposit: 2 * EOK,
      householdIncome: 5000 * MAN,
      marriedYears: 2,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.rateMin).toBeLessThan(out.result.value.rateMax);
    expect(out.result.warnings.some((w) => w.includes('범위로만'))).toBe(true);
    expect(out.result.basis[0].note).toContain('옮겨 적지 않고');
  });
});
