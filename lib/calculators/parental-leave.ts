import { fallbackWarning, loadRule } from '@/lib/rules/loader';
import {
  missing,
  ok,
  type CalcOutcome,
  type CalcStep,
} from '@/lib/rules/types';
import { formatKRW, formatManwon, formatPercent } from '@/lib/format';

/**
 * 7-1 육아휴직 급여 계산기.
 * 기준값은 전부 rules/<연도>/parental-leave.json 에서 온다. 이 파일에는 숫자를 두지 않는다.
 */

export type Bracket = {
  fromMonth: number;
  toMonth: number | null;
  rate: number;
  cap: number;
  floor: number;
};

export type ParentalLeaveRule = {
  brackets: Bracket[];
  singleParentBrackets: Bracket[];
  maxMonthsBase: number;
  maxMonthsExtended: number;
  extendedConditionNote: string;
  postPaymentAbolished: boolean;
  childAgeLimitYears: number;
  applyDeadlineMonthsAfterEnd: number;
  applyStartNote: string;
  noticeDaysBeforeStart: number;
  noticeNote: string;
};

export type ParentalLeaveInput = {
  /** 월 통상임금 */
  monthlyWage?: number;
  /** 사용할 개월 수 */
  months?: number;
  singleParent?: boolean;
  /** 육아휴직 개시일. 적용할 룰의 연도를 고르는 기준이다. */
  startDate?: string;
};

export type MonthlyPayment = {
  /** 육아휴직 몇 개월차인지 (1부터) */
  month: number;
  rate: number;
  cap: number;
  floor: number;
  /** 통상임금 × 지급률 (상·하한 적용 전) */
  raw: number;
  amount: number;
  capped: boolean;
  floored: boolean;
};

export type ParentalLeaveValue = {
  total: number;
  months: number;
  monthly: MonthlyPayment[];
  firstMonthAmount: number;
  averageMonthly: number;
};

export function findBracket(brackets: Bracket[], month: number): Bracket {
  const found = brackets.find(
    (b) => month >= b.fromMonth && (b.toMonth === null || month <= b.toMonth),
  );
  // 룰 파일이 1개월차부터 빈틈없이 덮도록 작성돼 있으므로 여기 도달하면 룰 파일이 잘못된 것이다.
  if (!found) throw new Error(`육아휴직 ${month}개월차에 해당하는 지급 구간이 룰 파일에 없습니다.`);
  return found;
}

/** 한 달치 급여. 최적화기도 같은 함수를 쓴다. */
export function monthlyPayment(
  monthlyWage: number,
  month: number,
  brackets: Bracket[],
): MonthlyPayment {
  const bracket = findBracket(brackets, month);
  const raw = monthlyWage * bracket.rate;
  const afterCap = Math.min(raw, bracket.cap);
  const amount = Math.max(afterCap, bracket.floor);
  return {
    month,
    rate: bracket.rate,
    cap: bracket.cap,
    floor: bracket.floor,
    raw: Math.round(raw),
    amount: Math.round(amount),
    capped: raw > bracket.cap,
    floored: afterCap < bracket.floor,
  };
}

/** 같은 지급 구간에 속한 달들을 하나의 계산 단계로 묶는다. */
function groupSteps(monthly: MonthlyPayment[]): CalcStep[] {
  const steps: CalcStep[] = [];
  let bucket: MonthlyPayment[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const span = first.month === last.month ? `${first.month}개월차` : `${first.month}~${last.month}개월차`;
    const sum = bucket.reduce((acc, m) => acc + m.amount, 0);
    const reason = first.capped
      ? `통상임금의 ${formatPercent(first.rate)}가 상한액을 넘어 상한액인 ${formatManwon(first.cap)}으로 지급`
      : first.floored
        ? `통상임금의 ${formatPercent(first.rate)}가 하한액보다 적어 하한액인 ${formatManwon(first.floor)}으로 지급`
        : `통상임금의 ${formatPercent(first.rate)} 그대로 지급`;

    steps.push({
      label: `${span} (${bucket.length}개월)`,
      formula: `${formatKRW(first.amount)} × ${bucket.length}개월`,
      result: sum,
      unit: 'KRW',
      note: reason,
      children: bucket.map((m) => ({
        label: `${m.month}개월차`,
        formula: m.capped
          ? `min(${formatKRW(m.raw)}, 상한 ${formatKRW(m.cap)})`
          : m.floored
            ? `max(${formatKRW(m.raw)}, 하한 ${formatKRW(m.floor)})`
            : formatKRW(m.raw),
        result: m.amount,
        unit: 'KRW' as const,
      })),
    });
    bucket = [];
  };

  for (const m of monthly) {
    const prev = bucket[bucket.length - 1];
    const sameGroup =
      prev && prev.rate === m.rate && prev.cap === m.cap && prev.amount === m.amount;
    if (!sameGroup) flush();
    bucket.push(m);
  }
  flush();
  return steps;
}

export function calcParentalLeave(input: ParentalLeaveInput): CalcOutcome<ParentalLeaveValue> {
  const gaps = [];
  if (input.monthlyWage === undefined || input.monthlyWage <= 0) {
    gaps.push({
      field: 'monthlyWage',
      label: '월 통상임금',
      hint: '급여명세서의 기본급과 매달 고정으로 나오는 수당을 더한 금액이에요. 성과급처럼 들쭉날쭉한 항목은 빼고 적으면 됩니다.',
    });
  }
  if (input.months === undefined || input.months <= 0) {
    gaps.push({
      field: 'months',
      label: '사용할 개월 수',
      hint: '몇 개월 쉴 계획인지 적어주세요. 아직 안 정했다면 12개월로 두고 비교해봐도 좋아요.',
    });
  }
  if (gaps.length > 0) return missing<ParentalLeaveValue>(...gaps);

  const monthlyWage = input.monthlyWage as number;
  const requestedMonths = Math.floor(input.months as number);
  const startDate = input.startDate ?? new Date().toISOString().slice(0, 10);

  const lookup = loadRule<ParentalLeaveRule>('parental-leave', startDate);
  const rule = lookup.rule.values;
  const brackets = input.singleParent ? rule.singleParentBrackets : rule.brackets;

  const warnings: string[] = [...fallbackWarning(lookup)];
  const assumptions: string[] = [];

  let months = requestedMonths;
  if (months > rule.maxMonthsExtended) {
    months = rule.maxMonthsExtended;
    warnings.push(
      `육아휴직 급여는 최대 ${rule.maxMonthsExtended}개월분까지만 나와요. ${requestedMonths}개월을 입력하셨지만 ${rule.maxMonthsExtended}개월로 계산했습니다.`,
    );
  }
  if (months > rule.maxMonthsBase) {
    warnings.push(
      `${rule.maxMonthsBase}개월을 넘겨 쓰려면 조건이 있어요. ${rule.extendedConditionNote}`,
    );
  }

  const monthly = Array.from({ length: months }, (_, i) =>
    monthlyPayment(monthlyWage, i + 1, brackets),
  );
  const total = monthly.reduce((acc, m) => acc + m.amount, 0);

  const steps: CalcStep[] = [
    {
      label: '월 통상임금',
      formula: '입력값',
      result: monthlyWage,
      unit: 'KRW',
      note: '지급률과 상한액을 적용할 기준 금액이에요.',
    },
    ...groupSteps(monthly),
    {
      label: `${months}개월 총 수령액`,
      formula: monthly.map((m) => formatManwon(m.amount)).join(' + '),
      result: total,
      unit: 'KRW',
    },
  ];

  assumptions.push('휴직 기간 내내 통상임금이 그대로라고 보고 계산했어요.');
  assumptions.push('개월 수는 딱 떨어지는 달로 계산했어요. 중간에 시작하면 그 달은 일수만큼 나눠서 나옵니다.');
  if (input.singleParent) {
    assumptions.push('한부모 특례를 적용했어요. 첫 3개월 상한액이 더 높습니다.');
  }

  if (rule.postPaymentAbolished) {
    warnings.push(
      '사후지급금 제도는 폐지됐어요. 예전에는 25%를 복직 6개월 뒤에 줬지만, 지금은 휴직 중에 전액을 받습니다. 오래된 글에서 "75%만 나온다"는 설명을 보셨다면 지금 기준이 아니에요.',
    );
  }
  if (monthly.some((m) => m.floored)) {
    warnings.push(
      '통상임금이 하한액보다 적어 하한액으로 계산했어요. 실제로는 통상임금을 넘겨 받을 수 없다는 해석이 있으니 관할 고용센터에 확인해 주세요.',
    );
  }
  warnings.push(
    `신청 기한을 놓치면 못 받아요. ${rule.applyStartNote} 늦어도 육아휴직이 끝난 날부터 ${rule.applyDeadlineMonthsAfterEnd}개월 안에 신청해야 합니다.`,
  );

  return ok({
    value: {
      total,
      months,
      monthly,
      firstMonthAmount: monthly[0]?.amount ?? 0,
      averageMonthly: months > 0 ? Math.round(total / months) : 0,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta],
  });
}
