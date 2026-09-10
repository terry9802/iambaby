import { describe, expect, it } from 'vitest';
import { calcMarriageTaxCredit } from '@/lib/calculators/marriage-tax-credit';

const MAN = 10000;

describe('결혼세액공제 계산기', () => {
  it('정상: 기간 안에 혼인신고하고 둘 다 소득이 있으면 부부 합쳐 100만원', () => {
    const out = calcMarriageTaxCredit({
      registrationDate: '2026-10-01',
      myIncome: true,
      spouseIncome: true,
      today: '2026-09-10',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.total).toBe(100 * MAN);
    expect(out.result.value.mine).toBe(50 * MAN);
    expect(out.result.value.spouse).toBe(50 * MAN);
    expect(out.result.value.eligible).toBe(true);
  });

  it('한 사람만 소득이 있으면 50만원', () => {
    const out = calcMarriageTaxCredit({
      registrationDate: '2026-10-01',
      myIncome: true,
      spouseIncome: false,
      today: '2026-09-10',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.total).toBe(50 * MAN);
  });

  it('생애 1회라 이미 받은 사람은 다시 못 받는다', () => {
    const out = calcMarriageTaxCredit({
      registrationDate: '2026-10-01',
      myAlreadyClaimed: true,
      today: '2026-09-10',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.mine).toBe(0);
    expect(out.result.value.spouse).toBe(50 * MAN);
  });

  it('경계값: 2026년 12월 31일은 되고 2027년 1월 1일은 안 된다', () => {
    const lastDay = calcMarriageTaxCredit({ registrationDate: '2026-12-31', today: '2026-09-10' });
    const nextDay = calcMarriageTaxCredit({ registrationDate: '2027-01-01', today: '2026-09-10' });
    if (!lastDay.ok || !nextDay.ok) throw new Error('계산 실패');
    expect(lastDay.result.value.total).toBe(100 * MAN);
    expect(nextDay.result.value.total).toBe(0);
    expect(nextDay.result.warnings.some((w) => w.includes('앞당길 수 있다면'))).toBe(true);
  });

  it('경계값: 2023년 혼인신고는 제도 시작 전이라 해당 없음', () => {
    const out = calcMarriageTaxCredit({ registrationDate: '2023-12-31', today: '2026-09-10' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.total).toBe(0);
    expect(out.result.value.eligible).toBe(false);
  });

  it('마감이 1년 안에 남았으면 남은 날짜를 알려준다', () => {
    const out = calcMarriageTaxCredit({ registrationDate: '2026-10-01', today: '2026-09-10' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.daysLeft).toBe(112);
    expect(out.result.warnings.some((w) => w.includes('112일 남았'))).toBe(true);
  });

  it('입력이 비면 무엇이 부족한지 돌려준다', () => {
    const out = calcMarriageTaxCredit({});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.missing[0].field).toBe('registrationDate');
  });

  it('결혼식 날이 아니라 혼인신고일이 기준임을 경고한다', () => {
    const out = calcMarriageTaxCredit({ registrationDate: '2026-10-01', today: '2026-09-10' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('혼인신고를 접수한 날'))).toBe(true);
  });

  it('근거 조문을 밝힌다', () => {
    const out = calcMarriageTaxCredit({ registrationDate: '2026-10-01', today: '2026-09-10' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.basis[0].source).toContain('조세특례제한법 제92조');
  });
});
