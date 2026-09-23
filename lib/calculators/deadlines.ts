import { loadRule } from '@/lib/rules/loader';
import { diffDays, parseDate, toISODate } from '@/lib/format';

/**
 * 곧 마감되는 지원을 한 장으로 알리는 캠페인.
 *
 * 계산기는 "내 경우 얼마인가"에 답하지만, 이건 다른 문제를 푼다. 받을 자격이
 * 있는데 **끝나는 줄 몰라서** 못 받는 경우다. 조건을 넣어볼 마음이 들기 전에
 * 먼저 "당신 지금 이거 놓치는 중"이라고 말해줘야 한다. 그래서 계산기와 따로
 * 주소를 두고, 그 주소 하나만 공유해도 말이 되도록 만든다.
 */

export type Deadline = {
  slug: string;
  name: string;
  region: string;
  event: string;
  amount: number;
  amountLabel: string;
  dueAt: string;
  /** 링크만 봐도 클릭하게 만드는 한 줄 */
  hook: string;
  /** 공유 이미지와 제목에 들어갈 짧은 판 */
  hookShort: string;
  summary: string;
  whyUrgent: string;
  who: string[];
  howTo: string[];
  watchOut: string[];
  applyUrl: string;
  toolPath: string;
  consult: { label: string; number: string };
  verifiedAt: string;
  verifiedBy: string;
};

export type DeadlineStatus = {
  deadline: Deadline;
  dDay: number;
  /** 마감이 지났는가 */
  passed: boolean;
  /** 지금 알릴 만큼 급한가 */
  urgent: boolean;
};

/** 이 날 수 안으로 들어오면 홈에 띄우고 알림을 보낼 만큼 급하다고 본다. */
export const URGENT_WITHIN_DAYS = 45;

export function listDeadlines(asOf?: string): Deadline[] {
  const iso = asOf ?? toISODate(new Date());
  return loadRule<{ items: Deadline[] }>('deadlines', iso).rule.values.items;
}

export function findDeadline(slug: string, asOf?: string): Deadline | undefined {
  return listDeadlines(asOf).find((d) => d.slug === slug);
}

export function statusOf(deadline: Deadline, today?: string): DeadlineStatus {
  const now = today ? parseDate(today) : new Date();
  const dDay = diffDays(now, parseDate(deadline.dueAt));
  return {
    deadline,
    dDay,
    passed: dDay < 0,
    urgent: dDay >= 0 && dDay <= URGENT_WITHIN_DAYS,
  };
}

/** 지금 급한 것들. 가장 급한 순서로. 홈의 띠와 알림이 이 목록을 쓴다. */
export function urgentDeadlines(today?: string): DeadlineStatus[] {
  return listDeadlines(today)
    .map((d) => statusOf(d, today))
    .filter((s) => s.urgent)
    .sort((a, b) => a.dDay - b.dDay);
}

/**
 * 공유할 때 링크와 함께 보내는 문구.
 * 남은 날이 적을수록 숫자를 앞에 세운다. "D-3"과 "9월 30일까지"는 다르게 읽힌다.
 */
export function shareTextFor(status: DeadlineStatus): string {
  const { deadline: d, dDay, passed } = status;
  if (passed) return `${d.name}는 ${d.dueAt}로 마감됐어요.`;
  if (dDay === 0) return `${d.hook} — 오늘이 마지막 날이에요.`;
  if (dDay <= 7) return `${d.hook} 딱 ${dDay}일 남았습니다.`;
  return `${d.hook} ${dDay}일 남았어요.`;
}
