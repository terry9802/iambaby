import { loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { addMonths, diffDays, formatKRW, formatManwon, parseDate, toISODate } from '@/lib/format';

/** 퇴직금 = 1일 평균임금 × 30일 × (재직일수 / 365) */

export type SeverancePayRule = {
  daysPerYear: number;
  yearDays: number;
  minMonths: number;
  minWeeklyHours: number;
  averageWagePeriodDays: number;
  useOrdinaryWageIfHigher: boolean;
  claimYears: number;
  claimNote: string;
  payWithinDays: number;
  payNote: string;
};

export type SeverancePayInput = {
  joinDate?: string;
  leaveDate?: string;
  /** 퇴직 전 3개월 월 평균 급여 (세전) */
  monthlyWage?: number;
  /** 최근 1년 상여금 총액 */
  annualBonus?: number;
  /** 전년도 연차수당 */
  annualLeaveAllowance?: number;
  /** 월 통상임금 (평균임금과 비교하려면) */
  ordinaryMonthlyWage?: number;
};

export type SeverancePayValue = {
  eligible: boolean;
  servedDays: number;
  servedYears: number;
  threeMonthDays: number;
  threeMonthTotal: number;
  dailyAverageWage: number;
  dailyOrdinaryWage: number;
  appliedDailyWage: number;
  usedOrdinary: boolean;
  severance: number;
};

/** 통상임금일액 = 월 통상임금 ÷ 월 소정근로시간(209) × 1일 소정근로시간(8) */
const MONTHLY_WORK_HOURS = 209;
const DAILY_WORK_HOURS = 8;

export function calcSeverancePay(input: SeverancePayInput): CalcOutcome<SeverancePayValue> {
  const gaps = [];
  if (!input.joinDate) {
    gaps.push({ field: 'joinDate', label: '입사일', hint: '근로계약서나 재직증명서에 있는 날짜예요.' });
  }
  if (!input.leaveDate) {
    gaps.push({
      field: 'leaveDate',
      label: '퇴사일',
      hint: '마지막 근무일 다음 날이 퇴사일입니다. 아직 안 정하셨으면 예정일을 넣어보세요.',
    });
  }
  if (!input.monthlyWage || input.monthlyWage <= 0) {
    gaps.push({
      field: 'monthlyWage',
      label: '퇴직 전 3개월 월 평균 급여 (세전)',
      hint: '세금 떼기 전 금액이에요. 매달 조금씩 다르면 세 달 평균을 넣어주세요.',
    });
  }
  if (gaps.length > 0) return missing<SeverancePayValue>(...gaps);

  const joinDate = input.joinDate as string;
  const leaveDate = input.leaveDate as string;
  const monthlyWage = input.monthlyWage as number;

  const lookup = loadRule<SeverancePayRule>('severance-pay', leaveDate);
  const rule = lookup.rule.values;

  const join = parseDate(joinDate);
  const leave = parseDate(leaveDate);
  const servedDays = Math.max(0, diffDays(join, leave));
  const servedYears = servedDays / rule.yearDays;

  // 퇴직 직전 3개월의 실제 일수. 달마다 28~31일이라 89~92일로 달라진다.
  const periodStart = addMonths(leave, -3);
  const threeMonthDays = Math.max(1, diffDays(periodStart, leave));

  const bonusPortion = (input.annualBonus ?? 0) * (3 / 12);
  const leavePortion = (input.annualLeaveAllowance ?? 0) * (3 / 12);
  const threeMonthTotal = monthlyWage * 3 + bonusPortion + leavePortion;

  const dailyAverageWage = threeMonthTotal / threeMonthDays;
  const dailyOrdinaryWage = input.ordinaryMonthlyWage
    ? (input.ordinaryMonthlyWage / MONTHLY_WORK_HOURS) * DAILY_WORK_HOURS
    : 0;

  const usedOrdinary = rule.useOrdinaryWageIfHigher && dailyOrdinaryWage > dailyAverageWage;
  const appliedDailyWage = usedOrdinary ? dailyOrdinaryWage : dailyAverageWage;

  const eligible = servedDays >= rule.yearDays;
  const severance = eligible
    ? Math.round(appliedDailyWage * rule.daysPerYear * (servedDays / rule.yearDays))
    : 0;

  const steps: CalcStep[] = [
    {
      label: '재직 일수',
      formula: `${joinDate} ~ ${leaveDate}`,
      result: servedDays,
      unit: 'DAY',
      note: `약 ${servedYears.toFixed(2)}년입니다.`,
    },
    {
      label: '퇴직 전 3개월 임금 총액',
      formula: [
        `월급 ${formatManwon(monthlyWage)} × 3개월`,
        bonusPortion > 0 ? `상여금 ${formatManwon(input.annualBonus ?? 0)} × 3/12` : '',
        leavePortion > 0 ? `연차수당 ${formatManwon(input.annualLeaveAllowance ?? 0)} × 3/12` : '',
      ]
        .filter(Boolean)
        .join(' + '),
      result: Math.round(threeMonthTotal),
      unit: 'KRW',
      note: '상여금과 연차수당은 1년치의 3개월분만 넣습니다.',
    },
    {
      label: '1일 평균임금',
      formula: `${formatKRW(Math.round(threeMonthTotal))} ÷ ${threeMonthDays}일`,
      result: Math.round(dailyAverageWage),
      unit: 'KRW',
    },
  ];

  if (dailyOrdinaryWage > 0) {
    steps.push({
      label: '1일 통상임금',
      formula: `월 통상임금 ÷ ${MONTHLY_WORK_HOURS}시간 × ${DAILY_WORK_HOURS}시간`,
      result: Math.round(dailyOrdinaryWage),
      unit: 'KRW',
      note: usedOrdinary
        ? '평균임금보다 높아서 이 금액으로 계산했습니다.'
        : '평균임금이 더 높아 평균임금으로 계산했습니다.',
    });
  }

  steps.push({
    label: '퇴직금',
    formula: `${formatKRW(Math.round(appliedDailyWage))} × ${rule.daysPerYear}일 × (${servedDays}일 ÷ ${rule.yearDays}일)`,
    result: severance,
    unit: 'KRW',
  });

  const assumptions = [
    '퇴직 전 3개월 급여가 매달 같다고 보고 계산했어요. 실제로는 그 3개월에 받은 금액을 그대로 더합니다.',
    '주 15시간 이상 일하는 근로자를 기준으로 했어요.',
    '퇴직연금(DC형)에 가입돼 있다면 계산 방식이 달라집니다. 이 계산기는 퇴직금 제도(DB형 포함)를 기준으로 합니다.',
  ];

  const warnings = [
    `${rule.payNote}`,
    `${rule.claimNote}`,
    '평균임금에는 매달 받는 급여뿐 아니라 상여금과 연차수당의 3개월분도 들어갑니다. 빼놓으면 퇴직금이 실제보다 적게 나옵니다.',
  ];

  if (!eligible) {
    warnings.unshift(
      `재직 기간이 1년(${rule.yearDays}일)에 못 미쳐 퇴직금 지급 대상이 아닙니다. 하루 차이로 갈리니 퇴사일을 꼭 확인해 보세요. 1년이 되는 날은 ${toISODate(addMonths(join, 12))}입니다.`,
    );
  }

  return ok({
    value: {
      eligible,
      servedDays,
      servedYears,
      threeMonthDays,
      threeMonthTotal: Math.round(threeMonthTotal),
      dailyAverageWage: Math.round(dailyAverageWage),
      dailyOrdinaryWage: Math.round(dailyOrdinaryWage),
      appliedDailyWage: Math.round(appliedDailyWage),
      usedOrdinary,
      severance,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta],
  });
}
