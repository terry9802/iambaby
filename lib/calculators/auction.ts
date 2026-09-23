import { loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { formatKRW, toISODate } from '@/lib/format';
import { calcHomePurchase } from './home-purchase';

/**
 * 경매로 집을 살 때 실제로 드는 돈.
 *
 * 경매는 "감정가 6억짜리를 4억에 받았다"로 이야기되지만, 4억을 내고 끝나는
 * 일이 아니다. 취득세가 붙고, 살던 사람을 내보내야 하고, 밀린 관리비를
 * 떠안고, 잔금을 한 달 안에 마련해야 한다. 그 돈을 다 세어야 진짜 낙찰가다.
 *
 * 여기서 "얼마에 받으면 이득인지"는 답하지 않는다. 그건 시세 판단이고 조문이
 * 없다. 답하는 것은 "이 가격에 받으면 총 얼마가 드는가"뿐이다.
 */

export type AuctionRule = {
  depositRate: number;
  depositNote: string;
  depositExceptionNote: string;
  paymentDeadlineDays: number;
  paymentDeadlineNote: string;
  unpaidNote: string;
  recoverNote: string;
  discountOptions: { rate: number; label: string; note: string }[];
  discountNote: string;
  checklist: { id: string; title: string; body: string; where: string }[];
  consult: { label: string; number: string; note: string };
};

export type AuctionInput = {
  /** 감정평가액 */
  appraised?: number;
  /** 이번 기일의 최저매각가격 */
  minimumPrice?: number;
  /** 얼마에 쓸 것인가 */
  bid?: number;
  /** 전용면적 (제곱미터) */
  areaSqm?: number;
  /** 낙찰받고 나면 우리 세대가 갖게 되는 집 수 */
  housesAfter?: number;
  regulated?: boolean;
  /** 이사비 등 내보내는 데 드는 돈 */
  evictionCost?: number;
  /** 떠안게 될 체납 관리비 */
  unpaidDues?: number;
  asOf?: string;
};

export type AuctionValue = {
  bid: number;
  deposit: number;
  /** 낙찰 뒤 기한 안에 내야 하는 잔금 */
  balance: number;
  tax: number;
  evictionCost: number;
  unpaidDues: number;
  /** 낙찰가 말고 더 드는 돈 */
  extraTotal: number;
  /** 다 합쳐 실제로 드는 돈 */
  grandTotal: number;
  /** 감정가 대비 총비용이 몇 %인가 */
  vsAppraised: number | null;
  /** 감정가 대비 낙찰가가 몇 %인가 */
  bidRate: number | null;
  paymentDeadlineDays: number;
};

export function calcAuction(input: AuctionInput): CalcOutcome<AuctionValue> {
  if (!input.bid || input.bid <= 0) {
    return missing<AuctionValue>({
      field: 'bid',
      label: '입찰가 (얼마에 쓸 것인가)',
      hint: '최저매각가격 이상이어야 합니다. 이 금액에 받으면 총 얼마가 드는지 세어드려요.',
    });
  }

  const asOf = input.asOf ?? toISODate(new Date());
  const lookup = loadRule<AuctionRule>('auction', asOf);
  const rule = lookup.rule.values;

  const bid = input.bid;
  const minimumPrice = input.minimumPrice ?? bid;
  const deposit = Math.floor(minimumPrice * rule.depositRate);
  const balance = bid - deposit;

  /*
    경매로 사도 취득세는 일반 매매와 같은 유상취득이다. 계산기를 따로 만들지
    않고 집 살 때 계산기를 그대로 부른다. 중개사를 안 끼므로 중개보수만 0으로 둔다.
  */
  const purchase = calcHomePurchase({
    price: bid,
    housesAfter: input.housesAfter,
    regulated: input.regulated,
    areaSqm: input.areaSqm,
    brokerFeeOverride: 0,
    asOf,
  });
  const tax = purchase.ok ? purchase.result.value.taxTotal : 0;

  const evictionCost = Math.max(0, input.evictionCost ?? 0);
  const unpaidDues = Math.max(0, input.unpaidDues ?? 0);

  const extraTotal = tax + evictionCost + unpaidDues;
  const grandTotal = bid + extraTotal;

  const appraised = input.appraised;
  const vsAppraised = appraised && appraised > 0 ? grandTotal / appraised : null;
  const bidRate = appraised && appraised > 0 ? bid / appraised : null;

  const steps: CalcStep[] = [
    { label: '입찰가', formula: formatKRW(bid), result: bid, unit: 'KRW' },
    {
      label: '입찰보증금 (입찰할 때 내는 돈)',
      formula: `최저매각가격 ${formatKRW(minimumPrice)} × ${rule.depositRate * 100}%`,
      result: deposit,
      unit: 'KRW',
      note: rule.depositNote,
    },
    {
      label: `잔금 (${rule.paymentDeadlineDays}일 안에 내야 하는 돈)`,
      formula: `${formatKRW(bid)} − 보증금 ${formatKRW(deposit)}`,
      result: balance,
      unit: 'KRW',
      note: rule.paymentDeadlineNote,
    },
    {
      label: '취득세 · 지방교육세 · 농어촌특별세',
      formula: purchase.ok
        ? `${formatKRW(bid)} × ${(purchase.result.value.acquisitionRate * 100).toFixed(2)}% 외`
        : '계산 불가',
      result: tax,
      unit: 'KRW',
      note: '경매로 받아도 세금은 일반 매매와 같습니다.',
    },
    ...(evictionCost > 0
      ? [
          {
            label: '내보내는 데 드는 돈',
            formula: '직접 넣으신 금액',
            result: evictionCost,
            unit: 'KRW' as const,
            note: '협의가 안 되면 인도명령이나 명도소송으로 갑니다. 시간도 돈입니다.',
          },
        ]
      : []),
    ...(unpaidDues > 0
      ? [
          {
            label: '떠안는 체납 관리비',
            formula: '직접 넣으신 금액',
            result: unpaidDues,
            unit: 'KRW' as const,
            note: '공용부분 체납액은 낙찰자가 냅니다.',
          },
        ]
      : []),
    {
      label: '낙찰가 말고 더 드는 돈',
      formula: `세금 ${formatKRW(tax)}${evictionCost > 0 ? ` + 명도 ${formatKRW(evictionCost)}` : ''}${unpaidDues > 0 ? ` + 관리비 ${formatKRW(unpaidDues)}` : ''}`,
      result: extraTotal,
      unit: 'KRW',
    },
    {
      label: '다 합쳐서',
      formula: `${formatKRW(bid)} + ${formatKRW(extraTotal)}`,
      result: grandTotal,
      unit: 'KRW',
      note:
        vsAppraised !== null
          ? `감정가 ${formatKRW(appraised as number)}의 ${(vsAppraised * 100).toFixed(1)}%입니다.`
          : undefined,
    },
  ];

  const assumptions = [
    '법무사 보수와 등기 비용, 경락잔금대출 이자는 넣지 않았어요. 사람과 물건마다 달라서 계산할 수가 없습니다.',
    '명도비와 체납 관리비는 직접 넣으신 금액을 그대로 더했어요. 저희가 알아낼 수 있는 값이 아닙니다.',
  ];

  const warnings: string[] = [
    `**잔금 기한이 ${rule.paymentDeadlineDays}일뿐입니다.** ${rule.paymentDeadlineNote}`,
    `**기한을 넘기면 보증금 ${formatKRW(deposit)}을 잃습니다.** ${rule.unpaidNote} ${rule.recoverNote}`,
    `**입찰 전에 매각물건명세서·현황조사서·감정평가서를 꼭 읽으세요.** ${rule.consult.label}에서 무료로 볼 수 있습니다. 선순위 임차인이 있으면 낙찰가 외에 보증금을 물어줘야 할 수 있어요.`,
    rule.depositExceptionNote,
  ];

  if (evictionCost === 0) {
    warnings.push(
      '**명도비를 0원으로 계산했어요.** 지금 살고 있는 사람이 순순히 나가는 경우는 많지 않습니다. 이사비로 몇백만원을 얹어 주는 일이 흔해요.',
    );
  }

  if (input.minimumPrice === undefined) {
    warnings.push(
      '최저매각가격을 안 넣으셔서 입찰가와 같다고 보고 보증금을 셌어요. 실제 보증금은 매각공고의 최저매각가격 기준입니다.',
    );
  }

  return ok({
    value: {
      bid,
      deposit,
      balance,
      tax,
      evictionCost,
      unpaidDues,
      extraTotal,
      grandTotal,
      vsAppraised,
      bidRate,
      paymentDeadlineDays: rule.paymentDeadlineDays,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta, ...(purchase.ok ? purchase.result.basis : [])],
  });
}

/** 유찰이 거듭되면 최저매각가격이 어떻게 내려가는지. 법원이 정한 비율을 넣어 쓴다. */
export function failedRoundPrices(
  appraised: number,
  discountRate: number,
  rounds = 4,
): { round: number; price: number }[] {
  /*
    법원은 직전 기일의 최저가에서 다시 깎는다. 처음 값에 거듭제곱을 곱하면
    부동소수점 오차가 쌓여 49,999만 9,999원 같은 값이 나온다. 한 번 깎을 때마다
    반올림해 다음 회차로 넘긴다.
  */
  const out: { round: number; price: number }[] = [];
  let price = Math.round(appraised);
  for (let i = 0; i <= rounds; i++) {
    out.push({ round: i, price });
    price = Math.round(price * (1 - discountRate));
  }
  return out;
}

export function auctionChecklist(asOf?: string): AuctionRule['checklist'] {
  return loadRule<AuctionRule>('auction', asOf ?? toISODate(new Date())).rule.values.checklist;
}

export function auctionRule(asOf?: string): AuctionRule {
  return loadRule<AuctionRule>('auction', asOf ?? toISODate(new Date())).rule.values;
}
