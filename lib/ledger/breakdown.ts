import type { Entry } from './schema';

/**
 * 무엇에 얼마를 썼는지 나눠 센다.
 *
 * 쓰시던 가계부의 카테고리를 그대로 쓴다(식비·교통·쇼핑…). 열다섯 가지라
 * 전부 그리면 조각이 실처럼 얇아지고 색도 모자란다. 그래서 큰 것 몇 개만
 * 두고 나머지는 '기타'로 묶는다.
 *
 * 몇 개까지 둘지는 눈대중이 아니라 색으로 정했다. 색맹 검사를 통과하면서
 * 서로 구분되는 색이 여섯 개까지라, 큰 것 다섯에 '기타' 하나다.
 */

export const MAX_SLICES = 6;

export type Slice = {
  label: string;
  amount: number;
  /** 전체에서 차지하는 몫 (0~1) */
  share: number;
  count: number;
};

export function breakdown(entries: Entry[], max = MAX_SLICES): Slice[] {
  const total = entries.reduce((n, e) => n + e.amount, 0);
  if (total <= 0) return [];

  const byLabel = new Map<string, { amount: number; count: number }>();
  for (const e of entries) {
    const label = e.spend ?? '기타';
    const had = byLabel.get(label) ?? { amount: 0, count: 0 };
    byLabel.set(label, { amount: had.amount + e.amount, count: had.count + 1 });
  }

  const sorted = [...byLabel.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.amount - a.amount);

  /*
    묶을 게 하나뿐이면 묶지 않는다. '기타' 한 조각이 원래 '기타'와 겹쳐 보이고,
    묶어서 줄어드는 것도 없다.
  */
  if (sorted.length <= max) {
    return sorted.map((s) => ({ ...s, share: s.amount / total }));
  }

  const head = sorted.slice(0, max - 1);
  const tail = sorted.slice(max - 1);
  const rest = {
    label: '기타',
    amount: tail.reduce((n, s) => n + s.amount, 0),
    count: tail.reduce((n, s) => n + s.count, 0),
  };
  /* 이미 '기타' 조각이 앞에 있으면 거기에 합친다. 같은 이름이 둘이면 안 된다. */
  const merged = head.some((h) => h.label === '기타')
    ? head.map((h) => (h.label === '기타' ? { ...h, amount: h.amount + rest.amount, count: h.count + rest.count } : h))
    : [...head, rest];

  return merged
    .sort((a, b) => b.amount - a.amount)
    .map((s) => ({ ...s, share: s.amount / total }));
}
