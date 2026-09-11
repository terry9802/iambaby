/**
 * 사이트 안에서 눌러 들어온 것인지 판단한다.
 *
 * document.referrer로는 알 수 없다. 링크를 눌러 화면이 바뀌어도 문서는 그대로라서
 * referrer가 처음 들어온 경로에 머물러 있기 때문이다.
 * 대신 앱이 처음 뜬 순간의 방문 기록 개수를 기억해 두고, 그보다 늘어났으면
 * 사이트 안에서 이동한 것으로 본다.
 */
let entryLength: number | null = null;

export function rememberEntry() {
  if (entryLength === null && typeof window !== 'undefined') {
    entryLength = window.history.length;
  }
}

export function canGoBackInApp(): boolean {
  if (typeof window === 'undefined') return false;
  rememberEntry();
  return entryLength !== null && window.history.length > entryLength;
}
