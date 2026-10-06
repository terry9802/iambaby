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
  /**
   * 지금 이 사람이 써야 할 카드.
   *
   * 이 도구에서 제일 중요한 한 가지다. 설명 속에 묻어 두면 안 읽힌다.
   * 세 가지 중 하나다.
   *  - 세금이 줄기 시작하는 금액에 아직 못 미침 → 어차피 안 줄어드니 혜택 좋은 신용카드
   *  - 그 금액을 넘김 → 체크카드·현금영수증이 두 배로 줄여 준다
   *  - 더 줄여 주는 한도까지 다 채움 → 다시 혜택 좋은 신용카드
   */
  nowUse: 'credit' | 'check';
  /** 왜 그 카드인지 한 줄로 */
  nowWhy: string;
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

  const now = adviceFor({ spent, toThreshold, baseLimitReached, toBaseLimit });

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
    nowUse: now.use,
    nowWhy: now.why,
    advice: now.advice,
  };
}

/**
 * 지금 어떤 카드를 써야 하는지, 그리고 왜 그런지.
 *
 * 말을 쉽게 쓴다. '문턱', '최저사용금액', '공제율' 같은 말은 법에서 쓰는 말이지
 * 사람이 쓰는 말이 아니다. 쓰는 사람이 알아야 할 건 딱 두 가지다.
 * 지금 어떤 카드를 꺼내야 하는가, 그리고 왜 그런가.
 */
function adviceFor(x: {
  spent: number;
  toThreshold: number;
  baseLimitReached: boolean;
  toBaseLimit: number;
}): { use: 'credit' | 'check'; why: string; advice: string } {
  if (x.spent <= 0) {
    return {
      use: 'credit',
      why: '아직 적으신 게 없어요. 한 줄 적어 보시면 바로 세어 드릴게요.',
      advice: '아직 적으신 게 없어요.',
    };
  }

  if (x.toThreshold > 0) {
    /*
      여기서 신용카드를 권하는 게 거꾸로 들릴 수 있다. 하지만 이 구간에서 쓴 돈은
      어차피 한 푼도 세금을 안 줄여 준다. 그러니 잃을 게 없고, 포인트·마일리지가
      붙는 카드를 쓰는 쪽이 그냥 이득이다. "체크카드를 쓰세요"는 이 금액을
      넘긴 다음에 할 말이다.
    */
    return {
      use: 'credit',
      why: `아직 ${formatKRW(Math.round(x.toThreshold))}을 더 써야 세금이 줄기 시작해요. 그때까진 뭘 쓰든 세금이 안 줄어드니, 포인트·마일리지 많이 주는 카드가 이득입니다.`,
      advice: `${formatKRW(Math.round(x.toThreshold))} 더 쓰면 세금이 줄기 시작합니다.`,
    };
  }

  if (x.baseLimitReached) {
    return {
      use: 'credit',
      why: '세금이 줄어드는 한도를 이미 다 채우셨어요. 더 써도 안 줄어드니, 이제부터는 포인트·마일리지 많이 주는 카드가 이득입니다.',
      advice: '한도를 다 채우셨어요.',
    };
  }

  return {
    use: 'check',
    why: `지금 쓰는 돈은 세금을 줄여 줍니다. 체크카드·현금영수증이 신용카드보다 두 배로 줄여 줘요. ${formatKRW(Math.round(x.toBaseLimit))}쯤 더 쓰면 한도가 찹니다.`,
    advice: `체크카드로 ${formatKRW(Math.round(x.toBaseLimit))} 더 쓰면 한도가 찹니다.`,
  };
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
    .filter((e) => e.purse === 'group')
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

/**
 * "커플 데이트비를 한 사람 신용카드로 몰아 쓰는 게 연말정산에 도움이 되나"
 *
 * 사장님이 하시려는 방식은 이렇다. 커플통장에 돈을 모아 두고, 한 달 데이트비를
 * 한 사람 신용카드로 다 긁고, 결제일에 커플통장에서 카드값을 갚는다.
 *
 * 먼저 짚을 것. 어느 통장에서 카드값이 빠져나가느냐는 연말정산과 아무 상관이 없다.
 * 공제는 '무엇으로 긁었나'와 '누구 명의인가'로만 갈린다. 커플통장에서 갚았다고
 * 둘이 나눠 공제받는 일은 없고, 긁은 카드 명의자 한 사람에게만 붙는다.
 *
 * 그래서 비교해야 할 것은 세 가지다.
 *  1) 지금 적어 두신 그대로
 *  2) 같은 데이트비를 같은 사람 체크카드·현금영수증으로 썼을 때
 *  3) 같은 데이트비를 둘이 반씩 체크카드로 썼을 때
 *
 * 공제율만 보면 체크카드가 두 배라 2번이 이기는 게 보통이지만, 문턱과 한도가
 * 걸리면 뒤집히기도 한다. 그래서 눈대중 말고 실제로 세어 본다.
 */
export type CoupleScenario = {
  key: 'asRecorded' | 'allCheck' | 'splitCheck';
  label: string;
  note: string;
  taxSaved: number;
  deduction: number;
};

export type CoupleComparison = {
  coupleSpent: number;
  /** 커플 데이트비를 신용카드로 긁은 금액 */
  coupleOnCredit: number;
  scenarios: CoupleScenario[];
  best: CoupleScenario;
  current: CoupleScenario;
  /** 지금 방식이 가장 나은 방식보다 얼마나 덜 돌려받는가. 0이면 지금이 최선이다. */
  lossVsBest: number;
  /** 데이트비가 아직 적어서 견줄 거리가 못 되는가 */
  tooSmall: boolean;
  verdict: string;
};

function taxOfPlan(
  entries: Entry[],
  mySalary: number,
  partnerSalary: number,
  rule: CardDeductionRule,
  payroll: PayrollRule,
): { taxSaved: number; deduction: number } {
  const me = summarizeHolder('me', '나', mySalary, entries, rule, payroll);
  const rows = [me];
  if (partnerSalary > 0) {
    rows.push(summarizeHolder('partner', '배우자', partnerSalary, entries, rule, payroll));
  }
  return {
    taxSaved: rows.reduce((sum, h) => sum + h.taxSaved, 0),
    deduction: rows.reduce((sum, h) => sum + h.deduction, 0),
  };
}

export function compareCoupleStrategies(input: LedgerSummaryInput): CoupleComparison | null {
  const asOf = input.asOf ?? toISODate(new Date());
  const rule = cardDeductionRule(asOf);
  const payroll = loadRule<PayrollRule>('payroll', asOf).rule.values;

  const entries = input.entries;
  const couple = entries.filter((e) => e.purse === 'group' && e.category !== 'excluded');
  if (couple.length === 0) return null;

  const coupleSpent = couple.reduce((sum, e) => sum + e.amount, 0);
  const coupleOnCredit = couple
    .filter((e) => e.method === 'credit')
    .reduce((sum, e) => sum + e.amount, 0);

  const mySalary = input.mySalary;
  const partnerSalary = input.partnerSalary ?? 0;
  const run = (rows: Entry[]) => taxOfPlan(rows, mySalary, partnerSalary, rule, payroll);

  /* 1) 적어 두신 그대로 */
  const asRecorded = run(entries);

  /*
    2) 데이트비를 전부 체크카드로. 명의는 그대로 둔다. 바꾸는 건 결제수단 하나뿐이라
       "카드만 바꿨을 때 얼마가 달라지나"를 깨끗하게 본다.
       전통시장·대중교통처럼 공제율이 따로 붙는 줄은 건드리지 않는다. 그쪽은
       결제수단이 아니라 어디서 썼느냐로 공제율이 정해지기 때문이다.
  */
  const allCheckRows = entries.map((e) =>
    e.purse === 'group' && e.category === 'general' ? { ...e, method: 'check' as const } : e,
  );
  const allCheck = run(allCheckRows);

  /* 3) 데이트비를 둘이 반씩 체크카드로. 배우자 소득이 없으면 볼 것도 없다. */
  const splitRows = entries.map((e, i) =>
    e.purse === 'group' && e.category === 'general'
      ? {
          ...e,
          method: 'check' as const,
          holder: i % 2 === 0 ? ('me' as const) : ('partner' as const),
        }
      : e,
  );
  const splitCheck = partnerSalary > 0 ? run(splitRows) : null;

  const scenarios: CoupleScenario[] = [
    {
      key: 'asRecorded',
      label: '지금 적어 두신 대로',
      note: coupleOnCredit > 0 ? '데이트비를 신용카드로 긁는 방식' : '지금 쓰시는 방식',
      ...asRecorded,
    },
    {
      key: 'allCheck',
      label: '데이트비를 체크카드로',
      note: '같은 사람 체크카드나 현금영수증으로 바꿨을 때',
      ...allCheck,
    },
    ...(splitCheck
      ? [
          {
            key: 'splitCheck' as const,
            label: '둘이 반씩 체크카드로',
            note: '데이트비를 번갈아 각자 체크카드로 썼을 때',
            ...splitCheck,
          },
        ]
      : []),
  ];

  const current = scenarios[0];
  const best = scenarios.reduce((a, b) => (b.taxSaved > a.taxSaved ? b : a));
  const lossVsBest = Math.max(0, best.taxSaved - current.taxSaved);

  /*
    세 방식이 같은 답을 내는 이유는 두 가지인데, 서로 전혀 다르다.
     - 한도를 이미 채웠다 → 뭘 더 긁든 세금이 안 줄어든다
     - 아직 세금이 줄기 시작하는 금액에 못 미친다 → 지금 쓰는 돈은 세금과 무관하다
    처음엔 둘을 구분하지 않고 늘 두 번째 설명을 내보냈다. 그래서 한도를 한참
    넘긴 분께 "문턱 안에서 긁은 신용카드는…"이라고 엉뚱한 말을 했다.
  */
  const people = [summarizeHolder('me', '나', mySalary, entries, rule, payroll)];
  if (partnerSalary > 0) {
    people.push(summarizeHolder('partner', '배우자', partnerSalary, entries, rule, payroll));
  }
  const limitReached = people.some((h) => h.spent > 0 && h.baseLimitReached);
  const belowThreshold = people.every((h) => h.spent <= 0 || h.toThreshold > 0);
  /*
    세 번째 경우. 문턱은 넘겼고 한도도 안 찼는데 답이 같을 때가 있다.
    신용카드로 긁은 금액이 통째로 문턱 아래에 들어앉아 있는 경우다.
    문턱은 공제율이 낮은 신용카드분부터 깎이므로, 신용카드분이 문턱보다 작으면
    그 돈은 전부 깎여 나가고 체크카드분은 손도 안 탄다. 그래서 신용을 체크로
    바꿔 봐야 공제가 한 푼도 안 달라진다.
  */
  const creditAbsorbed = people.every((h) => {
    if (h.spent <= 0) return true;
    const credit = entries
      .filter((e) => e.holder === h.holder && e.method === 'credit' && e.category !== 'excluded')
      .reduce((sum, e) => sum + e.amount, 0);
    return credit <= h.threshold;
  });

  /*
    데이트비가 전체에 견줘 아주 적으면 어떤 방식을 골라도 차이가 없는 게 당연하다.
    그걸 두고 "지금 방식이 가장 낫습니다"라고 하면 비교하지도 않은 걸 비교한 척하는
    것이다. 아직 비교할 거리가 아니라고 말해야 맞다.
  */
  const countable = people.reduce((sum, h) => sum + h.spent, 0);
  const tooSmall = coupleSpent < 100_000 || (countable > 0 && coupleSpent / countable < 0.03);

  return {
    coupleSpent,
    coupleOnCredit,
    scenarios,
    best,
    current,
    lossVsBest,
    tooSmall,
    verdict: verdictFor({
      lossVsBest,
      best,
      current,
      scenarios,
      coupleOnCredit,
      limitReached,
      belowThreshold,
      creditAbsorbed,
      tooSmall,
    }),
  };
}

/**
 * 비교 결과를 한 줄로.
 *
 * 말은 쉽게 쓴다. '최저사용금액', '공제율', '문턱'은 법에서 쓰는 말이지 사람이
 * 쓰는 말이 아니다. 그리고 같은 결과가 나와도 그 이유가 두 가지라서, 어느 쪽인지
 * 보고 맞는 설명을 골라야 한다.
 */
function verdictFor(x: {
  lossVsBest: number;
  best: CoupleScenario;
  current: CoupleScenario;
  scenarios: CoupleScenario[];
  coupleOnCredit: number;
  limitReached: boolean;
  belowThreshold: boolean;
  creditAbsorbed: boolean;
  tooSmall: boolean;
}): string {
  if (x.coupleOnCredit === 0) {
    return '데이트비를 신용카드로 긁고 계시지 않네요. 세금을 더 줄여 주는 쪽을 이미 쓰고 계십니다.';
  }

  if (x.tooSmall) {
    return '**아직 데이트비를 조금만 적으셔서 견줄 거리가 못 됩니다.** 한 달치쯤 적어 두시면 어느 쪽이 나은지 제대로 세어 드릴게요.';
  }

  if (x.lossVsBest === 0) {
    const worse = x.scenarios.find((s) => x.current.taxSaved - s.taxSaved >= 10000);

    /*
      한도를 채운 경우. 더 긁어도 세금이 안 줄어드니 카드 종류가 세금에는
      아무 영향이 없다. 남는 건 카드 혜택뿐이다.
    */
    const head = x.limitReached
      ? '**지금 방식 그대로 쓰셔도 됩니다.** 세금이 줄어드는 한도를 이미 다 채우셨어요. 그래서 데이트비를 신용카드로 긁든 체크카드로 긁든 세금은 똑같습니다. 포인트·마일리지 많이 주는 카드가 그만큼 이득이에요.'
      : x.belowThreshold
        ? /*
            아직 세금이 줄기 시작하는 금액에 못 미친 경우. 지금 쓰는 돈은 세금과
            무관하므로 신용카드를 써도 잃는 게 없다. "신용카드는 손해"라는 흔한
            오해 때문에 안 써도 될 손해를 보지 않게 이걸 말해 줘야 한다.
          */
          '**지금 방식이 가장 낫습니다.** 아직 세금이 줄기 시작하는 금액에 못 미쳐서, 지금 쓰는 돈은 어차피 세금을 안 줄여 줘요. 그러니 신용카드로 긁어도 잃는 게 없고, 포인트·마일리지만큼 그냥 버는 셈입니다.'
        : x.creditAbsorbed
          ? /*
              신용카드로 긁은 금액이 통째로 문턱 아래에 들어앉은 경우.
              그 돈은 어차피 전부 깎여 나가므로 체크카드로 바꿔도 달라질 게 없다.
            */
            '**지금 방식이 가장 낫습니다.** 신용카드로 긁으신 금액이 세금 계산에서 먼저 빠지는 몫에 통째로 들어가 있어요. 그래서 체크카드로 바꿔도 돌려받는 세금이 한 푼도 안 늘어납니다. 포인트·마일리지만큼 그냥 버는 셈이에요.'
          : '**지금 방식이 가장 낫습니다.** 체크카드로 바꿔도 돌려받는 세금이 늘지 않아요.';

    return worse
      ? `${head} 참고로 ${worse.label} 방식으로 바꾸면 오히려 ${formatKRW(Math.round(x.current.taxSaved - worse.taxSaved))} 덜 돌려받습니다.`
      : head;
  }

  if (x.lossVsBest < 10000) {
    return '지금 방식과 체크카드로 바꾸는 방식의 세금 차이가 거의 없어요. 카드 혜택이 좋다면 지금대로 쓰셔도 됩니다.';
  }

  return `지금 방식은 ${x.best.label} 방식보다 ${formatKRW(Math.round(x.lossVsBest))} 덜 돌려받습니다. 신용카드 혜택이 이 금액보다 크면 지금대로가 이득이고, 아니면 체크카드가 낫습니다.`;
}
