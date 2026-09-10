import { describe, expect, it } from 'vitest';
import { calcLeaveTimeline } from '@/lib/calculators/leave-timeline';

const MAN = 10000;
const DUE = '2026-06-01';

describe('출산휴가·육아휴직 타임라인', () => {
  it('정상: 우선지원 대상기업 단태아 90일 + 육아휴직 12개월', () => {
    const out = calcLeaveTimeline({
      dueDate: DUE,
      monthlyWage: 300 * MAN,
      parentalLeaveMonths: 12,
      today: '2026-03-01',
    });
    if (!out.ok) throw new Error('계산 실패');
    const v = out.result.value;

    expect(v.maternityStart).toBe('2026-04-17'); // 출산 예정일 45일 전
    expect(v.maternityEnd).toBe('2026-07-15');   // 90일
    expect(v.parentalStart).toBe('2026-07-16');
    expect(v.returnDate).toBe('2027-07-16');
    expect(v.maternityTotal).toBe(660 * MAN);    // 월 상한 220만 × 3개월
    expect(v.parentalTotal).toBe(2310 * MAN);
    expect(v.grandTotal).toBe(2970 * MAN);
  });

  it('대규모기업은 최초 60일을 회사가 통상임금 전액으로 지급한다', () => {
    const out = calcLeaveTimeline({
      dueDate: DUE,
      monthlyWage: 300 * MAN,
      companySize: 'large',
      parentalLeaveMonths: 0,
      today: '2026-03-01',
    });
    if (!out.ok) throw new Error('계산 실패');

    const employer = out.result.value.segments.find((s) => s.payer === 'employer');
    const insurance = out.result.value.segments.find((s) => s.id === 'maternity-insurance');
    expect(employer?.days).toBe(60);
    expect(employer?.amount).toBe(600 * MAN);  // 상한 없음
    expect(insurance?.days).toBe(30);
    expect(insurance?.amount).toBe(220 * MAN); // 상한 적용
    expect(out.result.value.maternityTotal).toBe(820 * MAN);
  });

  it('하한: 통상임금이 최저임금보다 낮으면 최저임금 월환산액으로 계산한다', () => {
    const out = calcLeaveTimeline({
      dueDate: DUE,
      monthlyWage: 100 * MAN,
      parentalLeaveMonths: 0,
      today: '2026-03-01',
    });
    if (!out.ok) throw new Error('계산 실패');
    // 2026년 최저임금 월환산 2,156,880원 기준 90일치
    expect(out.result.value.maternityTotal).toBe(Math.round((2156880 / 30) * 90));
  });

  it('다태아는 120일이고 출산 전에 최대 60일까지만 당겨 쓸 수 있다', () => {
    const out = calcLeaveTimeline({
      dueDate: DUE,
      monthlyWage: 300 * MAN,
      isMultiple: true,
      daysBeforeBirth: 100, // 과하게 입력해도 60일로 잘린다
      parentalLeaveMonths: 0,
      today: '2026-03-01',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.maternityStart).toBe('2026-04-02'); // 60일 전
    expect(out.result.value.totalDaysOff).toBe(120);
  });

  it('경계값: 육아휴직 0개월이면 출산전후휴가만 계산하고 바로 복직한다', () => {
    const out = calcLeaveTimeline({
      dueDate: DUE,
      monthlyWage: 300 * MAN,
      parentalLeaveMonths: 0,
      today: '2026-03-01',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.parentalStart).toBeNull();
    expect(out.result.value.parentalTotal).toBe(0);
    expect(out.result.value.returnDate).toBe('2026-07-16');
  });

  it('0·음수 입력은 무엇이 부족한지 돌려준다', () => {
    const empty = calcLeaveTimeline({});
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.missing.map((m) => m.field)).toEqual(['dueDate', 'monthlyWage']);

    const negative = calcLeaveTimeline({ dueDate: DUE, monthlyWage: -100 });
    expect(negative.ok).toBe(false);
  });

  it('육아휴직은 시작 30일 전 신청 마감을 D-day로 알려준다', () => {
    const out = calcLeaveTimeline({
      dueDate: DUE,
      monthlyWage: 300 * MAN,
      parentalLeaveMonths: 12,
      today: '2026-03-01',
    });
    if (!out.ok) throw new Error('계산 실패');
    const request = out.result.value.deadlines.find((d) => d.id === 'parental-request');
    expect(request?.dueAt).toBe('2026-06-16'); // 2026-07-16의 30일 전
    expect(request?.status).toBe('open');
    expect(request?.dDay).toBe(107);
  });

  it('급여 신청 기한은 휴가·휴직이 끝난 뒤 12개월이다', () => {
    const out = calcLeaveTimeline({
      dueDate: DUE,
      monthlyWage: 300 * MAN,
      parentalLeaveMonths: 12,
      today: '2026-03-01',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.deadlines.find((d) => d.id === 'maternity-benefit')?.dueAt).toBe(
      '2027-07-15',
    );
    expect(out.result.value.deadlines.find((d) => d.id === 'parental-benefit')?.dueAt).toBe(
      '2028-07-15',
    );
  });

  it('근거는 출산전후휴가와 육아휴직 두 룰을 모두 담는다', () => {
    const out = calcLeaveTimeline({
      dueDate: DUE,
      monthlyWage: 300 * MAN,
      parentalLeaveMonths: 12,
      today: '2026-03-01',
    });
    if (!out.ok) throw new Error('계산 실패');
    const ids = out.result.basis.map((b) => b.ruleId).sort();
    expect(ids).toEqual(['maternity-leave', 'parental-leave']);
  });
});
