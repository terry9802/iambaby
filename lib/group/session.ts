/**
 * 참여 중인 그룹 가계부. 이 브라우저에만 둔다.
 *
 * 그룹도 '아이디 + 핀'을 가진 금고 하나다. 내 개인 금고와 똑같은 방식으로
 * 잠기고 열린다. 그래서 서버에 새로 만들 것이 없다 — 창구 하나로 둘 다 쓴다.
 *
 * 그룹 핀은 멤버 모두가 아는 값이다. 내 개인 핀과 다르다는 걸 분명히 해 둔다.
 * 그룹 핀이 새면 그 그룹 가계부만 열리고, 내 개인 가계부는 안 열린다.
 */

export const GROUP_STORAGE_KEY = 'nanaegi.group.v1';

export type GroupSession = {
  /** 사람이 지은 그룹 아이디 (소문자로 다듬은 것) */
  id: string;
  pin: string;
  /** 서버가 어느 칸인지 알아보는 이름 */
  account: string;
  keySalt: string;
  /** 보여 줄 이름. 안 지으면 아이디를 쓴다. */
  name?: string;
  since: string;
};

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function loadGroup(): GroupSession | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(GROUP_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<GroupSession>;
    if (!p.id || !p.pin || !p.account || !p.keySalt) return null;
    return {
      id: p.id,
      pin: p.pin,
      account: p.account,
      keySalt: p.keySalt,
      ...(typeof p.name === 'string' && p.name ? { name: p.name } : {}),
      since: typeof p.since === 'string' ? p.since : '',
    };
  } catch {
    return null;
  }
}

export function saveGroup(group: GroupSession): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(group));
    return true;
  } catch {
    return false;
  }
}

export function clearGroup(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(GROUP_STORAGE_KEY);
  } catch {
    // 할 수 있는 게 없다
  }
}

/*
  가계부·프로필과 같은 방식으로 구독해서 읽는다. effect로 끌어오면 첫 그림과
  어긋나 화면이 깜빡인다.
*/

let cache: GroupSession | null | undefined;
const listeners = new Set<() => void>();

export function bumpGroup() {
  cache = undefined;
  for (const fn of listeners) fn();
}

export function subscribeGroup(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === GROUP_STORAGE_KEY || e.key === null) bumpGroup();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function groupSnapshot(): GroupSession | null {
  if (cache === undefined) cache = loadGroup();
  return cache;
}

export function serverGroupSnapshot(): GroupSession | null {
  return null;
}
