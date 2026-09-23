import { loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { diffDays, formatDate, formatKRW, parseDate, toISODate } from '@/lib/format';

/**
 * 증여세 계산기.
 *
 * 사람들이 실제로 틀리는 지점은 세율이 아니라 두 가지다.
 * 하나는 공제가 "사람마다"가 아니라 "관계마다 10년"이라는 것. 아버지에게 5,000만원을
 * 받았으면 어머니에게는 더 받을 공제가 없다. 둘 다 직계존속이기 때문이다.
 * 다른 하나는 신고기한. 증여받은 날이 아니라 그 달의 말일부터 3개월이다.
 */

export type GiftRelationship = {
  code: string;
  label: string;
  deduction: number;
  /** 받는 사람이 미성년자일 때의 한도 (직계존속만 다르다) */
  minorDeduction?: number;
  note: string;
};

export type GiftTaxRule = {
  relationships: GiftRelationship[];
  marriageBirthDeduction: {
    limit: number;
    onlyFrom: string;
    windowNote: string;
    note: string;
  };
  taxBrackets: { upTo: number | null; rate: number; progressiveDeduction: number }[];
  filingCreditRate: number;
  filingDeadlineMonths: number;
  filingDeadlineNote: string;
  lookbackYears: number;
  consult: { label: string; number: string; note: string };
};

export type GiftTaxInput = {
  /** 이번에 받는(받은) 금액 */
  amount?: number;
  /** 준 사람과의 관계 */
  relationship?: string;
  /** 받는 사람이 미성년자인가 */
  minor?: boolean;
  /** 최근 10년 안에 같은 관계에서 이미 받은 금액 */
  priorGifts?: number;
  /** 혼인·출산 공제를 쓸 수 있는가 (직계존속에게서 혼인·출산 전후 2년 안에 받는 경우) */
  marriageBirth?: boolean;
  /** 혼인·출산 공제를 예전에 이미 쓴 금액 */
  marriageBirthUsed?: number;
  /** 증여받은 날. 신고기한을 세는 데 쓴다. */
  giftDate?: string;
  today?: string;
};

export type GiftTaxValue = {
  taxableAmount: number;
  relationshipDeduction: number;
  marriageBirthDeduction: number;
  taxBase: number;
  grossTax: number;
  filingCredit: number;
  finalTax: number;
  /** 세금 없이 더 받을 수 있는 여유분 */
  headroom: number;
  effectiveRate: number;
  relationshipLabel: string;
  filingDueAt: string | null;
  filingDDay: number | null;
  filingPassed: boolean;
};

/** 과세표준이 속한 구간을 찾아 (표준 × 세율 − 누진공제)로 센다. 국세청 계산과 같은 방식이다. */
function taxFor(base: number, rule: GiftTaxRule): { tax: number; rate: number; deduction: number } {
  if (base <= 0) return { tax: 0, rate: 0, deduction: 0 };
  const bracket =
    rule.taxBrackets.find((b) => b.upTo !== null && base <= b.upTo) ??
    rule.taxBrackets[rule.taxBrackets.length - 1];
  const tax = Math.max(0, base * bracket.rate - bracket.progressiveDeduction);
  return { tax, rate: bracket.rate, deduction: bracket.progressiveDeduction };
}

/**
 * 증여받은 날이 속하는 달의 말일부터 3개월.
 * "받은 날부터 3개월"로 잘못 세는 사람이 많아 계산기가 날짜를 직접 잡아준다.
 *
 * 말일 다음 날부터 세어 3개월 뒤의 전날이 기한이다(민법의 초일불산입). 말일에 달을
 * 더하면 2월처럼 날짜 수가 다른 달에서 어긋나는데, 항상 1일에서 출발하면 그 문제가 없다.
 * 1월 증여는 4월 30일, 3월 증여는 6월 30일, 4월 증여는 7월 31일이 된다.
 */
function filingDueDate(giftDate: Date, months: number): Date {
  const firstOfNextMonth = new Date(giftDate.getFullYear(), giftDate.getMonth() + 1, 1);
  const after = new Date(firstOfNextMonth);
  after.setMonth(after.getMonth() + months);
  return new Date(after.getFullYear(), after.getMonth(), after.getDate() - 1);
}

export function calcGiftTax(input: GiftTaxInput): CalcOutcome<GiftTaxValue> {
  if (!input.amount || input.amount <= 0) {
    return missing<GiftTaxValue>({
      field: 'amount',
      label: '이번에 받는 금액',
      hint: '현금이면 그 금액, 부동산이나 주식이면 증여일 기준 평가액을 넣어주세요.',
    });
  }

  const giftDateIso = input.giftDate ?? toISODate(new Date());
  const lookup = loadRule<GiftTaxRule>('gift-tax', giftDateIso);
  const rule = lookup.rule.values;
  const today = input.today ? parseDate(input.today) : new Date();

  const relationship =
    rule.relationships.find((r) => r.code === input.relationship) ?? rule.relationships[1];

  const minor = input.minor ?? false;
  const limit =
    minor && relationship.minorDeduction !== undefined
      ? relationship.minorDeduction
      : relationship.deduction;

  const prior = Math.max(0, input.priorGifts ?? 0);
  const taxableAmount = input.amount + prior;

  // 공제는 10년을 합쳐 한도가 정해지므로, 예전에 쓴 만큼은 이미 없어졌다.
  const relationshipDeduction = Math.min(limit, taxableAmount);

  const mbRule = rule.marriageBirthDeduction;
  const mbEligible = (input.marriageBirth ?? false) && relationship.code === mbRule.onlyFrom;
  const mbUsed = Math.max(0, input.marriageBirthUsed ?? 0);
  const mbRoom = Math.max(0, mbRule.limit - mbUsed);
  const marriageBirthDeduction = mbEligible
    ? Math.min(mbRoom, Math.max(0, taxableAmount - relationshipDeduction))
    : 0;

  const taxBase = Math.max(0, taxableAmount - relationshipDeduction - marriageBirthDeduction);
  const { tax: grossTaxRaw, rate, deduction } = taxFor(taxBase, rule);
  const grossTax = Math.floor(grossTaxRaw);
  const filingCredit = Math.floor(grossTax * rule.filingCreditRate);
  const finalTax = grossTax - filingCredit;

  // 세금 한 푼 안 내고 더 받을 수 있는 여유분. "얼마까지 괜찮아요?"가 사람들이 진짜 묻는 것이다.
  const totalRoom = limit + (mbEligible ? mbRoom : 0);
  const headroom = Math.max(0, totalRoom - taxableAmount);
  const effectiveRate = input.amount > 0 ? finalTax / input.amount : 0;

  const giftDate = parseDate(giftDateIso);
  const due = filingDueDate(giftDate, rule.filingDeadlineMonths);
  const filingDDay = diffDays(today, due);

  const steps: CalcStep[] = [
    {
      label: '이번에 받는 금액',
      formula: formatKRW(input.amount),
      result: input.amount,
      unit: 'KRW',
    },
    ...(prior > 0
      ? [
          {
            label: `최근 ${rule.lookbackYears}년 안에 이미 받은 금액`,
            formula: `${formatKRW(input.amount)} + ${formatKRW(prior)}`,
            result: taxableAmount,
            unit: 'KRW' as const,
            note: `${rule.lookbackYears}년 안에 같은 관계에서 받은 것은 모두 합쳐서 한 번에 받은 것처럼 봅니다.`,
          },
        ]
      : []),
    {
      label: `증여재산공제 (${relationship.label})`,
      formula: minor && relationship.minorDeduction !== undefined
        ? `미성년자 한도 ${formatKRW(limit)}`
        : `한도 ${formatKRW(limit)}`,
      result: -relationshipDeduction,
      unit: 'KRW',
      note: relationship.note,
    },
    ...(mbEligible
      ? [
          {
            label: '혼인 · 출산 증여재산공제',
            formula:
              mbUsed > 0
                ? `한도 ${formatKRW(mbRule.limit)} − 이미 쓴 ${formatKRW(mbUsed)}`
                : `한도 ${formatKRW(mbRule.limit)}`,
            result: -marriageBirthDeduction,
            unit: 'KRW' as const,
            note: mbRule.note,
          },
        ]
      : []),
    {
      label: '과세표준',
      formula: `${formatKRW(taxableAmount)} − 공제 ${formatKRW(relationshipDeduction + marriageBirthDeduction)}`,
      result: taxBase,
      unit: 'KRW',
    },
    {
      label: '산출세액',
      formula:
        taxBase <= 0
          ? '과세표준이 0원이라 세금이 없습니다'
          : `${formatKRW(taxBase)} × ${Math.round(rate * 100)}% − 누진공제 ${formatKRW(deduction)}`,
      result: grossTax,
      unit: 'KRW',
      note:
        taxBase > 0
          ? '전체 금액에 구간 세율을 곱한 뒤 누진공제를 빼는 방식입니다. 구간별로 나눠 더하지 않아요.'
          : undefined,
    },
    ...(grossTax > 0
      ? [
          {
            label: `신고세액공제 (${Math.round(rule.filingCreditRate * 100)}%)`,
            formula: `${formatKRW(grossTax)} × ${Math.round(rule.filingCreditRate * 100)}%`,
            result: -filingCredit,
            unit: 'KRW' as const,
            note: '기한 안에 스스로 신고하면 세금의 3%를 깎아줍니다. 안 하면 이만큼 손해고 가산세까지 붙어요.',
          },
        ]
      : []),
    {
      label: '낼 세금',
      formula: grossTax > 0 ? `${formatKRW(grossTax)} − ${formatKRW(filingCredit)}` : '0원',
      result: finalTax,
      unit: 'KRW',
    },
  ];

  const assumptions = [
    '현금처럼 평가액이 분명한 재산으로 보고 계산했어요. 부동산이나 비상장주식은 평가 방법에 따라 금액이 달라집니다.',
    '기한 안에 스스로 신고한다고 보고 신고세액공제를 넣었어요.',
  ];

  const warnings: string[] = [];

  if (filingDDay >= 0) {
    warnings.push(
      `신고기한은 **${formatDate(due)}**까지예요. ${rule.filingDeadlineNote} 오늘부터 ${filingDDay}일 남았습니다.`,
    );
  } else {
    warnings.push(
      `**신고기한(${formatDate(due)})이 ${Math.abs(filingDDay)}일 지났습니다.** 지금이라도 신고하는 쪽이 가산세가 적습니다. ${rule.consult.label}(${rule.consult.number})에 먼저 물어보세요.`,
    );
  }

  warnings.push(
    `공제 한도는 사람마다가 아니라 **관계마다 ${rule.lookbackYears}년을 합쳐서** 봅니다. 아버지에게 ${formatKRW(50000000)}을 받았으면 어머니에게는 더 받을 공제가 없어요.`,
  );

  if (mbEligible) {
    warnings.push(`혼인·출산 공제는 ${mbRule.windowNote} 기간을 넘기면 받을 수 없습니다.`);
  } else if (relationship.code === mbRule.onlyFrom && !(input.marriageBirth ?? false)) {
    warnings.push(
      `결혼이나 출산 전후 2년 안이라면 **${formatKRW(mbRule.limit)}을 더 공제**받을 수 있어요. 해당되면 위에서 켜고 다시 보세요.`,
    );
  }

  warnings.push(
    '세대생략 할증(손주에게 바로 주면 30~40%가 더 붙습니다)과 창업자금·가업승계 특례세율은 이 계산기에 넣지 않았어요.',
  );

  return ok({
    value: {
      taxableAmount,
      relationshipDeduction,
      marriageBirthDeduction,
      taxBase,
      grossTax,
      filingCredit,
      finalTax,
      headroom,
      effectiveRate,
      relationshipLabel: relationship.label,
      filingDueAt: toISODate(due),
      filingDDay,
      filingPassed: filingDDay < 0,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta],
  });
}

/** 화면의 관계 선택지. 룰 파일에서 그대로 뽑는다. */
export function listGiftRelationships(asOf: string): GiftRelationship[] {
  return loadRule<GiftTaxRule>('gift-tax', asOf).rule.values.relationships;
}
