import { loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { formatKRW } from '@/lib/format';

/** 실업급여(구직급여) = 1일 구직급여액 × 소정급여일수 */

export type AgeGroup = 'under50' | 'over50';

export type UnemploymentRule = {
  wageReplacementRate: number;
  dailyCap: number;
  dailyCapNeedsCheck: boolean;
  minimumWage: { hourly: number; dailyHours: number; floorRate: number; source: string };
  requiredInsuredDays: number;
  applyWithinMonths: number;
  benefitDays: {
    ageGroup: AgeGroup;
    label: string;
    rows: { maxYears: number | null; days: number }[];
  }[];
  consult: { label: string; number: string; note: string };
};

export type UnemploymentInput = {
  /** 퇴직 전 3개월 월 평균 급여 (세전) */
  monthlyWage?: number;
  ageGroup?: AgeGroup;
  /** 고용보험 가입기간(년) */
  insuredYears?: number;
  /** 스스로 그만두었는가 */
  voluntary?: boolean;
  /** 상한액을 직접 고칠 때 */
  dailyCapOverride?: number;
  asOf?: string;
};

export type UnemploymentValue = {
  dailyAverageWage: number;
  rawDaily: number;
  dailyFloor: number;
  dailyCap: number;
  dailyBenefit: number;
  benefitDays: number;
  total: number;
  cappedByFloor: boolean;
  cappedByCap: boolean;
  floorExceedsCap: boolean;
  mayNotQualify: boolean;
};

export function calcUnemploymentBenefit(
  input: UnemploymentInput,
): CalcOutcome<UnemploymentValue> {
  if (!input.monthlyWage || input.monthlyWage <= 0) {
    return missing<UnemploymentValue>({
      field: 'monthlyWage',
      label: '퇴직 전 3개월 월 평균 급여 (세전)',
      hint: '세금 떼기 전 금액이에요. 이 금액의 60%가 실업급여의 기준이 됩니다.',
    });
  }

  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const lookup = loadRule<UnemploymentRule>('unemployment-benefit', asOf);
  const rule = lookup.rule.values;

  const monthlyWage = input.monthlyWage;
  const ageGroup: AgeGroup = input.ageGroup ?? 'under50';
  const insuredYears = Math.max(0, input.insuredYears ?? 3);

  // 3개월 임금총액을 그 기간의 총일수로 나눈다. 달마다 일수가 달라 90~92일이지만 91일로 잡는다.
  const dailyAverageWage = (monthlyWage * 3) / 91;
  const rawDaily = dailyAverageWage * rule.wageReplacementRate;

  const dailyFloor = Math.round(
    rule.minimumWage.hourly * rule.minimumWage.dailyHours * rule.minimumWage.floorRate,
  );
  const dailyCap = input.dailyCapOverride ?? rule.dailyCap;

  // 상한을 먼저 씌우고 하한을 나중에 적용한다. 하한이 상한보다 높은 해에는 하한이 이긴다.
  const afterCap = Math.min(rawDaily, dailyCap);
  const dailyBenefit = Math.round(Math.max(afterCap, dailyFloor));

  const table = rule.benefitDays.find((b) => b.ageGroup === ageGroup) ?? rule.benefitDays[0];
  const row = table.rows.find((r) => r.maxYears === null || insuredYears < r.maxYears) ?? table.rows[table.rows.length - 1];
  const benefitDays = row.days;
  const total = dailyBenefit * benefitDays;

  const steps: CalcStep[] = [
    {
      label: '1일 평균임금',
      formula: `월 ${formatKRW(monthlyWage)} × 3개월 ÷ 91일`,
      result: Math.round(dailyAverageWage),
      unit: 'KRW',
    },
    {
      label: '그 60%',
      formula: `${formatKRW(Math.round(dailyAverageWage))} × 60%`,
      result: Math.round(rawDaily),
      unit: 'KRW',
    },
    {
      label: '상한 · 하한 적용',
      formula: `상한 ${formatKRW(dailyCap)} / 하한 ${formatKRW(dailyFloor)}`,
      result: dailyBenefit,
      unit: 'KRW',
      note: `하한은 최저임금 시급 ${rule.minimumWage.hourly.toLocaleString('ko-KR')}원 × ${rule.minimumWage.dailyHours}시간 × ${Math.round(rule.minimumWage.floorRate * 100)}%로 정해집니다.`,
    },
    {
      label: '받는 일수',
      formula: `${table.label} · 가입 ${insuredYears}년`,
      result: benefitDays,
      unit: 'DAY',
    },
    {
      label: '전부 받으면',
      formula: `${formatKRW(dailyBenefit)} × ${benefitDays}일`,
      result: total,
      unit: 'KRW',
    },
  ];

  const assumptions = [
    '퇴직 전 3개월 급여가 매달 같다고 보고, 그 기간을 91일로 잡아 계산했어요.',
    '소정급여일수를 모두 채워 받는다고 봤어요. 중간에 취업하면 남은 일수는 받지 않습니다.',
    `고용보험 가입기간을 ${insuredYears}년으로 잡았어요. 이전 직장 기간도 합산됩니다.`,
  ];

  const warnings: string[] = [
    `**상한액은 확인이 필요합니다.** 화면에 보이는 ${formatKRW(rule.dailyCap)}은 이전에 고시된 금액이라 올해 값과 다를 수 있어요. 직접 고쳐서 계산해 보시거나 ${rule.consult.label}(${rule.consult.number})에 확인해 주세요.`,
    `실업급여는 퇴직 다음 날부터 ${rule.applyWithinMonths}개월이 지나면 남은 일수가 있어도 받을 수 없습니다. 퇴사하면 바로 신청하세요.`,
    `고용보험에 ${rule.requiredInsuredDays}일(약 7개월) 이상 가입돼 있어야 받을 수 있습니다.`,
  ];

  const mayNotQualify = input.voluntary === true;
  if (mayNotQualify) {
    warnings.unshift(
      '**스스로 그만두면 원칙적으로 실업급여를 받을 수 없습니다.** 다만 임금 체불, 통근 곤란, 질병, 괴롭힘 등 정당한 사유가 인정되면 받을 수 있어요. 사유에 해당하는지는 고용센터에서 판단합니다.',
    );
  }

  const floorExceedsCap = dailyFloor > dailyCap;
  if (floorExceedsCap) {
    warnings.push(
      `지금 기준으로는 하한액(${formatKRW(dailyFloor)})이 상한액(${formatKRW(dailyCap)})보다 높습니다. 최저임금이 오르면 생기는 현상이고, 이런 해에는 하한액이 적용됩니다. 상한액이 인상됐을 수 있으니 확인해 주세요.`,
    );
  }

  return ok({
    value: {
      dailyAverageWage: Math.round(dailyAverageWage),
      rawDaily: Math.round(rawDaily),
      dailyFloor,
      dailyCap,
      dailyBenefit,
      benefitDays,
      total,
      cappedByFloor: dailyBenefit === dailyFloor && rawDaily < dailyFloor,
      cappedByCap: rawDaily > dailyCap && !floorExceedsCap,
      floorExceedsCap,
      mayNotQualify,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta],
  });
}
