/**
 * 홈에서 마지막으로 본 탭.
 * 계산기를 보고 뒤로 왔을 때 처음 탭으로 튕기지 않도록 브라우저 세션에만 기억한다.
 * React 밖의 저장소라 effect가 아니라 useSyncExternalStore로 구독한다.
 */
const KEY = 'nanaegi.home-tab';

let cache: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeTab(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTab(): string {
  if (cache === null) {
    try {
      cache = window.sessionStorage.getItem(KEY) ?? '';
    } catch {
      cache = '';
    }
  }
  return cache;
}

export function getServerTab(): string {
  return '';
}

export function setTab(value: string) {
  cache = value;
  try {
    window.sessionStorage.setItem(KEY, value);
  } catch {
    // 세션 저장이 막혀 있어도 화면 동작에는 지장이 없다.
  }
  emit();
}
