import { loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { formatKRW, formatPercent } from '@/lib/format';

/**
 * 신혼부부전용 전세자금 대출 자격 판정기.
 *
 * 금리표는 소득 구간 × 보증금 구간으로 나뉘어 있고 공개 페이지에 표로만 있다.
 * 확인하지 못한 표를 옮겨 적는 대신, 요건 통과 여부와 한도를 정확히 답하고
 * 금리는 범위로만 보여준다. 정확한 금리는 은행 상담에서 정해진다.
 */

export type Region = 'capital' | 'other';

export type JeonseLoanRule = {
  incomeLimit: number;
  netAssetLimit: number;
  marriageYearsLimit: number;
  preMarriageMonths: number;
  requiresNoHome: boolean;
  loanLimit: Record<Region, number>;
  depositCeiling: Record<Region, number>;
  loanToDepositRatio: number;
  rateRange: { min: number; max: number };
  preferential: { key: string; label: string; value: number }[];
  termYears: number;
  maxTermYears: number;
  repayment: string;
  capitalAreaNote: string;
};

export type JeonseLoanInput = {
  /** 부부합산 연소득 */
  householdIncome?: number;
  /** 부부합산 순자산 */
  netAsset?: number;
  /** 혼인 기간(년). 아직 결혼 전이면 0 */
  marriedYears?: number;
  /** 3개월 이내 결혼 예정인가 */
  marryingSoon?: boolean;
  noHome?: boolean;
  region?: Region;
  /** 전세 보증금 */
  deposit?: number;
  children?: number;
  eContract?: boolean;
  /** 은행에서 안내받은 실제 금리(연). 넣으면 범위 대신 이 값으로 계산한다. */
  rateOverride?: number;
  asOf?: string;
};

export type LoanCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

export type JeonseLoanValue = {
  eligible: boolean;
  checks: LoanCheck[];
  /** 빌릴 수 있는 최대 금액 */
  maxLoan: number;
  /** 내가 따로 마련해야 하는 금액 */
  ownFunds: number;
  rateMin: number;
  rateMax: number;
  discount: number;
  monthlyInterestMin: number;
  monthlyInterestMax: number;
  /** 사용자가 직접 넣은 금리를 썼는가 */
  usedOwnRate: boolean;
};

export function checkNewlywedJeonseLoan(
  input: JeonseLoanInput,
): CalcOutcome<JeonseLoanValue> {
  const gaps = [];
  if (input.deposit === undefined || input.deposit <= 0) {
    gaps.push({
      field: 'deposit',
      label: '전세 보증금',
      hint: '계약하려는 집의 전세금이에요. 아직 안 정하셨으면 알아보고 있는 금액을 넣어보세요.',
    });
  }
  if (input.householdIncome === undefined) {
    gaps.push({
      field: 'householdIncome',
      label: '부부합산 연소득 (세전)',
      hint: '두 사람의 세전 연봉을 더한 금액이에요. 이 금액이 요건을 넘으면 대출 자체가 안 됩니다.',
    });
  }
  if (gaps.length > 0) return missing<JeonseLoanValue>(...gaps);

  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const lookup = loadRule<JeonseLoanRule>('newlywed-jeonse-loan', asOf);
  const rule = lookup.rule.values;

  const deposit = input.deposit as number;
  const income = input.householdIncome as number;
  const netAsset = input.netAsset ?? 0;
  const marriedYears = input.marriedYears ?? 0;
  const marryingSoon = input.marryingSoon ?? false;
  const noHome = input.noHome ?? true;
  const region: Region = input.region ?? 'capital';
  const children = Math.max(0, Math.floor(input.children ?? 0));

  const regionLabel = region === 'capital' ? '수도권' : '수도권 외';

  const checks: LoanCheck[] = [
    {
      label: '부부합산 연소득',
      passed: income <= rule.incomeLimit,
      detail: `${formatKRW(income)} / 기준 ${formatKRW(rule.incomeLimit)} 이하`,
    },
    {
      label: '부부합산 순자산',
      passed: netAsset <= rule.netAssetLimit,
      detail: `${formatKRW(netAsset)} / 기준 ${formatKRW(rule.netAssetLimit)} 이하`,
    },
    {
      label: '혼인 기간',
      passed: marryingSoon || (marriedYears >= 0 && marriedYears <= rule.marriageYearsLimit),
      detail: marryingSoon
        ? `${rule.preMarriageMonths}개월 이내 결혼 예정`
        : `혼인 ${marriedYears}년 / 기준 ${rule.marriageYearsLimit}년 이내`,
    },
    {
      label: '무주택 세대주',
      passed: noHome,
      detail: noHome ? '집이 없음' : '주택을 보유 중이면 받을 수 없습니다',
    },
    {
      label: `${regionLabel} 보증금 한도`,
      passed: deposit <= rule.depositCeiling[region],
      detail: `${formatKRW(deposit)} / 기준 ${formatKRW(rule.depositCeiling[region])} 이하`,
    },
  ];

  const eligible = checks.every((c) => c.passed);

  const byRatio = Math.floor(deposit * rule.loanToDepositRatio);
  const byRegion = rule.loanLimit[region];
  const maxLoan = eligible ? Math.min(byRatio, byRegion) : 0;
  const ownFunds = Math.max(0, deposit - maxLoan);

  const childDiscount =
    children >= 3
      ? rule.preferential.find((p) => p.key === 'child3')!.value
      : children === 2
        ? rule.preferential.find((p) => p.key === 'child2')!.value
        : children === 1
          ? rule.preferential.find((p) => p.key === 'child1')!.value
          : 0;
  const eContractDiscount = input.eContract
    ? rule.preferential.find((p) => p.key === 'eContract')!.value
    : 0;
  const discount = childDiscount + eContractDiscount;

  const usedOwnRate = input.rateOverride !== undefined && input.rateOverride > 0;
  const rateMin = usedOwnRate
    ? (input.rateOverride as number)
    : Math.max(0.01, rule.rateRange.min - discount);
  const rateMax = usedOwnRate
    ? (input.rateOverride as number)
    : Math.max(0.01, rule.rateRange.max - discount);
  const monthlyInterestMin = Math.round((maxLoan * rateMin) / 12);
  const monthlyInterestMax = Math.round((maxLoan * rateMax) / 12);

  const steps: CalcStep[] = [
    {
      label: '보증금의 80%까지',
      formula: `${formatKRW(deposit)} × 80%`,
      result: byRatio,
      unit: 'KRW',
    },
    {
      label: `${regionLabel} 대출 한도`,
      formula: '상품에 정해진 최대 금액',
      result: byRegion,
      unit: 'KRW',
    },
    {
      label: '빌릴 수 있는 금액',
      formula: eligible
        ? `둘 중 작은 값 (${formatKRW(byRatio)}, ${formatKRW(byRegion)})`
        : '요건을 못 채워 대출이 되지 않습니다',
      result: maxLoan,
      unit: 'KRW',
    },
    {
      label: '내가 따로 마련할 금액',
      formula: `${formatKRW(deposit)} − ${formatKRW(maxLoan)}`,
      result: ownFunds,
      unit: 'KRW',
      note: '보증금에서 대출금을 뺀 나머지입니다. 여기에 중개수수료와 이사비가 더 듭니다.',
    },
  ];

  if (discount > 0) {
    steps.push({
      label: '우대금리',
      formula: [
        childDiscount > 0 ? `자녀 ${children}명 −${formatPercent(childDiscount)}p` : '',
        eContractDiscount > 0 ? `전자계약 −${formatPercent(eContractDiscount)}p` : '',
      ]
        .filter(Boolean)
        .join(' + '),
      result: discount,
      unit: 'RATIO',
    });
  }
  if (eligible) {
    steps.push({
      label: '월 이자 (일시상환)',
      formula: `${formatKRW(maxLoan)} × 연 ${formatPercent(rateMin)}~${formatPercent(rateMax)} ÷ 12개월`,
      result: monthlyInterestMax,
      unit: 'KRW',
      note: `소득과 보증금 구간에 따라 월 ${formatKRW(monthlyInterestMin)} ~ ${formatKRW(monthlyInterestMax)} 사이입니다.`,
    });
  }

  const assumptions = [
    '전액을 한도까지 빌린다고 보고 계산했어요. 덜 빌리면 이자도 그만큼 줄어듭니다.',
    `${rule.repayment} 방식이라 매달 이자만 내고 원금은 만기에 갚습니다. 전세금은 계약이 끝나면 돌려받으니 그 돈으로 갚는 구조예요.`,
    '순자산을 입력하지 않으시면 0원으로 보고 계산합니다. 실제로는 예금·주식·자동차까지 합산됩니다.',
  ];

  const warnings = [
    usedOwnRate
      ? '은행에서 안내받은 금리로 계산했어요. 우대금리가 빠져 있지 않은지 확인해 보세요.'
      : '**금리는 범위로만 보여드립니다.** 실제 금리는 부부합산 소득과 보증금 구간에 따라 정해지는 표로 결정되고, 은행 상담에서 확정됩니다. 안내받은 금리가 있으면 아래에 넣어 다시 계산해 보세요.',
    '집주인의 동의와 주택 상태(등기부, 선순위 보증금 등)에 따라 대출이 거절될 수 있습니다. 계약서를 쓰기 전에 은행에 먼저 확인하세요.',
    '대출 신청은 임대차계약서상 잔금 지급일과 주민등록 전입일 중 빠른 날부터 3개월 안에 해야 합니다.',
  ];

  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    warnings.push(
      `${failed.map((c) => c.label).join(', ')} 요건을 못 채우셨어요. 이 상품 대신 일반 버팀목 전세자금대출이나 은행 전세대출을 알아보시는 게 좋습니다.`,
    );
  }
  if (eligible && byRegion < byRatio) {
    warnings.push(
      `보증금의 80%는 ${formatKRW(byRatio)}이지만 ${regionLabel} 한도가 ${formatKRW(byRegion)}이라 거기서 막힙니다.`,
    );
  }

  return ok({
    value: {
      eligible,
      checks,
      maxLoan,
      ownFunds,
      rateMin,
      rateMax,
      discount,
      monthlyInterestMin,
      monthlyInterestMax,
      usedOwnRate,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta],
  });
}
