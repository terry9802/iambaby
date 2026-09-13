import { loadRule } from '@/lib/rules/loader';
import type { RuleMeta } from '@/lib/rules/types';
import type { EventKey } from '@/lib/tools';

/**
 * 예고됐지만 아직 확정되지 않은 제도.
 *
 * 이 사이트는 "확인한 숫자만 계산에 넣는다"를 지킨다. 그래서 예산안 단계의 금액은
 * 계산기에 절대 들어가지 않는다. 그렇다고 숨기면, 출산 예정일이 몇 달 뒤인 사람이
 * 곧 바뀔 제도를 모른 채 계획을 세우게 된다. 그래서 계산 결과와 분리된 자리에서
 * "이런 게 예고돼 있고, 아직 정해지지 않았다"를 그대로 알린다.
 */

export type PendingAmount = { label: string; value: number };

export type PendingReform = {
  id: string;
  event: EventKey;
  name: string;
  headline: string;
  appliesFrom: string;
  appliesFromNote: string;
  amounts: PendingAmount[];
  facts: string[];
  watchOut?: string;
};

type PendingReformsRule = {
  decideBy: string;
  decideNote: string;
  items: PendingReform[];
};

export type PendingReformNotice = {
  items: PendingReform[];
  decideBy: string;
  decideNote: string;
  basis: RuleMeta;
};

/**
 * 어떤 이벤트에 걸린 예고 제도를 모아 온다.
 * asOf는 발표 시점 이후인지만 본다 — 미래의 일이라 "그때 기준"이라는 개념이 없다.
 */
export function pendingReformsFor(
  event: EventKey,
  now: Date | string = new Date(),
): PendingReformNotice | null {
  const lookup = loadRule<PendingReformsRule>('pending-reforms', now);
  if (lookup.fallback) return null;

  const items = lookup.rule.values.items.filter((item) => item.event === event);
  if (items.length === 0) return null;

  return {
    items,
    decideBy: lookup.rule.values.decideBy,
    decideNote: lookup.rule.values.decideNote,
    basis: lookup.rule.meta,
  };
}
