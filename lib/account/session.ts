/**
 * 로그인 상태. 이 브라우저에만 둔다.
 *
 * 핀을 적어 두는 이유는, 안 그러면 화면을 열 때마다 다시 치셔야 하기 때문이다.
 * 사장님이 바라신 건 "저장 누르면 어느 기기서든 그대로"지 "들어갈 때마다 로그인"이
 * 아니다. 가계부 원본도 어차피 같은 브라우저에 있으므로 핀만 따로 숨겨 봐야
 * 지키는 게 없다.
 */

export const SESSION_STORAGE_KEY = 'nanaegi.account.v1';

export type Session = {
  /** 사람이 친 아이디 (소문자로 다듬은 것) */
  id: string;
  pin: string;
  /** 서버가 어느 칸인지 알아보는 이름 */
  account: string;
  /** 로그인에 성공해야 받는 열쇠 조각 */
  keySalt: string;
  since: string;
};

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function loadSession(): Session | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Session>;
    if (!p.id || !p.pin || !p.account || !p.keySalt) return null;
    return {
      id: p.id,
      pin: p.pin,
      account: p.account,
      keySalt: p.keySalt,
      since: typeof p.since === 'string' ? p.since : '',
    };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearSession(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // 할 수 있는 게 없다
  }
}

/*
  로그인 상태는 React 바깥에 있다. 가계부·프로필과 같은 방식으로 구독해서 읽는다.
  effect로 끌어오면 첫 그림과 어긋나 화면이 깜빡인다.
*/

let cache: Session | null | undefined;
const listeners = new Set<() => void>();

export function bumpSession() {
  cache = undefined;
  for (const fn of listeners) fn();
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SESSION_STORAGE_KEY || e.key === null) bumpSession();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function sessionSnapshot(): Session | null {
  if (cache === undefined) cache = loadSession();
  return cache;
}

export function serverSessionSnapshot(): Session | null {
  return null;
}
