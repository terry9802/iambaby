import { describe, expect, it } from 'vitest';
import { calcUnemploymentBenefit } from '@/lib/calculators/unemployment-benefit';

const MAN = 10000;

describe('실업급여 계산기', () => {
  it('정상: 월 300만원 · 가입 3년 · 50세 미만이면 180일', () => {
    const out = calcUnemploymentBenefit({
      monthlyWage: 300 * MAN,
      ageGroup: 'under50',
      insuredYears: 3,
      asOf: '2026-06-01',
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
    const out = calcUnemploymentBenefit({ monthlyWage: 150 * MAN, insuredYears: 3, asOf: '2026-06-01' });
    if (!out.ok) throw new Error('계산 실패');
    // 2026년 최저임금 10,320원 × 8시간 × 80%
    expect(out.result.value.dailyFloor).toBe(66048);
    expect(out.result.value.dailyBenefit).toBe(66048);
  });

  it('2026년 상한액은 시행령 개정분 68,100원이다', () => {
    // 2025-12-16 국무회의 의결로 66,000 → 68,100. 예전 값으로 되돌아가면 과소 산출된다.
    const out = calcUnemploymentBenefit({ monthlyWage: 600 * MAN, insuredYears: 3, asOf: '2026-06-01' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.dailyCap).toBe(68100);
    expect(out.result.value.floorExceedsCap).toBe(false);
    expect(out.result.value.dailyBenefit).toBe(68100);
  });

  it('하한액이 상한액을 넘는 해에는 하한액을 적용하고 그 사실을 알려준다', () => {
    // 2027년 최저임금 10,700원 → 하한 68,480원. 상한(68,100원)은 아직 개정 전이라 역전된다.
    const out = calcUnemploymentBenefit({ monthlyWage: 600 * MAN, insuredYears: 3, asOf: '2027-03-01' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.dailyFloor).toBe(68480);
    expect(out.result.value.floorExceedsCap).toBe(true);
    expect(out.result.value.dailyBenefit).toBe(68480);
    expect(out.result.warnings.some((w) => w.includes('하한액'))).toBe(true);
  });

  it('상한액을 직접 고치면 그 값으로 계산한다', () => {
    const out = calcUnemploymentBenefit({
      monthlyWage: 600 * MAN,
      insuredYears: 3,
      dailyCapOverride: 80000,
      asOf: '2026-06-01',
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

  it('상한액이 고시된 해에는 "확인이 필요"를 띄우지 않는다', () => {
    // 늘 붙어 있으면 정말 확인이 필요한 해에도 그 말이 안 읽힌다.
    const out = calcUnemploymentBenefit({ monthlyWage: 300 * MAN, asOf: '2026-06-01' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.dailyCapNeedsCheck).toBe(false);
    expect(out.result.warnings.some((w) => w.includes('확인이 필요'))).toBe(false);
    expect(out.result.warnings.some((w) => w.includes('12개월'))).toBe(true);
  });

  it('상한액이 아직 개정 전인 해에는 확인이 필요하다고 알린다', () => {
    const out = calcUnemploymentBenefit({ monthlyWage: 300 * MAN, asOf: '2027-03-01' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.dailyCapNeedsCheck).toBe(true);
    expect(out.result.warnings.some((w) => w.includes('확인이 필요'))).toBe(true);
  });

  it('근거는 고용보험법 조문이다', () => {
    const out = calcUnemploymentBenefit({ monthlyWage: 300 * MAN });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.basis[0].source).toContain('고용보험법');
  });
});
