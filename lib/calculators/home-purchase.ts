import { loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { formatKRW, toISODate } from '@/lib/format';

/**
 * 집 살 때 실제로 나가는 돈.
 *
 * 사람들은 집값만 보고 예산을 짠다. 그런데 9억짜리 집을 사면 취득세만
 * 2,700만원이 넘고 중개보수까지 하면 3천만원 넘는 돈이 계약 며칠 사이에
 * 더 나간다. 잔금 치르는 날 모자라는 일이 실제로 생긴다.
 *
 * 부동산 가격이 얼마가 적정한지는 여기서 답하지 않는다. 그건 조문이 없다.
 * 여기서 답하는 것은 "이 가격에 사면 세금과 수수료가 얼마인가"뿐이다.
 */

type HeavyRate = {
  houses: number;
  regulated: boolean;
  rate: number | null;
  label: string;
  note?: string;
};

export type HomePurchaseRule = {
  acquisitionTax: {
    baseNote: string;
    lowerBound: number;
    upperBound: number;
    lowRate: number;
    highRate: number;
    heavyRates: HeavyRate[];
  };
  localEducationTax: { normalNote: string; heavyRate: number; heavyNote: string };
  ruralTax: {
    exemptAreaSqm: number;
    exemptNote: string;
    normalRate: number;
    byHeavyRate: { acquisitionRate: number; rate: number }[];
  };
  firstHomeRelief: {
    limit: number;
    priceCap: number;
    smallLimit: number;
    smallPriceCap: number;
    smallAreaSqm: number;
    effectiveTo: string;
    conditions: string[];
    clawback: string;
    note: string;
  };
  brokerFee: {
    region: string;
    regionNote: string;
    isCeiling: boolean;
    ceilingNote: string;
    vatNote: string;
    tiers: { upTo: number | null; rate: number; cap: number | null }[];
  };
  consult: { label: string; number: string; note: string };
};

export type HomePurchaseInput = {
  /** 사려는 집값 */
  price?: number;
  /** 사고 나면 우리 세대가 갖게 되는 주택 수 (이 집 포함) */
  housesAfter?: number;
  /** 사려는 집이 조정대상지역에 있는가 */
  regulated?: boolean;
  /** 전용면적 (제곱미터) */
  areaSqm?: number;
  /** 생애 처음 사는 집인가 */
  firstHome?: boolean;
  /** 중개보수를 직접 넣을 때 (협의해서 깎은 금액) */
  brokerFeeOverride?: number;
  asOf?: string;
};

export type HomePurchaseValue = {
  price: number;
  acquisitionRate: number;
  acquisitionTax: number;
  reliefApplied: number;
  localEducationTax: number;
  ruralTax: number;
  taxTotal: number;
  brokerFeeCeiling: number;
  brokerFee: number;
  brokerFeeVat: number;
  /** 집값 말고 더 있어야 하는 돈 */
  extraTotal: number;
  /** 집값 + 세금 + 수수료 */
  grandTotal: number;
  /** 집값 대비 몇 %가 더 드는가 */
  extraRate: number;
  heavyLabel: string | null;
  firstHomeEligible: boolean;
};

/** 6억~9억 구간은 가격에 따라 요율이 이어진다. 계단이 아니라 기울기다. */
function acquisitionRateFor(price: number, rule: HomePurchaseRule['acquisitionTax']): number {
  if (price <= rule.lowerBound) return rule.lowRate;
  if (price > rule.upperBound) return rule.highRate;
  const raw = ((price * 2) / 300000000 - 3) / 100;
  // 지방세법이 소수점 넷째자리까지 계산하라고 정해 두었다.
  return Math.round(raw * 10000) / 10000;
}

function brokerCeiling(price: number, rule: HomePurchaseRule['brokerFee']): number {
  const tier =
    rule.tiers.find((t) => t.upTo !== null && price < t.upTo) ?? rule.tiers[rule.tiers.length - 1];
  const raw = price * tier.rate;
  return Math.floor(tier.cap !== null ? Math.min(raw, tier.cap) : raw);
}

export function calcHomePurchase(input: HomePurchaseInput): CalcOutcome<HomePurchaseValue> {
  if (!input.price || input.price <= 0) {
    return missing<HomePurchaseValue>({
      field: 'price',
      label: '사려는 집값',
      hint: '계약서에 적는 매매가입니다. 여기에 세금과 수수료가 얼마나 더 붙는지 알려드려요.',
    });
  }

  const lookup = loadRule<HomePurchaseRule>('home-purchase', input.asOf ?? toISODate(new Date()));
  const rule = lookup.rule.values;
  const price = input.price;
  const houses = Math.max(1, input.housesAfter ?? 1);
  const regulated = input.regulated ?? false;
  const area = input.areaSqm;

  // 중과 여부. 표에서 주택 수와 지역이 맞는 줄을 찾는다.
  const heavy = rule.acquisitionTax.heavyRates.find(
    (h) => (h.houses === Math.min(houses, 4) || (h.houses === 4 && houses >= 4)) && h.regulated === regulated,
  );
  const heavyRate = heavy?.rate ?? null;

  const baseRate = acquisitionRateFor(price, rule.acquisitionTax);
  const acquisitionRate = heavyRate ?? baseRate;
  const acquisitionTaxBeforeRelief = Math.floor(price * acquisitionRate);

  /*
    생애최초 감면은 처음 사는 사람에게만, 가격 한도 안에서만 나온다.
    작은 집은 한도가 더 크다. 중과 대상이면 애초에 첫 집이 아니다.
  */
  const smallHouse =
    area !== undefined &&
    area <= rule.firstHomeRelief.smallAreaSqm &&
    price <= rule.firstHomeRelief.smallPriceCap;
  const firstHomeEligible =
    (input.firstHome ?? false) && houses === 1 && price <= rule.firstHomeRelief.priceCap;
  const reliefLimit = smallHouse ? rule.firstHomeRelief.smallLimit : rule.firstHomeRelief.limit;
  const reliefApplied = firstHomeEligible
    ? Math.min(reliefLimit, acquisitionTaxBeforeRelief)
    : 0;
  const acquisitionTax = acquisitionTaxBeforeRelief - reliefApplied;

  // 지방교육세: 중과면 0.4% 고정, 아니면 취득세율의 절반의 20%
  const eduRate = heavyRate !== null ? rule.localEducationTax.heavyRate : baseRate * 0.5 * 0.2;
  const localEducationTax = Math.floor(price * eduRate);

  // 농어촌특별세: 전용 85㎡ 이하는 안 붙는다
  const exemptByArea = area !== undefined && area <= rule.ruralTax.exemptAreaSqm;
  const ruralRate = exemptByArea
    ? 0
    : (rule.ruralTax.byHeavyRate.find((r) => r.acquisitionRate === heavyRate)?.rate ??
      rule.ruralTax.normalRate);
  const ruralTax = Math.floor(price * ruralRate);

  const taxTotal = acquisitionTax + localEducationTax + ruralTax;

  const brokerFeeCeiling = brokerCeiling(price, rule.brokerFee);
  const brokerFee = input.brokerFeeOverride ?? brokerFeeCeiling;
  const brokerFeeVat = Math.floor(brokerFee * 0.1);

  const extraTotal = taxTotal + brokerFee + brokerFeeVat;
  const grandTotal = price + extraTotal;

  const steps: CalcStep[] = [
    { label: '집값', formula: formatKRW(price), result: price, unit: 'KRW' },
    {
      label: '취득세',
      formula:
        heavyRate !== null
          ? `${formatKRW(price)} × ${(heavyRate * 100).toFixed(0)}% (중과)`
          : `${formatKRW(price)} × ${(baseRate * 100).toFixed(2)}%`,
      result: acquisitionTaxBeforeRelief,
      unit: 'KRW',
      note: heavy?.note ?? rule.acquisitionTax.baseNote,
    },
    ...(reliefApplied > 0
      ? [
          {
            label: '생애최초 감면',
            formula: `한도 ${formatKRW(reliefLimit)}`,
            result: -reliefApplied,
            unit: 'KRW' as const,
            note: rule.firstHomeRelief.clawback,
          },
        ]
      : []),
    {
      label: '지방교육세',
      formula: `${formatKRW(price)} × ${(eduRate * 100).toFixed(2)}%`,
      result: localEducationTax,
      unit: 'KRW',
      note:
        heavyRate !== null ? rule.localEducationTax.heavyNote : rule.localEducationTax.normalNote,
    },
    {
      label: '농어촌특별세',
      formula: exemptByArea
        ? `전용 ${area}㎡ — 면제`
        : area === undefined
          ? '전용면적을 넣으면 정확해집니다'
          : `${formatKRW(price)} × ${(ruralRate * 100).toFixed(1)}%`,
      result: ruralTax,
      unit: 'KRW',
      note: rule.ruralTax.exemptNote,
    },
    {
      label: '세금 합계',
      formula: `${formatKRW(acquisitionTax)} + ${formatKRW(localEducationTax)} + ${formatKRW(ruralTax)}`,
      result: taxTotal,
      unit: 'KRW',
    },
    {
      label: '중개보수 (상한)',
      formula: `${formatKRW(price)} 구간 상한요율 적용`,
      result: brokerFee,
      unit: 'KRW',
      note: rule.brokerFee.ceilingNote,
    },
    {
      label: '중개보수 부가세',
      formula: `${formatKRW(brokerFee)} × 10%`,
      result: brokerFeeVat,
      unit: 'KRW',
      note: rule.brokerFee.vatNote,
    },
    {
      label: '집값 말고 더 드는 돈',
      formula: `세금 ${formatKRW(taxTotal)} + 중개보수 ${formatKRW(brokerFee + brokerFeeVat)}`,
      result: extraTotal,
      unit: 'KRW',
    },
  ];

  const assumptions = [
    '계약서에 적는 매매가를 기준으로 계산했어요. 실제 과세표준은 시가표준액과 비교해 더 큰 쪽으로 정해집니다.',
    '중개보수는 조례상 상한으로 넣었어요. 협의해서 깎으면 그만큼 줄어듭니다.',
  ];

  const warnings: string[] = [
    '**법무사 보수, 인지세, 국민주택채권 할인비용은 넣지 않았어요.** 사람마다 달라서 계산할 수가 없습니다. 보통 수십만원에서 백만원대가 더 듭니다.',
    `중개보수 요율은 시·도 조례로 정합니다. ${rule.brokerFee.regionNote}`,
  ];

  if (area === undefined) {
    warnings.unshift(
      `**전용면적을 넣어주세요.** ${rule.ruralTax.exemptAreaSqm}㎡ 이하면 농어촌특별세가 안 붙는데, 안 넣으시면 붙는 것으로 계산합니다. 84㎡ 아파트는 면제 대상이에요.`,
    );
  }

  if (heavyRate !== null) {
    warnings.unshift(
      `**중과 대상입니다.** ${heavy?.label}이라 취득세율이 ${(heavyRate * 100).toFixed(0)}%입니다. 조정대상지역은 정부가 수시로 바꾸니 계약 전에 ${rule.consult.label}(${rule.consult.number})에 꼭 확인하세요.`,
    );
  }

  if ((input.firstHome ?? false) && !firstHomeEligible) {
    warnings.unshift(
      `생애최초 감면은 취득가액 ${formatKRW(rule.firstHomeRelief.priceCap)} 이하일 때만 나옵니다. 지금 넣으신 금액은 한도를 넘어서 빼지 않았어요.`,
    );
  }

  return ok({
    value: {
      price,
      acquisitionRate,
      acquisitionTax,
      reliefApplied,
      localEducationTax,
      ruralTax,
      taxTotal,
      brokerFeeCeiling,
      brokerFee,
      brokerFeeVat,
      extraTotal,
      grandTotal,
      extraRate: extraTotal / price,
      heavyLabel: heavy?.rate !== null && heavy !== undefined ? heavy.label : null,
      firstHomeEligible,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta],
  });
}
