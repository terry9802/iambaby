import { loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { formatKRW, parseDate, toISODate } from '@/lib/format';

/**
 * 쉬는 데 보태주는 국가 지원 판정기.
 *
 * 이 주제는 계산보다 판정이 중요하다. 금액은 정해져 있고, 어려운 건 "내가 되느냐"다.
 * 그래서 되는 것뿐 아니라 **안 되는 것과 그 이유**도 같이 돌려준다.
 * 해당되는 게 하나도 없는 사람이 적지 않은데, 그걸 숨기면 헛걸음을 시키게 된다.
 */

export type IncomeBracket = 'basic' | 'nearpoor' | 'none';
export type WorkPlace = 'sme' | 'other' | 'none';
export type Region = 'capital' | 'nonCapital';

type Phone = { label: string; number: string };

type Bonus = { label: string; amount: number; birthYearMin?: number; birthYearMax?: number };

type Conditions = {
  income?: IncomeBracket[];
  employment?: WorkPlace[];
  birthYearMin?: number;
  birthYearMax?: number;
};

type RawItem = {
  id: string;
  name: string;
  agency: string;
  summary: string;
  amount: number;
  amountByRegion?: { capital: number; nonCapital: number };
  myCost: number;
  unit: 'year' | 'month' | 'once';
  bonuses?: Bonus[];
  conditions: Conditions;
  disabilityTrack?: { label: string; amount: number; birthYearMin: number; birthYearMax: number };
  applyFrom: string | null;
  applyTo: string | null;
  applyNote: string;
  applyPeriodNeedsCheck?: boolean;
  applyBy: 'self' | 'company';
  applyAt: string;
  applyUrl: string;
  phone?: Phone;
  useBy: string;
  useWhere: string;
  notes: string[];
};

type RestBenefitsRule = {
  year: number;
  items: RawItem[];
  consult: Phone & { note: string };
};

export type ApplyStatus = 'open' | 'not-yet' | 'closed' | 'unknown';

export type RestBenefit = {
  id: string;
  name: string;
  agency: string;
  summary: string;
  /** 받는 금액. unit이 month면 한 달치 */
  amount: number;
  /** 1년으로 환산한 금액 (month면 ×12) */
  yearlyAmount: number;
  /** 내가 내야 하는 돈 */
  myCost: number;
  /** 실제로 이득인 금액 */
  netGain: number;
  unit: 'year' | 'month' | 'once';
  /** 나이·장애 때문에 더 붙은 금액 설명 */
  bonusLabels: string[];
  applyStatus: ApplyStatus;
  /** 신청 마감까지 남은 날. 마감일을 모르면 null */
  dDay: number | null;
  applyNote: string;
  applyBy: 'self' | 'company';
  applyAt: string;
  applyUrl: string;
  phone?: Phone;
  useBy: string;
  useWhere: string;
  notes: string[];
};

export type RestBenefitMiss = {
  id: string;
  name: string;
  summary: string;
  /** 왜 안 되는지 한 줄 */
  reason: string;
};

export type RestBenefitsValue = {
  year: number;
  eligible: RestBenefit[];
  missed: RestBenefitMiss[];
  /** 1년 기준 받는 돈 합계 */
  totalYearly: number;
  /** 내가 내는 돈 합계 */
  totalCost: number;
  /** 실제 이득 */
  totalNet: number;
  /** 지금 신청할 수 있는 것의 수 */
  openNow: number;
  consult: Phone & { note: string };
};

export type RestBenefitsInput = {
  birthYear?: number;
  income?: IncomeBracket;
  workplace?: WorkPlace;
  region?: Region;
  disabled?: boolean;
  /** 테스트에서 오늘을 고정하기 위한 값 */
  today?: string;
};

function statusOf(from: string | null, to: string | null, today: string): ApplyStatus {
  if (!from && !to) return 'unknown';
  if (from && today < from) return 'not-yet';
  if (to && today > to) return 'closed';
  if (!to) return 'open';
  return 'open';
}

function daysUntil(to: string | null, today: string): number | null {
  if (!to) return null;
  return Math.round(
    (parseDate(to).getTime() - parseDate(today).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function inBirthRange(birthYear: number, min?: number, max?: number): boolean {
  if (min !== undefined && birthYear < min) return false;
  if (max !== undefined && birthYear > max) return false;
  return true;
}

export function checkRestBenefits(input: RestBenefitsInput): CalcOutcome<RestBenefitsValue> {
  const gaps = [];
  if (!input.birthYear) {
    gaps.push({
      field: 'birthYear',
      label: '태어난 해',
      hint: '지원 대부분이 나이로 갈려서, 이것부터 있어야 판정할 수 있어요.',
    });
  }
  if (!input.income) {
    gaps.push({
      field: 'income',
      label: '소득 구분',
      hint: '기초생활수급이나 차상위에 해당하는지에 따라 받을 수 있는 게 크게 달라집니다.',
    });
  }
  if (gaps.length > 0) return missing(...gaps);

  const today = input.today ?? toISODate(new Date());
  const lookup = loadRule<RestBenefitsRule>('rest-benefits', today);
  const rule = lookup.rule.values;

  const birthYear = input.birthYear!;
  const income = input.income!;
  const workplace = input.workplace ?? 'none';
  const region = input.region ?? 'capital';
  const disabled = input.disabled ?? false;

  const eligible: RestBenefit[] = [];
  const missed: RestBenefitMiss[] = [];

  for (const item of rule.items) {
    // 장애인 전용 트랙이 따로 있으면 그 조건을 먼저 본다 (소득 조건을 건너뛰는 경우가 있다)
    const viaDisability =
      disabled &&
      item.disabilityTrack &&
      inBirthRange(birthYear, item.disabilityTrack.birthYearMin, item.disabilityTrack.birthYearMax);

    const reasons: string[] = [];
    if (!viaDisability) {
      const c = item.conditions;
      if (c.income && !c.income.includes(income)) {
        reasons.push('기초생활수급자나 차상위계층이어야 받을 수 있어요');
      }
      if (c.employment && !c.employment.includes(workplace)) {
        reasons.push('중소기업·소상공인·비영리단체·사회복지시설에 다녀야 해요');
      }
      if (!inBirthRange(birthYear, c.birthYearMin, c.birthYearMax)) {
        if (c.birthYearMin !== undefined && c.birthYearMax !== undefined) {
          reasons.push(`${c.birthYearMin}~${c.birthYearMax}년에 태어난 사람만 받아요`);
        } else if (c.birthYearMax !== undefined) {
          reasons.push(`${c.birthYearMax}년 이전에 태어나야 해요`);
        } else {
          reasons.push('나이 조건에 맞지 않아요');
        }
      }
    }

    if (reasons.length > 0) {
      missed.push({ id: item.id, name: item.name, summary: item.summary, reason: reasons[0] });
      continue;
    }

    // 금액 결정
    let amount = item.amount;
    const bonusLabels: string[] = [];
    if (viaDisability && item.disabilityTrack) {
      amount = item.disabilityTrack.amount;
      bonusLabels.push(`${item.disabilityTrack.label} ${formatKRW(amount)}`);
    } else if (item.amountByRegion) {
      amount = region === 'capital' ? item.amountByRegion.capital : item.amountByRegion.nonCapital;
      bonusLabels.push(region === 'capital' ? '수도권 기준' : '비수도권이라 50,000원 더');
    }
    for (const bonus of item.bonuses ?? []) {
      if (inBirthRange(birthYear, bonus.birthYearMin, bonus.birthYearMax)) {
        amount += bonus.amount;
        bonusLabels.push(`${bonus.label} +${formatKRW(bonus.amount)}`);
      }
    }

    const yearlyAmount = item.unit === 'month' ? amount * 12 : amount;
    eligible.push({
      id: item.id,
      name: item.name,
      agency: item.agency,
      summary: item.summary,
      amount,
      yearlyAmount,
      myCost: item.myCost,
      netGain: yearlyAmount - item.myCost,
      unit: item.unit,
      bonusLabels,
      applyStatus: item.applyPeriodNeedsCheck
        ? 'unknown'
        : statusOf(item.applyFrom, item.applyTo, today),
      dDay: item.applyPeriodNeedsCheck ? null : daysUntil(item.applyTo, today),
      applyNote: item.applyNote,
      applyBy: item.applyBy,
      applyAt: item.applyAt,
      applyUrl: item.applyUrl,
      phone: item.phone,
      useBy: item.useBy,
      useWhere: item.useWhere,
      notes: item.notes,
    });
  }

  const totalYearly = eligible.reduce((sum, b) => sum + b.yearlyAmount, 0);
  const totalCost = eligible.reduce((sum, b) => sum + b.myCost, 0);
  const openNow = eligible.filter((b) => b.applyStatus === 'open').length;

  const steps: CalcStep[] = eligible.map((b) => ({
    label: b.name,
    formula:
      b.unit === 'month'
        ? `${formatKRW(b.amount)} × 12개월`
        : b.myCost > 0
          ? `${formatKRW(b.yearlyAmount)} − 내 부담 ${formatKRW(b.myCost)}`
          : formatKRW(b.yearlyAmount),
    result: b.netGain,
    note: b.bonusLabels.length > 0 ? b.bonusLabels.join(' · ') : undefined,
  }));
  steps.push({
    label: '실제로 이득인 금액',
    formula: `받는 돈 ${formatKRW(totalYearly)} − 내가 내는 돈 ${formatKRW(totalCost)}`,
    result: totalYearly - totalCost,
  });

  const assumptions = [
    `${rule.year}년 기준입니다. 신청 기간과 금액은 해마다 바뀝니다.`,
    '스포츠강좌이용권은 매달 주는 돈이라 1년을 꽉 채워 썼다고 보고 12개월로 환산했어요. 실제로는 강좌를 들은 달에만 나갑니다.',
    '지자체가 따로 주는 휴양 지원은 여기 없습니다. 사는 곳마다 달라서 구청에 물어보시는 게 정확해요.',
  ];

  const warnings: string[] = [];
  if (eligible.length === 0) {
    warnings.push(
      '**해당되는 게 하나도 없습니다.** 쉬는 데 보태주는 국가 지원은 대부분 저소득층이나 특정 나이를 대상으로 합니다. 없는 걸 있다고 말씀드릴 수는 없어요.',
    );
  }
  const companyOnly = eligible.filter((b) => b.applyBy === 'company');
  if (companyOnly.length > 0) {
    warnings.push(
      `**${companyOnly.map((b) => b.name).join(', ')}은(는) 내가 직접 신청할 수 없습니다.** 회사가 기업 단위로 신청해야 하니 총무·인사팀에 물어보세요.`,
    );
  }
  const closed = eligible.filter((b) => b.applyStatus === 'closed');
  if (closed.length > 0) {
    warnings.push(
      `${closed.map((b) => b.name).join(', ')}의 올해 신청은 이미 끝났습니다. 내년 같은 시기에 다시 열려요.`,
    );
  }
  warnings.push(
    '여기 있는 건 중앙정부 지원입니다. 신청 기간이 짧고 선착순이나 추첨인 게 많아서, 연초에 한 번 몰아서 확인하는 편이 낫습니다.',
  );

  return ok({
    value: {
      year: rule.year,
      eligible,
      missed,
      totalYearly,
      totalCost,
      totalNet: totalYearly - totalCost,
      openNow,
      consult: rule.consult,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta],
  });
}
