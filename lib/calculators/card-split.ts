import {
  earnedIncomeTaxCredit,
  progressiveTax,
  type PayrollRule as FullPayrollRule,
} from '@/lib/calculators/net-salary';
import { loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { formatKRW, toISODate } from '@/lib/format';

/**
 * 두 사람이 생활비를 카드로 쓸 때, 누구 명의로 얼마를, 신용과 체크 중
 * 무엇으로 써야 이득인지 고른다.
 *
 * 이 문제가 헷갈리는 이유는 서로 반대로 당기는 힘이 셋이기 때문이다.
 *
 *  1) 문턱  — 총급여의 25%를 넘겨야 공제가 시작된다. 소득이 적은 쪽이 빨리 넘는다.
 *  2) 세율  — 같은 공제액이라도 세율 높은 사람에게 붙어야 세금이 더 줄어든다.
 *  3) 한도  — 300만원쯤에서 막힌다. 넘겨 써도 공제가 안 늘어난다.
 *
 * 1번은 소득 적은 쪽, 2번은 소득 많은 쪽을 가리킨다. 3번은 한쪽에 몰면 금방
 * 걸린다. 그래서 "누구한테 몰아라"는 한 줄 답이 없고, 실제로 세어 봐야 한다.
 *
 * 여기서 값을 만들어 내지 않는다. 마일리지가 얼마짜리인지는 사람마다 달라서
 * 사용자가 넣은 값을 그대로 쓴다.
 */

export type CardRate = { key: string; label: string; rate: number; salaryCap?: number };

export type CardDeductionRule = {
  thresholdRate: number;
  thresholdNote: string;
  deductionOrder: string[];
  deductionOrderNote: string;
  rates: CardRate[];
  baseLimits: {
    salaryUpTo: number | null;
    limit: number;
    byChildren: { children: number; limit: number }[];
  }[];
  extraLimits: { salaryUpTo: number | null; limit: number; note: string }[];
  localTaxRate: number;
  localTaxNote: string;
  spouseRule: string;
  dependentSpouse: {
    incomeLimit: number;
    wageOnlySalaryLimit: number;
    note: string;
    combinedNote: string;
  };
  excludedNote: string;
  consult: { label: string; number: string; note: string };
};

/** 세금 계산은 급여 계산기가 쓰는 것과 같은 룰·같은 함수를 쓴다. 두 화면이 다른 답을 내면 안 된다. */
type PayrollRule = FullPayrollRule;

export type Person = {
  label: string;
  /** 연간 총급여 (세전) */
  salary: number;
};

export type CardSplitInput = {
  /** 한 해 동안 카드로 결제할 생활비 (공제 대상만) */
  yearlySpend?: number;
  aSalary?: number;
  bSalary?: number;
  aLabel?: string;
  bLabel?: string;
  /** 1,000원 쓸 때 쌓이는 마일리지 */
  milesPer1000?: number;
  /** 1마일을 얼마로 칠 것인가 */
  wonPerMile?: number;
  /** 신용카드 연회비 (두 장 합계) */
  annualFee?: number;
  /**
   * 혼인신고를 마쳤는가. 사실혼·예비부부는 해당되지 않는다.
   * 이것만으로는 계산이 바뀌지 않는다. 배우자 소득이 기본공제 선 아래일 때
   * 비로소 두 사람 카드 사용액이 한 사람 공제로 합쳐진다.
   */
  married?: boolean;
  asOf?: string;
};

export type Plan = {
  /** 이 사람이 한 해에 쓸 금액 */
  spend: number;
  /** 그중 신용카드로 쓸 금액 */
  credit: number;
  /** 그중 체크카드·현금영수증으로 쓸 금액 */
  check: number;
  threshold: number;
  deduction: number;
  limit: number;
  /** 한도에 걸려 잘린 금액 */
  cappedBy: number;
  marginalRate: number;
  taxSaved: number;
};

export type CardSplitValue = {
  a: Plan & { label: string; salary: number };
  b: Plan & { label: string; salary: number };
  taxSavedTotal: number;
  miles: number;
  mileValue: number;
  annualFee: number;
  /** 절세 + 마일리지 − 연회비 */
  netBenefit: number;
  /** 전부 한 사람 신용카드로 몰았을 때와의 차이 */
  vsAllOnOne: number;
  /** 전부 체크카드로만 썼을 때와의 차이 */
  vsAllCheck: number;
  thresholdTotal: number;
  /** 문턱을 못 넘긴 사람이 있는가 */
  belowThreshold: string[];
  /**
   * 1마일을 이 값보다 비싸게 쓸 수 있으면 신용카드가, 아니면 체크카드가 이득이다.
   * 마일리지 카드를 쓸지 말지를 가르는 한 줄짜리 답이다.
   */
  breakEvenWonPerMile: number | null;
  /** 한도를 이미 채웠는가. 그 뒤로는 무조건 신용카드가 이득이다. */
  limitReached: boolean;
  /**
   * 두 사람 카드 사용액이 한 사람 공제로 합쳐지는가.
   * 합쳐지면 누구 명의로 긁든 공제가 같아서, 명의를 고민할 이유가 사라진다.
   */
  combined: boolean;
  /** 합산될 때 공제를 받는 쪽 */
  earnerLabel: string;
  /** "결혼하면 달라지나요"에 대한 답. 배우자가 없으면 null. */
  spouseNote: string | null;
  /** 견줄 기준값. 이 숫자가 있어야 "이득"이 무엇에 견준 말인지 말할 수 있다. */
  allOnOneValue: number;
  allCheckValue: number;
};

/** 총급여에서 근로소득공제와 본인 기본공제를 뺀 과세표준. 한계세율을 고르는 데 쓴다. */
function taxBaseOf(salary: number, p: PayrollRule): number {
  const row =
    p.earnedIncomeDeduction.find((r) => r.upTo !== null && salary <= r.upTo) ??
    p.earnedIncomeDeduction[p.earnedIncomeDeduction.length - 1];
  const earned = Math.min(p.earnedIncomeDeductionCap, row.base + (salary - row.over) * row.rate);
  return Math.max(0, salary - earned - p.personalDeduction);
}

/**
 * 소득공제를 받았을 때 실제로 줄어드는 소득세.
 *
 * 한계세율만 곱하면 틀린다. 총급여 400만원인 사람은 과세표준이 0이라 세금을
 * 한 푼도 안 내는데, 세율표는 6%를 돌려준다. 그 6%를 믿으면 계산기가
 * "소득 적은 배우자 카드로 쓰세요"라는 엉뚱한 답을 내놓는다. 실제로는 그 사람
 * 카드로 아무리 써도 돌려받을 세금이 없다.
 *
 * 그래서 곱하지 않고 뺀다. 공제 전 세금과 공제 후 세금의 차이가 곧 아낀 돈이다.
 * 근로소득세액공제까지 넣는 이유도 같다. 산출세액이 줄면 거기 붙는 세액공제도
 * 같이 줄어서, 실제로 아끼는 돈은 한계세율이 말하는 것보다 적다.
 */
function incomeTaxOf(salary: number, deduction: number, p: PayrollRule): number {
  const base = Math.max(0, taxBaseOf(salary, p) - Math.max(0, deduction));
  const beforeCredit = progressiveTax(base, p.taxBrackets);
  return Math.max(0, beforeCredit - earnedIncomeTaxCredit(beforeCredit, salary, p));
}

export function taxSavedBy(
  salary: number,
  deduction: number,
  p: PayrollRule,
  localTaxRate: number,
): number {
  const saved = incomeTaxOf(salary, 0, p) - incomeTaxOf(salary, deduction, p);
  return Math.max(0, saved) * (1 + localTaxRate);
}

/**
 * 화면에 "세율 15%"라고 적고 손익분기를 뽑을 때 쓰는 값.
 * 공제를 이미 받은 자리에서 1원을 더 공제받으면 몇 %가 줄어드는지다.
 * 낼 세금이 없으면 0이다.
 */
function marginalRateAfter(salary: number, deduction: number, p: PayrollRule): number {
  const step = 10000;
  const here = incomeTaxOf(salary, deduction, p);
  const lower = incomeTaxOf(salary, deduction + step, p);
  return Math.max(0, (here - lower) / step);
}

export function baseLimitOf(salary: number, rule: CardDeductionRule): number {
  const row =
    rule.baseLimits.find((l) => l.salaryUpTo !== null && salary <= l.salaryUpTo) ??
    rule.baseLimits[rule.baseLimits.length - 1];
  return row.limit;
}

/**
 * 한 사람의 공제액.
 *
 * 최저사용금액은 신용카드분에서 먼저 빼고, 모자라면 체크카드분에서 뺀다
 * (조특법 시행령 제121조의2). 그래서 신용카드로 문턱을 채우면 체크카드분이
 * 온전히 30%로 남는다.
 */
export function deductionOf(
  salary: number,
  credit: number,
  check: number,
  rule: CardDeductionRule,
): { deduction: number; threshold: number; limit: number; cappedBy: number } {
  const threshold = salary * rule.thresholdRate;
  const creditRate = rule.rates.find((r) => r.key === 'credit')?.rate ?? 0.15;
  const checkRate = rule.rates.find((r) => r.key === 'check')?.rate ?? 0.3;

  const creditUsedForThreshold = Math.min(credit, threshold);
  const leftover = threshold - creditUsedForThreshold;
  const checkUsedForThreshold = Math.min(check, leftover);

  const creditCountable = Math.max(0, credit - creditUsedForThreshold);
  const checkCountable = Math.max(0, check - checkUsedForThreshold);

  const raw = creditCountable * creditRate + checkCountable * checkRate;
  const limit = baseLimitOf(salary, rule);
  const deduction = Math.min(raw, limit);

  return { deduction, threshold, limit, cappedBy: Math.max(0, raw - limit) };
}

/**
 * 한 사람이 정해진 금액을 쓸 때 가장 이득이 되는 신용·체크 나누기.
 *
 * 공제만 보면 신용카드를 문턱만큼만 쓰는 게 낫다. 그 위로 신용카드를 1원 더
 * 쓸 때마다 공제가 0.15원 줄기 때문이다. 하지만 마일리지가 그보다 크면
 * 더 쓰는 게 이득이고, 한도에 걸린 뒤로는 공제가 안 늘어나므로 남는 건
 * 전부 신용카드로 쓰는 게 이득이다. 그 경계를 직접 세어 고른다.
 */
function bestSplit(
  salary: number,
  spend: number,
  rule: CardDeductionRule,
  payroll: PayrollRule,
  wonPerWonSpent: number,
): Plan {
  let best: Plan | null = null;
  // 후보를 촘촘히 훑는다. 경계가 문턱·한도 두 군데라 식으로 풀기보다 세는 쪽이 안전하다.
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const credit = (spend * i) / steps;
    const check = spend - credit;
    const d = deductionOf(salary, credit, check, rule);
    const taxSaved = taxSavedBy(salary, d.deduction, payroll, rule.localTaxRate);
    const marginalRate = marginalRateAfter(salary, d.deduction, payroll);
    const value = taxSaved + credit * wonPerWonSpent;
    if (!best || value > best.taxSaved + best.credit * wonPerWonSpent) {
      best = {
        spend,
        credit,
        check,
        threshold: d.threshold,
        deduction: d.deduction,
        limit: d.limit,
        cappedBy: d.cappedBy,
        marginalRate,
        taxSaved,
      };
    }
  }
  return best as Plan;
}

export function calcCardSplit(input: CardSplitInput): CalcOutcome<CardSplitValue> {
  if (!input.yearlySpend || input.yearlySpend <= 0) {
    return missing<CardSplitValue>({
      field: 'yearlySpend',
      label: '한 해에 카드로 쓸 생활비',
      hint: '한 달 생활비에 12를 곱한 금액이에요. 보험료·교육비·관리비·통신비처럼 공제가 안 되는 건 빼고 넣어주세요.',
    });
  }
  if (!input.aSalary || input.aSalary <= 0) {
    return missing<CardSplitValue>({
      field: 'aSalary',
      label: '첫 번째 사람의 연간 총급여',
      hint: '세금 떼기 전 연봉이에요. 문턱과 세율이 이 금액으로 정해집니다.',
    });
  }

  const asOf = input.asOf ?? toISODate(new Date());
  const lookup = loadRule<CardDeductionRule>('card-deduction', asOf);
  const rule = lookup.rule.values;
  const payrollLookup = loadRule<PayrollRule>('payroll', asOf);
  const payroll = payrollLookup.rule.values;

  const rawASalary = input.aSalary;
  const rawBSalary = Math.max(0, input.bSalary ?? 0);
  const rawALabel = input.aLabel?.trim() || '나';
  const rawBLabel = input.bLabel?.trim() || '배우자';
  const spend = input.yearlySpend;

  /*
    결혼 여부 자체는 이 공제를 바꾸지 않는다. 바꾸는 건 배우자의 소득이다.
    배우자가 기본공제 대상(연간 소득금액 100만원 이하, 근로소득만 있으면 총급여
    500만원 이하)이면 배우자 카드 사용액을 본인 공제에 합산할 수 있다.
    그러면 두 사람이 세법상 한 사람처럼 계산되고, 누구 명의로 긁든 공제가 같아서
    명의를 고민할 이유가 없어진다. 카드는 혜택 좋은 걸로 고르면 된다.

    여기서는 두 분 다 근로소득만 있다고 보고 총급여 기준으로 가른다.
    사실혼·예비부부는 해당되지 않는다. 혼인신고를 마쳐야 배우자다.
  */
  const dependentLimit = rule.dependentSpouse.wageOnlySalaryLimit;
  const lowerIsB = rawBSalary <= rawASalary;
  const lowerSalary = lowerIsB ? rawBSalary : rawASalary;
  const married = input.married ?? false;
  /*
    배우자 총급여를 0으로 둔 칸은 "배우자가 없다"와 "배우자가 돈을 안 번다"
    둘 다로 읽힌다. 결혼 여부 칸이 그 둘을 가른다. 외벌이 부부라면 배우자가
    긁은 카드도 전부 버는 쪽 공제로 들어간다. 놓치면 손해가 큰 쪽이다.
  */
  const combined = married && lowerSalary <= dependentLimit;

  /*
    "결혼하든 안 하든 같은 결과냐"는 질문에 계산기가 직접 답해야 한다.
    체크박스를 눌렀는데 숫자가 그대로면 사람은 계산이 고장 났다고 생각하고,
    반대로 달라지는데 왜 달라지는지 안 적으면 믿지 못한다. 네 경우를 다 말한다.
  */
  const hasPartner = rawBSalary > 0 || married;
  const spouseNote: string | null = !hasPartner
    ? null
    : combined
      ? `두 분 카드 사용액이 ${combined && !lowerIsB ? rawBLabel : rawALabel} 님 공제로 합쳐집니다. ${rule.dependentSpouse.combinedNote}`
      : married
        ? `결혼 여부는 이 답을 바꾸지 않습니다. 두 분 다 총급여가 ${formatKRW(dependentLimit)}을 넘어서, 카드 사용액이 합쳐지지 않고 각자 소득에서 각자 공제받아요.`
        : lowerSalary <= dependentLimit
          ? `혼인신고를 하면 답이 달라집니다. ${lowerIsB ? rawBLabel : rawALabel} 님 총급여가 ${formatKRW(dependentLimit)} 이하라, 혼인신고 후에는 그분 카드 사용액까지 합쳐서 공제받을 수 있어요.`
          : `혼인신고를 해도 이 답은 그대로입니다. 두 분 다 총급여가 ${formatKRW(dependentLimit)}을 넘으면 카드 사용액이 합쳐지지 않아요.`;

  /* 합쳐지면 공제는 소득이 많은 쪽 한 사람 몫으로 계산한다. */
  const aSalary = combined ? Math.max(rawASalary, rawBSalary) : rawASalary;
  const bSalary = combined ? 0 : rawBSalary;
  const earnerLabel = combined && !lowerIsB ? rawBLabel : rawALabel;
  const aLabel = combined ? '우리 둘' : rawALabel;
  const bLabel = rawBLabel;

  const milesPer1000 = Math.max(0, input.milesPer1000 ?? 0);
  const wonPerMile = Math.max(0, input.wonPerMile ?? 0);
  // 1원 쓸 때 돌아오는 마일리지의 값어치
  const mileWonPerWon = (milesPer1000 / 1000) * wonPerMile;
  const annualFee = Math.max(0, input.annualFee ?? 0);

  const evaluate = (toA: number) => {
    const a = bestSplit(aSalary, toA, rule, payroll, mileWonPerWon);
    const b =
      bSalary > 0
        ? bestSplit(bSalary, spend - toA, rule, payroll, mileWonPerWon)
        : { ...bestSplit(1, 0, rule, payroll, 0), spend: 0, credit: 0, check: 0, taxSaved: 0 };
    const miles = ((a.credit + b.credit) / 1000) * milesPer1000;
    return { a, b, taxSaved: a.taxSaved + b.taxSaved, miles };
  };

  // 두 사람 사이 배분도 촘촘히 훑는다. 한 사람만 있으면 볼 것도 없다.
  let best = evaluate(spend);
  if (bSalary > 0) {
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const candidate = evaluate((spend * i) / steps);
      const score = candidate.taxSaved + candidate.miles * wonPerMile;
      const bestScore = best.taxSaved + best.miles * wonPerMile;
      if (score > bestScore) best = candidate;
    }
  }

  const { a, b, miles } = best;
  const taxSavedTotal = a.taxSaved + b.taxSaved;
  const mileValue = miles * wonPerMile;
  const netBenefit = taxSavedTotal + mileValue - annualFee;

  // 견줄 기준 둘. "그냥 한 사람 신용카드로" 와 "그냥 전부 체크카드로".
  const allOnOne = deductionOf(aSalary, spend, 0, rule);
  const allOnOneValue =
    taxSavedBy(aSalary, allOnOne.deduction, payroll, rule.localTaxRate) +
    (spend / 1000) * milesPer1000 * wonPerMile;
  const allCheckA = deductionOf(aSalary, 0, spend, rule);
  const allCheckValue = taxSavedBy(aSalary, allCheckA.deduction, payroll, rule.localTaxRate);

  /*
    신용카드를 1원 더 쓰면 공제가 0.15원 줄고, 그만큼 세금이 늘어난다.
    그 손해보다 마일리지가 값지면 신용카드가 이득이다. 그 경계를 마일 단가로
    되돌려 주면 "1마일을 얼마로 쓸 자신이 있는가"라는 한 가지 질문이 된다.
  */
  const creditRate = rule.rates.find((r) => r.key === 'credit')?.rate ?? 0.15;
  const checkRate = rule.rates.find((r) => r.key === 'check')?.rate ?? 0.3;
  const spender = a.spend >= b.spend ? a : b;
  /*
    단, 그 경계는 공제가 실제로 움직일 때만 있다. 주로 쓰는 사람이 문턱을
    못 넘어서 공제가 0원이면 체크카드로 바꿔도 줄어들 세금이 없다. 그때는
    포기할 게 없으니 마일 단가가 얼마든 신용카드가 이득이고, 경계선 자체가
    없다. 없는 경계를 "58원은 넘겨야 한다"고 말하면 거짓말이 된다.
  */
  const marginIsLive = spender.deduction > 0;
  const lostPerWon = (checkRate - creditRate) * spender.marginalRate * (1 + rule.localTaxRate);
  const breakEvenWonPerMile =
    milesPer1000 > 0 && marginIsLive ? (lostPerWon * 1000) / milesPer1000 : null;
  const limitReached = a.cappedBy > 0 || b.cappedBy > 0;

  const belowThreshold: string[] = [];
  if (a.spend > 0 && a.spend < a.threshold) belowThreshold.push(aLabel);
  if (bSalary > 0 && b.spend > 0 && b.spend < b.threshold) belowThreshold.push(bLabel);

  const steps: CalcStep[] = [
    {
      label: '한 해 카드 생활비',
      formula: formatKRW(spend),
      result: spend,
      unit: 'KRW',
    },
    {
      label: `${aLabel} 문턱 (총급여의 ${rule.thresholdRate * 100}%)`,
      formula: `${formatKRW(aSalary)} × ${rule.thresholdRate * 100}%`,
      result: Math.round(a.threshold),
      unit: 'KRW',
      note: rule.thresholdNote,
    },
    ...(bSalary > 0
      ? [
          {
            label: `${bLabel} 문턱`,
            formula: `${formatKRW(bSalary)} × ${rule.thresholdRate * 100}%`,
            result: Math.round(b.threshold),
            unit: 'KRW' as const,
          },
        ]
      : []),
    {
      label: `${aLabel} — 신용카드로`,
      formula: a.credit > 0 ? `문턱까지 채우고 그 위는 체크로` : '쓰지 않음',
      result: Math.round(a.credit),
      unit: 'KRW',
    },
    {
      label: `${aLabel} — 체크카드로`,
      formula: `${formatKRW(Math.round(a.spend))} 중 나머지`,
      result: Math.round(a.check),
      unit: 'KRW',
    },
    ...(bSalary > 0
      ? [
          {
            label: `${bLabel} — 신용카드로`,
            formula: b.credit > 0 ? '문턱까지 채우고 그 위는 체크로' : '쓰지 않음',
            result: Math.round(b.credit),
            unit: 'KRW' as const,
          },
          {
            label: `${bLabel} — 체크카드로`,
            formula: `${formatKRW(Math.round(b.spend))} 중 나머지`,
            result: Math.round(b.check),
            unit: 'KRW' as const,
          },
        ]
      : []),
    {
      label: '줄어드는 세금',
      formula: `공제 ${formatKRW(Math.round(a.deduction + b.deduction))} × 세율`,
      result: Math.round(taxSavedTotal),
      unit: 'KRW',
      note: rule.localTaxNote,
    },
    ...(milesPer1000 > 0
      ? [
          {
            label: '쌓이는 마일리지',
            formula: `${Math.round(miles).toLocaleString('ko-KR')}마일 × ${formatKRW(wonPerMile)}`,
            result: Math.round(mileValue),
            unit: 'KRW' as const,
            note: '마일 값어치는 넣으신 값을 그대로 썼어요. 쓰는 노선과 좌석에 따라 크게 달라집니다.',
          },
        ]
      : []),
    ...(annualFee > 0
      ? [
          {
            label: '연회비',
            formula: '직접 넣으신 금액',
            result: -annualFee,
            unit: 'KRW' as const,
          },
        ]
      : []),
    {
      label: '한 해 순이익',
      formula: `절세 ${formatKRW(Math.round(taxSavedTotal))} + 마일리지 ${formatKRW(Math.round(mileValue))} − 연회비 ${formatKRW(annualFee)}`,
      result: Math.round(netBenefit),
      unit: 'KRW',
    },
  ];

  const assumptions = [
    '두 분 다 근로소득만 있다고 보고 계산했어요. 사업소득·금융소득이 있으면 합산 여부가 달라질 수 있습니다.',
    '넣으신 금액이 전부 공제 대상 지출이라고 봤습니다.',
    '기본공제 한도만 적용했어요. 전통시장·대중교통·도서공연 추가 한도는 넣지 않았습니다.',
    '줄어드는 세금은 근로소득공제·본인 기본공제·근로소득세액공제까지 넣어 계산했어요. 부양가족이나 다른 공제는 넣지 않아서, 실제로는 이보다 적게 줄어들 수 있습니다.',
  ];

  const warnings: string[] = [
    `**${rule.spouseRule}**`,
    `**공제가 안 되는 지출이 많습니다.** ${rule.excludedNote}`,
  ];

  if (breakEvenWonPerMile !== null && !limitReached) {
    warnings.unshift(
      wonPerMile >= breakEvenWonPerMile
        ? `**1마일을 ${formatKRW(Math.round(breakEvenWonPerMile))}보다 비싸게 쓸 수 있으면 신용카드가 이득입니다.** 넣으신 ${formatKRW(wonPerMile)}은 그 선을 넘어서 신용카드 쪽으로 계산했어요. 마일을 그만큼 값지게 못 쓸 것 같으면 이 값을 낮춰 다시 보세요.`
        : `**1마일을 ${formatKRW(Math.round(breakEvenWonPerMile))}보다 비싸게 쓸 수 있어야 신용카드가 이득입니다.** 넣으신 ${formatKRW(wonPerMile)}으로는 못 미쳐서 체크카드 쪽으로 계산했어요.`,
    );
  }
  if (limitReached) {
    warnings.unshift(
      milesPer1000 > 0
        ? '**공제 한도를 이미 채웠습니다.** 그 위로는 체크카드를 써도 세금이 더 줄지 않아요. 남는 금액은 마일리지가 붙는 신용카드로 쓰는 게 무조건 이득입니다.'
        : '**공제 한도를 이미 채웠습니다.** 그 위로는 더 써도 세금이 줄지 않아요. 혜택이 좋은 카드를 쓰시면 됩니다.',
    );
  }
  if (belowThreshold.length > 0) {
    /*
      한쪽에 다 몰아줘도 문턱에 못 미치는 경우가 있다. 소득이 높고 카드로
      쓰는 돈은 적은 집이 그렇다. 그때 "몰아주세요"는 될 수 없는 걸 하라는
      말이라서, 공제를 포기하고 카드 혜택만 챙기라고 말해야 맞다.
    */
    const unreachable = spend < Math.min(a.threshold, bSalary > 0 ? b.threshold : a.threshold);
    warnings.unshift(
      unreachable
        ? `**한 사람에게 다 몰아줘도 문턱을 못 넘깁니다.** 낮은 쪽 문턱이 ${formatKRW(Math.min(a.threshold, bSalary > 0 ? b.threshold : a.threshold))}인데 한 해에 쓸 돈이 ${formatKRW(spend)}이에요. 올해는 카드 소득공제를 받을 수 없으니, 세금은 신경 쓰지 말고 마일리지나 할인이 가장 좋은 카드를 쓰시면 됩니다.`
        : `**${belowThreshold.join(', ')}은(는) 문턱을 못 넘깁니다.** 그 사람 카드로 쓴 돈은 공제가 0원이에요. 문턱을 넘길 만큼 몰아주거나, 아예 다른 사람 카드를 쓰는 게 낫습니다.`,
    );
  }

  return ok({
    value: {
      a: { ...a, label: aLabel, salary: aSalary },
      b: { ...b, label: bLabel, salary: bSalary },
      taxSavedTotal,
      miles,
      mileValue,
      annualFee,
      netBenefit,
      vsAllOnOne: netBenefit + annualFee - allOnOneValue,
      vsAllCheck: netBenefit + annualFee - allCheckValue,
      thresholdTotal: a.threshold + (bSalary > 0 ? b.threshold : 0),
      belowThreshold,
      breakEvenWonPerMile,
      limitReached,
      combined,
      earnerLabel,
      spouseNote,
      allOnOneValue,
      allCheckValue,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta, payrollLookup.rule.meta],
  });
}

export function cardDeductionRule(asOf?: string): CardDeductionRule {
  return loadRule<CardDeductionRule>('card-deduction', asOf ?? toISODate(new Date())).rule.values;
}

/**
 * 계산 결과를 한 줄로 줄인다. 대시보드 맨 위에 놓을 문장이다.
 *
 * 숫자 표는 아래에 다 있으니, 이 줄은 "그래서 뭘 하라는 건데"에만 답해야 한다.
 * 누구 카드를 쓰고, 신용과 체크 중 무엇을 쓰라는 것인지 두 가지만 담는다.
 */
export function cardSplitVerdict(v: CardSplitValue): { action: string; why: string } {
  const users = [v.a, v.b].filter((p) => p.spend > 0);
  const total = v.a.spend + v.b.spend;

  if (users.length === 0 || total <= 0) {
    return {
      action: '쓸 금액을 넣어주세요.',
      why: '한 해에 카드로 쓸 생활비를 넣으면 계산합니다.',
    };
  }

  /* 누구 명의를 쓰는가. 한 사람에게 몰렸는지, 둘로 갈렸는지. */
  const whose = v.combined
    ? '명의는 상관없습니다.'
    : users.length === 1
      ? `${users[0].label} 카드 한 장에 몰아서`
      : `${v.a.label}·${v.b.label} 카드에 나눠 담고`;

  /* 무엇으로 쓰는가. 한쪽이 5% 미만이면 "전부"라고 말해도 거짓이 아니다. */
  const credit = v.a.credit + v.b.credit;
  const check = v.a.check + v.b.check;
  const mix =
    check / total < 0.05
      ? '전부 신용카드로 쓰세요'
      : credit / total < 0.05
        ? '전부 체크카드로 쓰세요'
        : '아래 금액대로 신용·체크를 섞어 쓰세요';

  const why = v.limitReached
    ? '공제 한도를 이미 채워서, 그 위로는 체크카드를 써도 세금이 줄지 않아요.'
    : v.breakEvenWonPerMile === null
      ? v.belowThreshold.length > 0 && credit / total >= 0.95
        ? '문턱을 못 넘겨 올해는 공제가 없어요. 세금은 잊고 혜택 좋은 카드를 쓰시면 됩니다.'
        : '마일리지를 빼면 공제율이 높은 체크카드가 유리해요.'
      : `1마일을 ${formatKRW(Math.round(v.breakEvenWonPerMile))}보다 비싸게 쓸 수 있느냐가 갈림길이에요.`;

  /* 합산될 때 whose는 마침표로 끝나는 완결된 문장이라, 이어 붙이면 두 문장이 된다. */
  return { action: `${whose} ${mix}.`, why };
}
