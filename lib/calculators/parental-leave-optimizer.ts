import { fallbackWarning, loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { addMonths, formatKRW, formatManwon, parseDate, toISODate } from '@/lib/format';
import { findBracket, type Bracket, type ParentalLeaveRule } from './parental-leave';

/**
 * 7-2 6+6 부모육아휴직 조합 최적화기.
 *
 * 핵심은 특례 상한이 "부모가 각각 사용한 개월 수 중 짧은 쪽"까지만 적용된다는 점이다.
 * 한쪽이 12개월, 다른 쪽이 1개월을 쓰면 두 사람 모두 첫 1개월분만 특례를 받는다.
 * 그래서 "누가 몇 개월씩 쓰느냐"가 총액을 크게 바꾸고, 이 도구가 그 조합을 전부 계산한다.
 */

export type CoupleRule = {
  requiresBothParents: boolean;
  childAgeLimitMonths: number;
  maxSpecialMonths: number;
  rate: number;
  floor: number;
  capByMonth: { month: number; cap: number }[];
  simultaneousNotRequired: boolean;
  retroactiveNote: string;
};

export type CoupleLeaveInput = {
  myWage?: number;
  spouseWage?: number;
  /** 자녀 생년월일 또는 출산 예정일 */
  childBirthDate?: string;
  /** 각자 회사에서 쓸 수 있는 최대 개월 수 */
  myMaxMonths?: number;
  spouseMaxMonths?: number;
  /** 부부가 합쳐서 쓸 수 있는 총 개월 수. 정해두면 "어떻게 나눌지"가 진짜 문제가 된다. */
  totalMonthsBudget?: number;
  /** 두 사람이 같은 달에 함께 쉴 수 있는가 */
  allowOverlap?: boolean;
};

export type ParentMonth = {
  /** 본인 육아휴직 몇 개월차인지 */
  month: number;
  /** 그때 자녀는 몇 개월인지 */
  childMonthAge: number;
  amount: number;
  cap: number;
  rate: number;
  special: boolean;
};

export type ParentPlan = {
  who: 'me' | 'spouse';
  wage: number;
  startMonthAge: number;
  months: number;
  specialMonths: number;
  monthly: ParentMonth[];
  total: number;
};

export type CashflowMonth = {
  childMonthAge: number;
  me: number;
  spouse: number;
  household: number;
  bothOnLeave: boolean;
};

export type Combination = {
  id: string;
  me: ParentPlan;
  spouse: ParentPlan;
  total: number;
  specialMonths: number;
  cashflow: CashflowMonth[];
  /** 부부 합산 수령액이 가장 적은 달 */
  leanestMonth: CashflowMonth | null;
};

export type CoupleLeaveValue = {
  best: Combination;
  alternatives: Combination[];
  /** 같은 개월 수를 한 사람이 몰아 쓰는 경우 */
  soloBaseline: Combination;
  gainVsSolo: number;
  evaluated: number;
};

const MAX_START_MONTH_AGE = 24;

function capForSpecialMonth(rule: CoupleRule, month: number): number {
  const entry = rule.capByMonth.find((c) => c.month === month);
  if (!entry) throw new Error(`특례 ${month}개월차 상한액이 룰 파일에 없습니다.`);
  return entry.cap;
}

/** 자녀가 18개월이 되기 전에 들어가는 휴직 개월 수. 특례는 이 범위 안에서만 붙는다. */
function eligibleMonths(startMonthAge: number, months: number, limit: number): number {
  return Math.max(0, Math.min(months, limit - startMonthAge));
}

function buildPlan(
  who: 'me' | 'spouse',
  wage: number,
  startMonthAge: number,
  months: number,
  specialMonths: number,
  brackets: Bracket[],
  couple: CoupleRule,
): ParentPlan {
  const monthly: ParentMonth[] = [];
  for (let j = 1; j <= months; j += 1) {
    const special = j <= specialMonths;
    const rate = special ? couple.rate : findBracket(brackets, j).rate;
    const cap = special ? capForSpecialMonth(couple, j) : findBracket(brackets, j).cap;
    const floor = special ? couple.floor : findBracket(brackets, j).floor;
    const amount = Math.round(Math.max(Math.min(wage * rate, cap), floor));
    monthly.push({ month: j, childMonthAge: startMonthAge + j - 1, amount, cap, rate, special });
  }
  return {
    who,
    wage,
    startMonthAge,
    months,
    specialMonths,
    monthly,
    total: monthly.reduce((acc, m) => acc + m.amount, 0),
  };
}

/** 총액은 (통상임금, 개월 수, 특례 개월 수)만으로 정해진다. 시작 시점은 특례 개월 수를 통해서만 영향을 준다. */
function parentTotal(
  wage: number,
  months: number,
  specialMonths: number,
  brackets: Bracket[],
  couple: CoupleRule,
  memo: Map<string, number>,
): number {
  const key = `${wage}|${months}|${specialMonths}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  let total = 0;
  for (let j = 1; j <= months; j += 1) {
    const special = j <= specialMonths;
    const rate = special ? couple.rate : findBracket(brackets, j).rate;
    const cap = special ? capForSpecialMonth(couple, j) : findBracket(brackets, j).cap;
    const floor = special ? couple.floor : findBracket(brackets, j).floor;
    total += Math.round(Math.max(Math.min(wage * rate, cap), floor));
  }
  memo.set(key, total);
  return total;
}

function overlaps(aStart: number, aMonths: number, bStart: number, bMonths: number): boolean {
  if (aMonths === 0 || bMonths === 0) return false;
  return aStart < bStart + bMonths && bStart < aStart + aMonths;
}

function buildCombination(
  me: ParentPlan,
  spouse: ParentPlan,
  specialMonths: number,
): Combination {
  const ends = [me.startMonthAge + me.months, spouse.startMonthAge + spouse.months];
  const starts = [me.months > 0 ? me.startMonthAge : Infinity, spouse.months > 0 ? spouse.startMonthAge : Infinity];
  const from = Math.min(...starts);
  const to = Math.max(...ends);

  const cashflow: CashflowMonth[] = [];
  if (Number.isFinite(from)) {
    for (let age = from; age < to; age += 1) {
      const myAmount = me.monthly.find((m) => m.childMonthAge === age)?.amount ?? 0;
      const spouseAmount = spouse.monthly.find((m) => m.childMonthAge === age)?.amount ?? 0;
      cashflow.push({
        childMonthAge: age,
        me: myAmount,
        spouse: spouseAmount,
        household: myAmount + spouseAmount,
        bothOnLeave: myAmount > 0 && spouseAmount > 0,
      });
    }
  }

  const leanestMonth = cashflow.length
    ? cashflow.reduce((min, m) => (m.household < min.household ? m : min))
    : null;

  return {
    id: `${me.months}-${me.startMonthAge}_${spouse.months}-${spouse.startMonthAge}`,
    me,
    spouse,
    total: me.total + spouse.total,
    specialMonths,
    cashflow,
    leanestMonth,
  };
}

export function optimizeCoupleLeave(input: CoupleLeaveInput): CalcOutcome<CoupleLeaveValue> {
  const gaps = [];
  if (input.myWage === undefined || input.myWage <= 0) {
    gaps.push({
      field: 'myWage',
      label: '본인 월 통상임금',
      hint: '기본급 + 매달 고정으로 나오는 수당이에요. 대략이어도 괜찮으니 적어주세요.',
    });
  }
  if (input.spouseWage === undefined || input.spouseWage <= 0) {
    gaps.push({
      field: 'spouseWage',
      label: '배우자 월 통상임금',
      hint: '배우자 급여를 모르면 조합을 비교할 수 없어요. 두 사람의 임금 차이가 클수록 누가 먼저 쓰느냐가 중요해집니다.',
    });
  }
  if (!input.childBirthDate) {
    gaps.push({
      field: 'childBirthDate',
      label: '자녀 생년월일 (또는 출산 예정일)',
      hint: '특례는 생후 18개월 이내에 쓴 기간에만 붙어서, 아이 생일이 기준점이 돼요.',
    });
  }
  if (gaps.length > 0) return missing<CoupleLeaveValue>(...gaps);

  const myWage = input.myWage as number;
  const spouseWage = input.spouseWage as number;
  const childBirthDate = input.childBirthDate as string;
  const allowOverlap = input.allowOverlap ?? true;

  const generalLookup = loadRule<ParentalLeaveRule>('parental-leave', childBirthDate);
  const coupleLookup = loadRule<CoupleRule>('parental-leave-couple', childBirthDate);
  const general = generalLookup.rule.values;
  const couple = coupleLookup.rule.values;
  const brackets = general.brackets;

  const myMax = Math.min(input.myMaxMonths ?? general.maxMonthsBase, general.maxMonthsExtended);
  const spouseMax = Math.min(input.spouseMaxMonths ?? general.maxMonthsBase, general.maxMonthsExtended);
  const budget = input.totalMonthsBudget;

  const memo = new Map<string, number>();
  type Candidate = {
    myStart: number;
    myMonths: number;
    spouseStart: number;
    spouseMonths: number;
    specialMonths: number;
    total: number;
    leanest: number;
  };

  const bestBySplit = new Map<string, Candidate>();
  let evaluated = 0;

  for (let myMonths = 0; myMonths <= myMax; myMonths += 1) {
    for (let spouseMonths = 0; spouseMonths <= spouseMax; spouseMonths += 1) {
      if (myMonths === 0 && spouseMonths === 0) continue;
      if (budget !== undefined && myMonths + spouseMonths > budget) continue;

      for (let myStart = 0; myStart <= MAX_START_MONTH_AGE; myStart += 1) {
        if (myMonths === 0 && myStart > 0) break;
        for (let spouseStart = 0; spouseStart <= MAX_START_MONTH_AGE; spouseStart += 1) {
          if (spouseMonths === 0 && spouseStart > 0) break;
          if (!allowOverlap && overlaps(myStart, myMonths, spouseStart, spouseMonths)) continue;
          evaluated += 1;

          const bothUse = myMonths > 0 && spouseMonths > 0;
          const specialMonths = bothUse
            ? Math.min(
                couple.maxSpecialMonths,
                eligibleMonths(myStart, myMonths, couple.childAgeLimitMonths),
                eligibleMonths(spouseStart, spouseMonths, couple.childAgeLimitMonths),
              )
            : 0;

          const total =
            parentTotal(myWage, myMonths, specialMonths, brackets, couple, memo) +
            parentTotal(spouseWage, spouseMonths, specialMonths, brackets, couple, memo);

          // 같은 총액이면 부부가 동시에 쉬어 소득이 얇아지는 달이 적은 쪽을 택한다.
          const overlapMonths = allowOverlap
            ? Math.max(
                0,
                Math.min(myStart + myMonths, spouseStart + spouseMonths) - Math.max(myStart, spouseStart),
              )
            : 0;
          const leanest = -overlapMonths;

          const key = `${myMonths}|${spouseMonths}`;
          const prev = bestBySplit.get(key);
          const better =
            !prev ||
            total > prev.total ||
            (total === prev.total && leanest > prev.leanest) ||
            (total === prev.total &&
              leanest === prev.leanest &&
              myStart + spouseStart < prev.myStart + prev.spouseStart);
          if (better) {
            bestBySplit.set(key, {
              myStart,
              myMonths,
              spouseStart,
              spouseMonths,
              specialMonths,
              total,
              leanest,
            });
          }
        }
      }
    }
  }

  const ranked = [...bestBySplit.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.specialMonths !== a.specialMonths) return b.specialMonths - a.specialMonths;
    return a.myStart + a.spouseStart - (b.myStart + b.spouseStart);
  });

  if (ranked.length === 0) {
    return missing<CoupleLeaveValue>({
      field: 'totalMonthsBudget',
      label: '사용할 개월 수',
      hint: '조건이 너무 좁아서 가능한 조합이 하나도 없어요. 합산 개월 수를 늘리거나 동시 사용을 허용해 보세요.',
    });
  }

  const toCombination = (c: Candidate): Combination =>
    buildCombination(
      buildPlan('me', myWage, c.myStart, c.myMonths, c.specialMonths, brackets, couple),
      buildPlan('spouse', spouseWage, c.spouseStart, c.spouseMonths, c.specialMonths, brackets, couple),
      c.specialMonths,
    );

  const best = toCombination(ranked[0]);
  const alternatives = ranked.slice(1, 3).map(toCombination);

  // 같은 합산 개월 수를 통상임금이 높은 사람이 혼자 몰아 쓰는 경우 — 6+6을 모르고 흔히 택하는 방식이다.
  const totalMonths = best.me.months + best.spouse.months;
  const soloMonths = Math.min(totalMonths, general.maxMonthsExtended);
  const soloIsMe = myWage >= spouseWage;
  const soloWage = soloIsMe ? myWage : spouseWage;
  const soloPlan = buildPlan(soloIsMe ? 'me' : 'spouse', soloWage, 0, soloMonths, 0, brackets, couple);
  const emptyPlan = buildPlan(soloIsMe ? 'spouse' : 'me', soloIsMe ? spouseWage : myWage, 0, 0, 0, brackets, couple);
  const soloBaseline = buildCombination(
    soloIsMe ? soloPlan : emptyPlan,
    soloIsMe ? emptyPlan : soloPlan,
    0,
  );
  const gainVsSolo = best.total - soloBaseline.total;

  const birth = parseDate(childBirthDate);
  const steps: CalcStep[] = [
    {
      label: '가능한 조합 탐색',
      formula: `각자의 시작 시점(0~${MAX_START_MONTH_AGE}개월) × 사용 개월 수(0~${myMax} / 0~${spouseMax}개월)`,
      result: evaluated,
      unit: 'COUNT',
      note: '두 사람의 시작 시점과 기간을 모두 조합해 계산했어요.',
    },
    {
      label: '특례가 붙는 개월 수',
      formula: `min(${couple.maxSpecialMonths}, 본인 ${best.me.months}개월, 배우자 ${best.spouse.months}개월, 생후 ${couple.childAgeLimitMonths}개월 이내분)`,
      result: best.specialMonths,
      unit: 'MONTH',
      note: '특례 상한은 두 사람이 겹쳐 쓴 개월 수가 아니라, 각자 사용한 개월 수 중 짧은 쪽까지만 붙어요.',
    },
    {
      label: `본인 ${best.me.months}개월`,
      formula: best.me.monthly.map((m) => formatManwon(m.amount)).join(' + ') || '사용 안 함',
      result: best.me.total,
      unit: 'KRW',
      note: `자녀 ${best.me.startMonthAge}개월(${toISODate(addMonths(birth, best.me.startMonthAge))})부터 시작`,
      children: best.me.monthly.map((m) => ({
        label: `${m.month}개월차 (자녀 ${m.childMonthAge}개월)`,
        formula: `${m.special ? '특례' : '일반'} 상한 ${formatManwon(m.cap)}`,
        result: m.amount,
        unit: 'KRW' as const,
      })),
    },
    {
      label: `배우자 ${best.spouse.months}개월`,
      formula: best.spouse.monthly.map((m) => formatManwon(m.amount)).join(' + ') || '사용 안 함',
      result: best.spouse.total,
      unit: 'KRW',
      note: `자녀 ${best.spouse.startMonthAge}개월(${toISODate(addMonths(birth, best.spouse.startMonthAge))})부터 시작`,
      children: best.spouse.monthly.map((m) => ({
        label: `${m.month}개월차 (자녀 ${m.childMonthAge}개월)`,
        formula: `${m.special ? '특례' : '일반'} 상한 ${formatManwon(m.cap)}`,
        result: m.amount,
        unit: 'KRW' as const,
      })),
    },
    {
      label: '부부 합산 총 수령액',
      formula: `${formatKRW(best.me.total)} + ${formatKRW(best.spouse.total)}`,
      result: best.total,
      unit: 'KRW',
    },
    {
      label: `한 사람이 ${soloBaseline.me.months + soloBaseline.spouse.months}개월을 몰아 쓸 때와의 차이`,
      formula: `${formatKRW(best.total)} − ${formatKRW(soloBaseline.total)}`,
      result: gainVsSolo,
      unit: 'KRW',
      note: '같은 기간을 쉬어도 나눠 쓰면 이만큼 더 받습니다.',
    },
  ];

  const assumptions = [
    '두 사람 모두 고용보험에 가입돼 있고 육아휴직 급여 수급 요건을 채웠다고 봤어요.',
    '통상임금은 휴직 기간 내내 그대로라고 보고 계산했어요.',
    '개월 수는 딱 떨어지는 달로 계산했어요. 실제로는 시작일에 따라 첫 달과 마지막 달이 일할 계산됩니다.',
    couple.retroactiveNote,
  ];
  if (soloMonths < totalMonths) {
    assumptions.push(
      `비교 대상인 "한 사람이 몰아 쓰는 경우"는 급여가 나오는 최대 ${general.maxMonthsExtended}개월까지만 계산했어요.`,
    );
  }

  const warnings = [
    ...fallbackWarning(generalLookup),
    ...fallbackWarning(coupleLookup),
    '특례는 부모가 둘 다 육아휴직을 써야 붙어요. 한 사람만 쓰면 상한액이 오르지 않습니다.',
    `특례 상한은 두 사람이 각각 사용한 개월 수 중 짧은 쪽까지만 붙어요. 한쪽이 1개월만 쓰면 두 사람 모두 첫 1개월분만 오른 상한을 받습니다.`,
    '총액만 보고 정하면 위험해요. 부부가 같은 달에 함께 쉬면 그 달 가구 소득이 크게 줄어듭니다. 아래 월별 현금흐름을 꼭 같이 보세요.',
  ];
  if (best.leanestMonth && best.leanestMonth.bothOnLeave) {
    warnings.push(
      `이 조합에서는 자녀 ${best.leanestMonth.childMonthAge}개월 무렵 부부가 함께 쉬어 그 달 가구 수입이 ${formatManwon(best.leanestMonth.household)}까지 내려가요.`,
    );
  }

  return ok({
    value: { best, alternatives, soloBaseline, gainVsSolo, evaluated },
    steps,
    assumptions,
    warnings,
    basis: [coupleLookup.rule.meta, generalLookup.rule.meta],
  });
}
