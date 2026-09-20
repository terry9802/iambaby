import { fallbackWarning, loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep, type RuleMeta } from '@/lib/rules/types';
import { addDays, addMonths, diffDays, formatKRW, parseDate, toISODate } from '@/lib/format';
import { calcParentalLeave, type ParentalLeaveRule } from './parental-leave';

/**
 * 7-4 출산휴가·육아휴직 타임라인.
 * 금액보다 신청 기한이 중요하다. 기한을 놓쳐 못 받는 사례가 많아 마감일을 D-day로 붙인다.
 */

export type MaternityRule = {
  leaveDays: { single: number; multiple: number };
  minDaysAfterBirth: { single: number; multiple: number };
  rate: number;
  monthlyCap: number;
  floorPolicy: string;
  minimumWage: {
    hourly: number;
    monthlyEquivalent: number;
    monthlyHours: number;
    source: string;
    sourceUrl: string;
  };
  employerPaidDays: {
    priorityCompany: number;
    largeCompany: number;
    largeCompanyMultiple: number;
    note: string;
  };
  applyFromDaysAfterStart: number;
  applyDeadlineMonthsAfterEnd: number;
  spouseLeave: { days: number; splitCount: number; requestWithinDays: number; note: string };
};

export type CompanySize = 'priority' | 'large';

export type LeaveTimelineInput = {
  /** 출산 예정일 또는 출산일 */
  dueDate?: string;
  isMultiple?: boolean;
  companySize?: CompanySize;
  monthlyWage?: number;
  parentalLeaveMonths?: number;
  /** 출산 전에 미리 쓸 일수. 기본은 출산 후 최소 일수를 남긴 만큼 전부 */
  daysBeforeBirth?: number;
  today?: string;
};

export type TimelineSegment = {
  id: string;
  name: string;
  start: string;
  end: string;
  days: number;
  payer: 'employer' | 'insurance' | 'none';
  payerLabel: string;
  amount: number;
  note: string;
};

export type TimelineDeadline = {
  id: string;
  label: string;
  dueAt: string;
  opensAt: string | null;
  dDay: number;
  status: 'open' | 'not-yet' | 'passed';
  applyAt: string;
  note: string;
};

export type LeaveTimelineValue = {
  segments: TimelineSegment[];
  deadlines: TimelineDeadline[];
  maternityStart: string;
  maternityEnd: string;
  parentalStart: string | null;
  parentalEnd: string | null;
  returnDate: string;
  maternityTotal: number;
  parentalTotal: number;
  grandTotal: number;
  totalDaysOff: number;
};

export function calcLeaveTimeline(input: LeaveTimelineInput): CalcOutcome<LeaveTimelineValue> {
  const gaps = [];
  if (!input.dueDate) {
    gaps.push({
      field: 'dueDate',
      label: '출산 예정일',
      hint: '이 날짜를 기준으로 휴가가 언제 시작하고 끝나는지, 언제까지 신청해야 하는지가 정해져요.',
    });
  }
  if (input.monthlyWage === undefined || input.monthlyWage <= 0) {
    gaps.push({
      field: 'monthlyWage',
      label: '월 통상임금',
      hint: '기본급 + 매달 고정으로 나오는 수당이에요. 금액을 모르면 일정만 보여드릴게요.',
    });
  }
  if (gaps.length > 0) return missing<LeaveTimelineValue>(...gaps);

  const dueDateIso = input.dueDate as string;
  const monthlyWage = input.monthlyWage as number;
  const isMultiple = input.isMultiple ?? false;
  const companySize: CompanySize = input.companySize ?? 'priority';
  const parentalMonths = input.parentalLeaveMonths ?? 12;
  const today = input.today ? parseDate(input.today) : new Date();

  const maternityLookup = loadRule<MaternityRule>('maternity-leave', dueDateIso);
  const parentalLookup = loadRule<ParentalLeaveRule>('parental-leave', dueDateIso);
  const m = maternityLookup.rule.values;

  const totalDays = isMultiple ? m.leaveDays.multiple : m.leaveDays.single;
  const minAfter = isMultiple ? m.minDaysAfterBirth.multiple : m.minDaysAfterBirth.single;
  const maxBefore = totalDays - minAfter;
  const requestedBefore = input.daysBeforeBirth ?? maxBefore;
  const daysBefore = Math.max(0, Math.min(requestedBefore, maxBefore));

  const due = parseDate(dueDateIso);
  const maternityStart = addDays(due, -daysBefore);
  const maternityEnd = addDays(maternityStart, totalDays - 1);

  // 급여 기준액: 통상임금이되 최저임금보다 낮으면 최저임금, 상한액보다 높으면 상한액.
  const insuranceMonthlyBase = Math.min(
    Math.max(monthlyWage * m.rate, m.minimumWage.monthlyEquivalent),
    m.monthlyCap,
  );
  const employerDays =
    companySize === 'large'
      ? isMultiple
        ? m.employerPaidDays.largeCompanyMultiple
        : m.employerPaidDays.largeCompany
      : m.employerPaidDays.priorityCompany;

  const segments: TimelineSegment[] = [];

  if (employerDays > 0) {
    const end = addDays(maternityStart, employerDays - 1);
    segments.push({
      id: 'maternity-employer',
      name: `출산전후휴가 (회사 지급 ${employerDays}일)`,
      start: toISODate(maternityStart),
      end: toISODate(end),
      days: employerDays,
      payer: 'employer',
      payerLabel: '회사',
      amount: Math.round((monthlyWage / 30) * employerDays),
      note: '대규모기업은 이 기간 통상임금 전액을 회사가 줍니다. 상한액이 없어요.',
    });
  }

  const insuranceDays = totalDays - employerDays;
  if (insuranceDays > 0) {
    const start = addDays(maternityStart, employerDays);
    segments.push({
      id: 'maternity-insurance',
      name: `출산전후휴가 (고용보험 ${insuranceDays}일)`,
      start: toISODate(start),
      end: toISODate(maternityEnd),
      days: insuranceDays,
      payer: 'insurance',
      payerLabel: '고용보험',
      amount: Math.round((insuranceMonthlyBase / 30) * insuranceDays),
      note: `월 상한 ${formatKRW(m.monthlyCap)} 기준으로 계산했어요.`,
    });
  }

  const maternityTotal = segments.reduce((acc, s) => acc + s.amount, 0);

  let parentalStart: Date | null = null;
  let parentalEnd: Date | null = null;
  let parentalTotal = 0;
  const basis: RuleMeta[] = [maternityLookup.rule.meta];

  if (parentalMonths > 0) {
    parentalStart = addDays(maternityEnd, 1);
    parentalEnd = addDays(addMonths(parentalStart, parentalMonths), -1);

    const parental = calcParentalLeave({
      monthlyWage,
      months: parentalMonths,
      startDate: toISODate(parentalStart),
    });
    if (parental.ok) {
      parentalTotal = parental.result.value.total;
      basis.push(...parental.result.basis);
      for (const month of parental.result.value.monthly) {
        const segStart = addMonths(parentalStart, month.month - 1);
        const segEnd = addDays(addMonths(parentalStart, month.month), -1);
        segments.push({
          id: `parental-${month.month}`,
          name: `육아휴직 ${month.month}개월차`,
          start: toISODate(segStart),
          end: toISODate(segEnd),
          days: diffDays(segStart, segEnd) + 1,
          payer: 'insurance',
          payerLabel: '고용보험',
          amount: month.amount,
          note: month.capped
            ? `상한 ${formatKRW(month.cap)} 적용`
            : `통상임금의 ${Math.round(month.rate * 100)}%`,
        });
      }
    }
  } else {
    basis.push(parentalLookup.rule.meta);
  }

  const returnDate = addDays(parentalEnd ?? maternityEnd, 1);

  const mkDeadline = (
    id: string,
    label: string,
    dueAt: Date,
    applyAt: string,
    note: string,
    opensAt?: Date,
  ): TimelineDeadline => {
    const dDay = diffDays(today, dueAt);
    const notOpen = opensAt ? diffDays(today, opensAt) > 0 : false;
    return {
      id,
      label,
      dueAt: toISODate(dueAt),
      opensAt: opensAt ? toISODate(opensAt) : null,
      dDay,
      status: dDay < 0 ? 'passed' : notOpen ? 'not-yet' : 'open',
      applyAt,
      note,
    };
  };

  const deadlines: TimelineDeadline[] = [
    mkDeadline(
      'maternity-request',
      '회사에 출산전후휴가 신청',
      addDays(maternityStart, -1),
      '회사 인사팀',
      '휴가를 시작하려면 그전에 회사에 알려야 해요. 회사가 휴가를 거부할 수는 없습니다.',
    ),
    mkDeadline(
      'maternity-benefit',
      '출산전후휴가 급여 신청',
      addMonths(maternityEnd, m.applyDeadlineMonthsAfterEnd),
      '고용24 또는 관할 고용센터',
      `휴가를 시작한 날부터 ${m.applyFromDaysAfterStart}일이 지나야 신청할 수 있고, 휴가가 끝난 날부터 ${m.applyDeadlineMonthsAfterEnd}개월 안에 신청해야 해요. 이 기한을 넘기면 받을 수 없습니다.`,
      addDays(maternityStart, m.applyFromDaysAfterStart),
    ),
  ];

  if (parentalStart && parentalEnd) {
    const pv = parentalLookup.rule.values;
    deadlines.push(
      mkDeadline(
        'parental-request',
        '회사에 육아휴직 신청',
        addDays(parentalStart, -pv.noticeDaysBeforeStart),
        '회사 인사팀',
        `육아휴직은 시작 예정일 ${pv.noticeDaysBeforeStart}일 전까지 회사에 신청해야 해요. 이게 가장 자주 놓치는 기한입니다.`,
      ),
      mkDeadline(
        'parental-benefit',
        '육아휴직 급여 신청',
        addMonths(parentalEnd, pv.applyDeadlineMonthsAfterEnd),
        '고용24 또는 관할 고용센터',
        `${pv.applyStartNote} 보통 매달 신청하고, 늦어도 휴직이 끝난 날부터 ${pv.applyDeadlineMonthsAfterEnd}개월 안에는 신청해야 해요.`,
        addMonths(parentalStart, 1),
      ),
    );
  }

  deadlines.push(
    mkDeadline(
      'spouse-leave',
      '배우자 출산휴가 사용',
      addDays(due, m.spouseLeave.requestWithinDays),
      '배우자의 회사',
      m.spouseLeave.note,
    ),
  );

  const grandTotal = maternityTotal + parentalTotal;
  const totalDaysOff = diffDays(maternityStart, returnDate);

  const steps: CalcStep[] = [
    {
      label: '출산전후휴가 기간',
      formula: `${totalDays}일 (출산 전 ${daysBefore}일 + 출산 후 ${totalDays - daysBefore}일)`,
      result: totalDays,
      unit: 'DAY',
      note: `${isMultiple ? '다태아는 120일' : '단태아는 90일'}이고, 출산 후에 최소 ${minAfter}일은 반드시 남겨야 해요.`,
    },
    {
      label: '출산전후휴가 급여',
      formula: segments
        .filter((s) => s.id.startsWith('maternity'))
        .map((s) => `${s.payerLabel} ${s.days}일 ${formatKRW(s.amount)}`)
        .join(' + '),
      result: maternityTotal,
      unit: 'KRW',
      note: m.employerPaidDays.note,
    },
    {
      label: `육아휴직 ${parentalMonths}개월 급여`,
      formula: parentalMonths > 0 ? `${formatKRW(parentalTotal)}` : '사용 안 함',
      result: parentalTotal,
      unit: 'KRW',
    },
    {
      label: '휴가·휴직 전체 수령액',
      formula: `${formatKRW(maternityTotal)} + ${formatKRW(parentalTotal)}`,
      result: grandTotal,
      unit: 'KRW',
    },
    {
      label: '쉬는 총 일수',
      formula: `${toISODate(maternityStart)} ~ ${toISODate(addDays(returnDate, -1))}`,
      result: totalDaysOff,
      unit: 'DAY',
      note: `${toISODate(returnDate)}에 복직하는 일정이에요.`,
    },
  ];

  const assumptions = [
    '출산 예정일에 실제로 출산한다고 보고 계산했어요. 예정일보다 일찍 낳으면 출산 후 기간이 줄어듭니다.',
    '출산전후휴가 급여는 한 달 30일로 나눠 일할 계산했어요. 실제 지급은 30일 단위로 이뤄집니다.',
    companySize === 'priority'
      ? '우선지원 대상기업으로 보고 계산했어요. 90일 전부를 고용보험에서 받습니다.'
      : '대규모기업으로 보고 계산했어요. 최초 60일(다태아 75일)은 회사가 통상임금 전액을 줍니다.',
    '육아휴직은 출산전후휴가가 끝난 다음 날 바로 이어 쓰는 것으로 잡았어요.',
  ];

  const warnings = [
    ...fallbackWarning(maternityLookup),
    ...fallbackWarning(parentalLookup),
    '신청 기한을 놓쳐서 못 받는 경우가 가장 많아요. 특히 육아휴직은 시작 30일 전까지 회사에 신청해야 하고, 급여는 휴직이 끝난 뒤 12개월이 지나면 청구할 수 없습니다.',
    '출산 후 최소 45일(다태아 60일)은 반드시 쉬어야 해요. 출산 전에 너무 많이 당겨 쓰면 출산 후 기간이 모자랍니다.',
  ];
  if (companySize === 'large') {
    warnings.push(
      '대규모기업이면 회사가 주는 60일분과 고용보험이 주는 30일분의 기준이 달라요. 회사 지급분은 상한이 없지만, 고용보험 지급분은 상한액에 걸립니다.',
    );
  }

  return ok({
    value: {
      segments,
      deadlines,
      maternityStart: toISODate(maternityStart),
      maternityEnd: toISODate(maternityEnd),
      parentalStart: parentalStart ? toISODate(parentalStart) : null,
      parentalEnd: parentalEnd ? toISODate(parentalEnd) : null,
      returnDate: toISODate(returnDate),
      maternityTotal,
      parentalTotal,
      grandTotal,
      totalDaysOff,
    },
    steps,
    assumptions,
    warnings,
    basis,
  });
}
