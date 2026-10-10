import type { Entry } from './schema';

/**
 * 어디까지 볼지.
 *
 * 화면 곳곳(도넛, 달별 막대, 적어 둔 기록)이 같은 값을 본다. 따로 두면
 * 그림은 '그룹'인데 목록은 '전체'인 상태가 생기고, 숫자가 안 맞는 것처럼 보인다.
 */
export type Scope = 'all' | 'personal' | 'group';

export const SCOPE_LABEL: Record<Scope, string> = {
  all: '전체',
  personal: '개인',
  group: '그룹',
};

export const SCOPES: Scope[] = ['all', 'personal', 'group'];

/**
 * 고른 범위에 드는 줄만 고른다.
 *
 * @param mine 내가 적은 줄 전부 (개인 + 내가 적은 그룹 지출)
 * @param groupRows 그룹 가계부에 쌓인 줄. 멤버들이 적은 것이 다 들어 있다.
 */
export function rowsInScope(scope: Scope, mine: Entry[], groupRows: Entry[]): Entry[] {
  if (scope === 'personal') return mine.filter((e) => e.purse === 'personal');
  if (scope === 'group') return groupRows;
  /*
    전체는 둘을 합치되 아이디로 겹치는 줄을 지운다. 내가 그룹 지출로 적은 줄은
    내 가계부와 그룹 가계부에 둘 다 있어서, 그냥 더하면 두 번 세어진다.
  */
  const seen = new Set(mine.map((e) => e.id));
  return [...mine, ...groupRows.filter((e) => !seen.has(e.id))];
}
