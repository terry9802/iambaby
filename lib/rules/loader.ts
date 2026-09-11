import parentalLeave2026 from '@/rules/2026/parental-leave.json';
import parentalLeaveCouple2026 from '@/rules/2026/parental-leave-couple.json';
import maternityLeave2026 from '@/rules/2026/maternity-leave.json';
import birthGrantsNational2026 from '@/rules/2026/birth-grants-national.json';
import birthGrantsSeoul2026 from '@/rules/2026/birth-grants-seoul.json';
import socialDues2026 from '@/rules/2026/social-dues.json';
import marriageTaxCredit2026 from '@/rules/2026/marriage-tax-credit.json';
import newlywedJeonseLoan2026 from '@/rules/2026/newlywed-jeonse-loan.json';
import payroll2026 from '@/rules/2026/payroll.json';
import severancePay2026 from '@/rules/2026/severance-pay.json';
import unemploymentBenefit2026 from '@/rules/2026/unemployment-benefit.json';
import type { RuleFile, RuleMeta } from './types';
import { parseDate, toISODate } from '@/lib/format';

/**
 * 룰 레지스트리.
 * 같은 ruleId의 파일이 연도별로 쌓이면 여기 배열에 추가만 하면 된다. 계산 로직은 손대지 않는다.
 */
const REGISTRY = {
  'parental-leave': [parentalLeave2026],
  'parental-leave-couple': [parentalLeaveCouple2026],
  'maternity-leave': [maternityLeave2026],
  'birth-grants-national': [birthGrantsNational2026],
  'birth-grants-seoul': [birthGrantsSeoul2026],
  'social-dues': [socialDues2026],
  'marriage-tax-credit': [marriageTaxCredit2026],
  'newlywed-jeonse-loan': [newlywedJeonseLoan2026],
  payroll: [payroll2026],
  'severance-pay': [severancePay2026],
  'unemployment-benefit': [unemploymentBenefit2026],
} as const satisfies Record<string, readonly { meta: RuleMeta; values: unknown }[]>;

export type RuleId = keyof typeof REGISTRY;

export type RuleLookup<V> = {
  rule: RuleFile<V>;
  /** 기준일이 어떤 룰에도 걸리지 않아 가장 가까운 룰로 대체했는가 */
  fallback: boolean;
  /** verifiedAt이 오래되어 사람이 다시 확인해야 하는가 */
  stale: boolean;
};

/** verifiedAt이 이 개월 수보다 오래되면 결과 화면에 "기준값 확인 필요" 배지를 띄운다. */
export const STALE_AFTER_MONTHS = 6;

export function isStale(meta: RuleMeta, now: Date = new Date()): boolean {
  const verified = parseDate(meta.verifiedAt);
  const threshold = new Date(verified);
  threshold.setMonth(threshold.getMonth() + STALE_AFTER_MONTHS);
  return now.getTime() > threshold.getTime();
}

function coversDate(meta: RuleMeta, iso: string): boolean {
  if (iso < meta.effectiveFrom) return false;
  if (meta.effectiveTo && iso > meta.effectiveTo) return false;
  return true;
}

/**
 * 이벤트 날짜(출생일·휴직 개시일) 기준으로 적용할 룰을 고른다.
 * "오늘" 기준이 아니라 "그 일이 일어난 때" 기준이어야 과거 출생아에게 엉뚱한 값을 보여주지 않는다.
 */
export function loadRule<V>(ruleId: RuleId, asOf: Date | string, now: Date = new Date()): RuleLookup<V> {
  const iso = typeof asOf === 'string' ? asOf : toISODate(asOf);
  const candidates = REGISTRY[ruleId] as unknown as readonly RuleFile<V>[];

  const matched = candidates.filter((r) => coversDate(r.meta, iso));
  if (matched.length > 0) {
    // 여러 개가 걸리면 가장 늦게 시작한 것이 최신 개정이다.
    const rule = matched.reduce((best, r) =>
      r.meta.effectiveFrom > best.meta.effectiveFrom ? r : best,
    );
    return { rule, fallback: false, stale: isStale(rule.meta, now) };
  }

  // 기준일이 수집된 룰보다 이른 경우: 가장 오래된 룰로 대체하고 그 사실을 알린다.
  const oldest = candidates.reduce((best, r) =>
    r.meta.effectiveFrom < best.meta.effectiveFrom ? r : best,
  );
  return { rule: oldest, fallback: true, stale: isStale(oldest.meta, now) };
}

/** 대체 적용된 룰에 붙일 경고 문구. 계산기마다 같은 말을 다시 쓰지 않도록 여기 둔다. */
export function fallbackWarning(lookup: RuleLookup<unknown>): string[] {
  if (!lookup.fallback) return [];
  return [
    `입력하신 날짜는 ${lookup.rule.meta.effectiveFrom} 이전이라 그때의 기준값은 아직 정리돼 있지 않아요. ` +
      `지금은 ${lookup.rule.meta.effectiveFrom}부터의 기준으로 계산했으니, 실제 금액과 다를 수 있습니다.`,
  ];
}

export function ruleMetaOf(ruleId: RuleId, asOf: Date | string): RuleMeta {
  return loadRule(ruleId, asOf).rule.meta;
}
