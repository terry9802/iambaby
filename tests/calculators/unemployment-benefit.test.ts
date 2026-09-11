import { describe, expect, it } from 'vitest';
import { calcUnemploymentBenefit } from '@/lib/calculators/unemployment-benefit';

const MAN = 10000;

describe('실업급여 계산기', () => {
  it('정상: 월 300만원 · 가입 3년 · 50세 미만이면 180일', () => {
    const out = calcUnemploymentBenefit({
      monthlyWage: 300 * MAN,
      ageGroup: 'under50',
      insuredYears: 3,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.benefitDays).toBe(180);
    expect(out.result.value.dailyAverageWage).toBe(98901);
    expect(out.result.value.total).toBe(out.result.value.dailyBenefit * 180);
  });

  it('소정급여일수 표를 나이와 가입기간으로 고른다', () => {
    const cases: [number, 'under50' | 'over50', number][] = [
      [0.5, 'under50', 120],
      [2, 'under50', 150],
      [4, 'under50', 180],
      [7, 'under50', 210],
      [12, 'under50', 240],
      [2, 'over50', 180],
      [12, 'over50', 270],
    ];
    for (const [years, ageGroup, expected] of cases) {
      const out = calcUnemploymentBenefit({ monthlyWage: 300 * MAN, ageGroup, insuredYears: years });
      if (!out.ok) throw new Error('계산 실패');
      expect(out.result.value.benefitDays, `${ageGroup} ${years}년`).toBe(expected);
    }
  });

  it('하한: 최저임금일액의 80%보다 적게 나오지 않는다', () => {
    const out = calcUnemploymentBenefit({ monthlyWage: 150 * MAN, insuredYears: 3 });
    if (!out.ok) throw new Error('계산 실패');
    // 2026년 최저임금 10,320원 × 8시간 × 80%
    expect(out.result.value.dailyFloor).toBe(66048);
    expect(out.result.value.dailyBenefit).toBe(66048);
  });

  it('올해는 하한액이 상한액보다 높아, 그 사실을 알려준다', () => {
    const out = calcUnemploymentBenefit({ monthlyWage: 600 * MAN, insuredYears: 3 });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.floorExceedsCap).toBe(true);
    expect(out.result.value.dailyBenefit).toBe(66048);
    expect(out.result.warnings.some((w) => w.includes('하한액'))).toBe(true);
  });

  it('상한액을 직접 고치면 그 값으로 계산한다', () => {
    const out = calcUnemploymentBenefit({
      monthlyWage: 600 * MAN,
      insuredYears: 3,
      dailyCapOverride: 80000,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.dailyCap).toBe(80000);
    expect(out.result.value.dailyBenefit).toBe(80000);
    expect(out.result.value.cappedByCap).toBe(true);
  });

  it('스스로 그만둔 경우 원칙적으로 못 받는다고 먼저 알린다', () => {
    const out = calcUnemploymentBenefit({ monthlyWage: 300 * MAN, voluntary: true });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.mayNotQualify).toBe(true);
    expect(out.result.warnings[0]).toContain('스스로 그만두면');
  });

  it('0·빈 입력은 무엇이 부족한지 돌려준다', () => {
    expect(calcUnemploymentBenefit({}).ok).toBe(false);
    expect(calcUnemploymentBenefit({ monthlyWage: 0 }).ok).toBe(false);
  });

  it('상한액은 확인이 필요하다는 것과 12개월 기한을 경고한다', () => {
    const out = calcUnemploymentBenefit({ monthlyWage: 300 * MAN });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('확인이 필요'))).toBe(true);
    expect(out.result.warnings.some((w) => w.includes('12개월'))).toBe(true);
  });

  it('근거는 고용보험법 조문이다', () => {
    const out = calcUnemploymentBenefit({ monthlyWage: 300 * MAN });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.basis[0].source).toContain('고용보험법');
  });
});
