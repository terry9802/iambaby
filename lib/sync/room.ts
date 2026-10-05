/**
 * 커플 방 설정. 브라우저에만 둔다.
 *
 * 방 열쇠와 핀이 여기 있다. 둘 다 서버로 보내지 않는다. 이 둘이 없으면 서버에
 * 올라간 덩어리는 아무 뜻이 없는 글자일 뿐이다.
 *
 * 핀을 기기에 적어 두는 이유는, 안 그러면 화면을 열 때마다 6자리를 다시 치셔야
 * 하기 때문이다. 어차피 가계부 원본이 같은 기기에 있으므로 핀만 따로 숨겨 봐야
 * 지키는 게 없다.
 */

export const SYNC_STORAGE_KEY = 'nanaegi.sync.v1';

export type Room = {
  roomId: string;
  roomSecret: string;
  pin: string;
  /** 이 기기가 방에 들어온 날 */
  joinedAt: string;
};

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function loadRoom(): Room | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SYNC_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Room>;
    if (typeof p.roomId !== 'string' || !p.roomId) return null;
    if (typeof p.roomSecret !== 'string' || !p.roomSecret) return null;
    if (typeof p.pin !== 'string' || !p.pin) return null;
    return {
      roomId: p.roomId,
      roomSecret: p.roomSecret,
      pin: p.pin,
      joinedAt: typeof p.joinedAt === 'string' ? p.joinedAt : '',
    };
  } catch {
    return null;
  }
}

export function saveRoom(room: Room): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(room));
    return true;
  } catch {
    return false;
  }
}

export function clearRoom(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(SYNC_STORAGE_KEY);
  } catch {
    // 못 지워도 할 수 있는 게 없다
  }
}

const JOIN_KEY = 'join';

/**
 * 초대 링크.
 *
 * 방 번호와 방 열쇠를 # 뒤에 싣는다. # 뒤는 브라우저가 서버로 보내지 않는 자리라,
 * 초대 링크를 눌러도 방 열쇠가 우리 서버 기록에 남지 않는다.
 *
 * 핀은 일부러 안 싣는다. 링크 하나만 새면 다 열리는 걸 막으려는 것이다.
 * 링크는 카톡으로, 핀은 입으로 — 이러면 둘 중 하나가 새도 안 열린다.
 */
export function inviteLink(origin: string, pathname: string, roomId: string, secret: string) {
  return `${origin}${pathname}#${JOIN_KEY}=${roomId}.${secret}`;
}

export function readInviteHash(hash: string): { roomId: string; roomSecret: string } | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const part of body.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0 || part.slice(0, eq) !== JOIN_KEY) continue;
    const [roomId, roomSecret] = decodeURIComponent(part.slice(eq + 1)).split('.');
    if (!roomId || !roomSecret) return null;
    return { roomId, roomSecret };
  }
  return null;
}

/*
  방 설정과 주소의 # 조각은 둘 다 React 바깥에 있는 값이다. effect로 끌어오면
  첫 그림과 어긋나 깜빡이므로, 가계부·프로필과 같은 방식으로 구독해서 읽는다.
*/

let roomCache: Room | null | undefined;
const roomListeners = new Set<() => void>();

export function bumpRoom() {
  roomCache = undefined;
  for (const fn of roomListeners) fn();
}

export function subscribeRoom(listener: () => void) {
  roomListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SYNC_STORAGE_KEY || e.key === null) bumpRoom();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    roomListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function roomSnapshot(): Room | null {
  if (roomCache === undefined) roomCache = loadRoom();
  return roomCache;
}

export function serverRoomSnapshot(): Room | null {
  return null;
}

let hashCache: string | undefined;
const hashListeners = new Set<() => void>();

export function subscribeHash(listener: () => void) {
  hashListeners.add(listener);
  const onHash = () => {
    hashCache = undefined;
    for (const fn of hashListeners) fn();
  };
  window.addEventListener('hashchange', onHash);
  return () => {
    hashListeners.delete(listener);
    window.removeEventListener('hashchange', onHash);
  };
}

export function hashSnapshot(): string {
  if (hashCache === undefined) hashCache = window.location.hash;
  return hashCache;
}

export function serverHashSnapshot(): string {
  return '';
}

/** 가져온 뒤 주소에서 초대 글자를 뗀다. 새로 고쳐도 또 묻지 않게. */
export function dropHash() {
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    hashCache = '';
    for (const fn of hashListeners) fn();
  } catch {
    // 못 떼도 큰일은 아니다
  }
}
