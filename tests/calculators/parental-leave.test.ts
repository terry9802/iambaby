import { describe, expect, it } from 'vitest';
import { calcParentalLeave } from '@/lib/calculators/parental-leave';

const MAN = 10000;

describe('육아휴직 급여 계산기', () => {
  it('통상임금 300만원으로 12개월을 쓰면 총 2,310만원 (고용노동부 보도자료 예시와 일치)', () => {
    const out = calcParentalLeave({ monthlyWage: 300 * MAN, months: 12, startDate: '2026-03-01' });
    expect(out.ok).toBe(true);
    if (!out.ok) return;

    // 1~3개월 250만(상한) / 4~6개월 200만(상한) / 7~12개월 240만의 80%가 아니라 상한 160만
    expect(out.result.value.monthly[0].amount).toBe(250 * MAN);
    expect(out.result.value.monthly[3].amount).toBe(200 * MAN);
    expect(out.result.value.monthly[6].amount).toBe(160 * MAN);
    expect(out.result.value.total).toBe(2310 * MAN);
  });

  it('상한: 통상임금이 아무리 높아도 구간별 상한액을 넘지 않는다', () => {
    const out = calcParentalLeave({ monthlyWage: 900 * MAN, months: 12, startDate: '2026-03-01' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.total).toBe(2310 * MAN);
    expect(out.result.value.monthly.every((m) => m.capped)).toBe(true);
  });

  it('하한: 통상임금이 낮아도 월 70만원 아래로 내려가지 않는다', () => {
    const out = calcParentalLeave({ monthlyWage: 50 * MAN, months: 12, startDate: '2026-03-01' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.monthly.every((m) => m.amount === 70 * MAN)).toBe(true);
    expect(out.result.value.total).toBe(12 * 70 * MAN);
    expect(out.result.warnings.some((w) => w.includes('하한액'))).toBe(true);
  });

  it('경계값: 6개월차와 7개월차 사이에서 지급률이 100%에서 80%로 바뀐다', () => {
    const out = calcParentalLeave({ monthlyWage: 150 * MAN, months: 8, startDate: '2026-03-01' });
    if (!out.ok) throw new Error('계산 실패');
    const sixth = out.result.value.monthly[5];
    const seventh = out.result.value.monthly[6];
    expect(sixth.rate).toBe(1);
    expect(sixth.amount).toBe(150 * MAN);
    expect(seventh.rate).toBe(0.8);
    expect(seventh.amount).toBe(120 * MAN);
  });

  it('경계값: 최대 18개월을 넘겨 입력하면 18개월로 잘라 계산하고 알려준다', () => {
    const out = calcParentalLeave({ monthlyWage: 300 * MAN, months: 24, startDate: '2026-03-01' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.months).toBe(18);
    expect(out.result.warnings.some((w) => w.includes('18개월'))).toBe(true);
  });

  it('0·음수 입력은 에러가 아니라 무엇이 부족한지 돌려준다', () => {
    const noWage = calcParentalLeave({ months: 12 });
    expect(noWage.ok).toBe(false);
    if (!noWage.ok) expect(noWage.missing[0].field).toBe('monthlyWage');

    const negative = calcParentalLeave({ monthlyWage: -100, months: -3 });
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.missing.map((m) => m.field)).toEqual(['monthlyWage', 'months']);

    const zero = calcParentalLeave({ monthlyWage: 0, months: 0 });
    expect(zero.ok).toBe(false);
  });

  it('한부모는 첫 3개월 상한이 300만원으로 올라간다', () => {
    const out = calcParentalLeave({
      monthlyWage: 400 * MAN,
      months: 3,
      singleParent: true,
      startDate: '2026-03-01',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.total).toBe(900 * MAN);
  });

  it('사후지급금 폐지를 경고에 반드시 담는다', () => {
    const out = calcParentalLeave({ monthlyWage: 300 * MAN, months: 12, startDate: '2026-03-01' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('사후지급금'))).toBe(true);
  });

  it('계산 과정(steps)과 근거(basis)를 반드시 채운다', () => {
    const out = calcParentalLeave({ monthlyWage: 300 * MAN, months: 12, startDate: '2026-03-01' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.steps.length).toBeGreaterThan(2);
    expect(out.result.basis[0].sourceUrl).toMatch(/^https:\/\//);
    expect(out.result.basis[0].source).toContain('고용보험법 시행령');
  });
});
