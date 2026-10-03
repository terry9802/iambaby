import { loadRule } from '@/lib/rules/loader';
import { formatKRW, toISODate } from '@/lib/format';
import type { PayrollRule } from '@/lib/calculators/net-salary';
import {
  baseLimitOf,
  cardDeductionRule,
  taxSavedBy,
  type CardDeductionRule,
} from '@/lib/calculators/card-split';
import type { Entry, Holder } from '@/lib/ledger/schema';

/**
 * 적어 둔 지출로 지금 시점의 연말정산을 세어 본다.
 *
 * 카드 배분 계산기는 "한 해에 3,600만원 쓸 건데 어떻게 나눌까"를 미리 묻는 도구고,
 * 이쪽은 "지금까지 이렇게 썼는데 남은 기간엔 뭘 써야 하나"를 묻는 도구다.
 * 같은 법을 쓰지만 질문이 다르다. 미리 세운 계획은 어차피 틀어지므로,
 * 실제로 쓴 돈을 보고 다시 말해 주는 쪽이 쓸모 있다.
 *
 * 공제는 명의자 소득에서만 붙으므로 사람별로 따로 센다.
 */

/** 공제율이 같은 것끼리 묶은 덩어리. 최저사용금액은 이 순서대로 차감된다. */
export type RateBucket = {
  key: string;
  label: string;
  rate: number;
  spent: number;
  /** 최저사용금액으로 깎인 금액 */
  usedForThreshold: number;
  /** 공제율이 붙는 금액 */
  countable: number;
  /** 기본 한도가 아니라 추가 한도(전통시장·대중교통·도서공연)에 들어가는가 */
  extra: boolean;
};

export type HolderSummary = {
  holder: Holder;
  label: string;
  salary: number;
  threshold: number;
  buckets: RateBucket[];
  /** 공제 대상 지출 합계 */
  spent: number;
  /** 공제가 안 되는 지출로 적어 둔 합계 */
  excluded: number;
  baseLimit: number;
  extraLimit: number;
  baseDeduction: number;
  extraDeduction: number;
  deduction: number;
  taxSaved: number;
  /** 문턱까지 더 써야 하는 금액. 넘었으면 0 */
  toThreshold: number;
  /** 기본 한도를 채우려면 체크카드로 더 써야 하는 금액. 채웠으면 0 */
  toBaseLimit: number;
  baseLimitReached: boolean;
  advice: string;
};

export type LedgerSummary = {
  from: string;
  to: string;
  entryCount: number;
  holders: HolderSummary[];
  totalSpent: number;
  totalExcluded: number;
  totalDeduction: number;
  totalTaxSaved: number;
  /** 커플통장에서 나간 돈 */
  coupleSpent: number;
  personalSpent: number;
};

export type LedgerSummaryInput = {
  entries: Entry[];
  /** 내 연간 총급여 */
  mySalary: number;
  /** 배우자 연간 총급여. 0이면 배우자 쪽은 세지 않는다. */
  partnerSalary?: number;
  myLabel?: string;
  partnerLabel?: string;
  asOf?: string;
};

/**
 * 가계부의 분류를 공제율 덩어리로 옮긴다.
 *
 * 현금영수증은 체크카드와 공제율이 같아서(30%) 한 덩어리로 묶는다.
 * 전통시장에서 신용카드로 긁어도 전통시장분 40%가 붙는다. 공제율을 가르는 건
 * 결제수단이 아니라 어디서 썼느냐이기 때문이다. 그래서 분류가 결제수단을 이긴다.
 */
function bucketOf(entry: Entry): { key: string; extra: boolean } | null {
  if (entry.category === 'excluded') return null;
  if (entry.category === 'market') return { key: 'market', extra: true };
  if (entry.category === 'transit') return { key: 'transit', extra: true };
  if (entry.category === 'culture') return { key: 'culture', extra: true };
  return { key: entry.method === 'credit' ? 'credit' : 'check', extra: false };
}

function extraLimitOf(salary: number, rule: CardDeductionRule): number {
  const row =
    rule.extraLimits.find((l) => l.salaryUpTo !== null && salary <= l.salaryUpTo) ??
    rule.extraLimits[rule.extraLimits.length - 1];
  return row.limit;
}

function summarizeHolder(
  holder: Holder,
  label: string,
  salary: number,
  entries: Entry[],
  rule: CardDeductionRule,
  payroll: PayrollRule,
): HolderSummary {
  const mine = entries.filter((e) => e.holder === holder);
  const excluded = mine
    .filter((e) => e.category === 'excluded')
    .reduce((sum, e) => sum + e.amount, 0);

  const spentByKey = new Map<string, number>();
  for (const entry of mine) {
    const b = bucketOf(entry);
    if (!b) continue;
    spentByKey.set(b.key, (spentByKey.get(b.key) ?? 0) + entry.amount);
  }

  /*
    최저사용금액은 공제율이 낮은 쪽부터 차감한다(조특법 시행령 제121조의2).
    납세자에게 유리한 순서다. 40%짜리 전통시장분을 먼저 깎으면 손해가 크다.
  */
  const buckets: RateBucket[] = rule.rates
    .map((r) => ({
      key: r.key,
      label: r.label,
      rate: r.rate,
      spent: spentByKey.get(r.key) ?? 0,
      usedForThreshold: 0,
      countable: 0,
      extra: r.key === 'market' || r.key === 'transit' || r.key === 'culture',
    }))
    .filter((b) => b.spent > 0 || !b.extra)
    .sort((a, b) => a.rate - b.rate);

  const spent = buckets.reduce((sum, b) => sum + b.spent, 0);
  const threshold = salary * rule.thresholdRate;

  let remaining = threshold;
  for (const bucket of buckets) {
    const used = Math.min(bucket.spent, remaining);
    bucket.usedForThreshold = used;
    bucket.countable = bucket.spent - used;
    remaining -= used;
  }

  const rawBase = buckets.filter((b) => !b.extra).reduce((sum, b) => sum + b.countable * b.rate, 0);
  const rawExtra = buckets.filter((b) => b.extra).reduce((sum, b) => sum + b.countable * b.rate, 0);

  const baseLimit = baseLimitOf(salary, rule);
  const extraLimit = extraLimitOf(salary, rule);
  const baseDeduction = Math.min(rawBase, baseLimit);
  const extraDeduction = Math.min(rawExtra, extraLimit);
  const deduction = baseDeduction + extraDeduction;
  const taxSaved = taxSavedBy(salary, deduction, payroll, rule.localTaxRate);

  const toThreshold = Math.max(0, threshold - spent);
  const baseLimitReached = rawBase >= baseLimit;
  /* 한도를 채우려면 30%짜리로 얼마를 더 써야 하는지. 사람이 바로 쓸 수 있는 숫자다. */
  const checkRate = rule.rates.find((r) => r.key === 'check')?.rate ?? 0.3;
  const toBaseLimit = baseLimitReached ? 0 : (baseLimit - rawBase) / checkRate;

  const advice = adviceFor({
    label,
    spent,
    toThreshold,
    baseLimitReached,
    toBaseLimit,
    salary,
  });

  return {
    holder,
    label,
    salary,
    threshold,
    buckets,
    spent,
    excluded,
    baseLimit,
    extraLimit,
    baseDeduction,
    extraDeduction,
    deduction,
    taxSaved,
    toThreshold,
    toBaseLimit,
    baseLimitReached,
    advice,
  };
}

function adviceFor(x: {
  label: string;
  spent: number;
  toThreshold: number;
  baseLimitReached: boolean;
  toBaseLimit: number;
  salary: number;
}): string {
  if (x.spent <= 0) return '아직 적으신 게 없어요.';

  if (x.toThreshold > 0) {
    /*
      문턱 아래에서는 어차피 전액이 깎여 나간다. 그래서 신용카드를 써도
      잃는 게 없고, 오히려 혜택이 좋은 카드를 쓰는 쪽이 이득이다.
      "체크카드를 쓰세요"는 문턱을 넘은 다음에 할 말이다.
    */
    return `문턱까지 ${formatKRW(Math.round(x.toThreshold))} 남았어요. 여기까지는 어차피 공제에서 깎이는 금액이라, 혜택이 좋은 신용카드로 쓰셔도 손해가 없습니다.`;
  }

  if (x.baseLimitReached) {
    return '기본 공제 한도를 채우셨어요. 이제 일반 지출은 더 써도 세금이 줄지 않습니다. 전통시장·대중교통·도서공연만 추가 한도로 더 공제돼요.';
  }

  return `문턱은 넘기셨어요. 지금부터는 체크카드·현금영수증이 신용카드보다 공제율이 두 배입니다. 한도를 다 채우려면 체크카드로 ${formatKRW(Math.round(x.toBaseLimit))}쯤 더 쓰시면 돼요.`;
}

export function summarizeLedger(input: LedgerSummaryInput): LedgerSummary {
  const asOf = input.asOf ?? toISODate(new Date());
  const rule = cardDeductionRule(asOf);
  const payroll = loadRule<PayrollRule>('payroll', asOf).rule.values;

  const entries = input.entries;
  const dates = entries.map((e) => e.date).sort();

  const holders: HolderSummary[] = [
    summarizeHolder('me', input.myLabel ?? '나', input.mySalary, entries, rule, payroll),
  ];
  if ((input.partnerSalary ?? 0) > 0) {
    holders.push(
      summarizeHolder(
        'partner',
        input.partnerLabel ?? '배우자',
        input.partnerSalary ?? 0,
        entries,
        rule,
        payroll,
      ),
    );
  }

  const coupleSpent = entries
    .filter((e) => e.purse === 'couple')
    .reduce((sum, e) => sum + e.amount, 0);
  const personalSpent = entries
    .filter((e) => e.purse === 'personal')
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    from: dates[0] ?? asOf,
    to: dates[dates.length - 1] ?? asOf,
    entryCount: entries.length,
    holders,
    totalSpent: holders.reduce((sum, h) => sum + h.spent, 0),
    totalExcluded: holders.reduce((sum, h) => sum + h.excluded, 0),
    totalDeduction: holders.reduce((sum, h) => sum + h.deduction, 0),
    totalTaxSaved: holders.reduce((sum, h) => sum + h.taxSaved, 0),
    coupleSpent,
    personalSpent,
  };
}
