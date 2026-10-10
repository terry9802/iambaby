import { normalizeId } from '@/lib/account/schema';

/**
 * 초대 링크.
 *
 * 받는 분은 링크를 누르는 것 말고는 아무것도 모른다. '쓴 돈 적기'를 찾아
 * 들어가서 '그룹 참여하기'를 누르고 아이디를 받아 적으라고 할 수는 없다.
 * 그래서 링크에 그룹 아이디를 싣고, 누르면 핀 넣는 칸이 맨 위에 바로 뜬다.
 *
 * 핀은 링크에 안 싣는다. 링크 하나가 새면 그 그룹 가계부가 통째로 열리기
 * 때문이다. 링크는 카톡으로, 핀은 말로 — 둘 중 하나가 새도 안 열린다.
 *
 * # 뒤에 싣는 이유는 그 조각만 서버로 안 가기 때문이다. 누가 어느 그룹에
 * 초대받았는지가 우리 서버 접속 기록에 남지 않는다.
 */

export const INVITE_HASH_KEY = 'join';

export function inviteLink(origin: string, pathname: string, groupId: string): string {
  return `${origin}${pathname}#${INVITE_HASH_KEY}=${encodeURIComponent(normalizeId(groupId))}`;
}

/** 주소의 # 조각에서 초대받은 그룹 아이디를 꺼낸다. 없으면 null. */
export function readInvite(hash: string): string | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!body) return null;
  for (const part of body.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0 || part.slice(0, eq) !== INVITE_HASH_KEY) continue;
    try {
      const id = normalizeId(decodeURIComponent(part.slice(eq + 1)));
      return id || null;
    } catch {
      return null;
    }
  }
  return null;
}

/** 들어간 뒤에는 주소에서 초대 글자를 뗀다. 새로 고쳐도 또 묻지 않게. */
export function dropInvite(): void {
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    cache = '';
    for (const fn of listeners) fn();
  } catch {
    // 못 떼도 큰일은 아니다
  }
}

/*
  주소는 React 바깥에 있다. 가계부·프로필과 같은 방식으로 구독해서 읽는다.
  hashchange도 듣는다 — 이 쪽을 이미 열어 둔 채로 링크를 누르면 브라우저가
  # 뒤만 갈아 끼우고 쪽을 새로 읽지 않는다.
*/
let cache: string | undefined;
const listeners = new Set<() => void>();

export function subscribeInvite(listener: () => void) {
  listeners.add(listener);
  const onHash = () => {
    cache = undefined;
    for (const fn of listeners) fn();
  };
  window.addEventListener('hashchange', onHash);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('hashchange', onHash);
  };
}

export function inviteSnapshot(): string {
  if (cache === undefined) cache = readInvite(window.location.hash) ?? '';
  return cache;
}

export function serverInviteSnapshot(): string {
  return '';
}
