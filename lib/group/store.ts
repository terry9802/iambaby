import { sanitizeEntries, sanitizeGraves, type Entry, type Grave } from '@/lib/ledger/schema';
import type { GroupVault, Member } from './client';

/**
 * 그룹 가계부를 이 기기에도 담아 둔다.
 *
 * 서버에서 받아 온 것을 그대로 쓰면 화면을 열 때마다 받아오기를 기다려야 하고,
 * 연결이 안 될 때는 그룹 칸이 통째로 비어 보인다. 받은 것을 적어 두면 바로
 * 그려지고, 맞추기는 뒤에서 조용히 돈다.
 */

export const GROUP_LOG_KEY = 'nanaegi.grouplog.v1';

export type StoredGroupLog = {
  version: 1;
  entries: Entry[];
  graves: Grave[];
  members: Member[];
  name?: string;
  /** 마지막으로 서버와 맞춘 시각 */
  syncedAt: string;
};

export const EMPTY_LOG: StoredGroupLog = {
  version: 1,
  entries: [],
  graves: [],
  members: [],
  syncedAt: '',
};

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function sanitizeMembers(input: unknown): Member[] {
  if (!Array.isArray(input)) return [];
  const out: Member[] = [];
  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const raw = row as Record<string, unknown>;
    if (typeof raw.id !== 'string' || !raw.id) continue;
    out.push({ id: raw.id.slice(0, 20), at: typeof raw.at === 'string' ? raw.at : '' });
  }
  return out;
}

export function loadGroupLog(): StoredGroupLog {
  if (!hasStorage()) return EMPTY_LOG;
  try {
    const raw = window.localStorage.getItem(GROUP_LOG_KEY);
    if (!raw) return EMPTY_LOG;
    const p = JSON.parse(raw) as Partial<StoredGroupLog>;
    return {
      version: 1,
      entries: sanitizeEntries(p.entries),
      graves: sanitizeGraves(p.graves),
      members: sanitizeMembers(p.members),
      ...(typeof p.name === 'string' && p.name ? { name: p.name } : {}),
      syncedAt: typeof p.syncedAt === 'string' ? p.syncedAt : '',
    };
  } catch {
    return EMPTY_LOG;
  }
}

export function saveGroupLog(vault: GroupVault, now: string): boolean {
  if (!hasStorage()) return false;
  try {
    const payload: StoredGroupLog = {
      version: 1,
      entries: sanitizeEntries(vault.entries),
      graves: sanitizeGraves(vault.graves),
      members: sanitizeMembers(vault.members),
      ...(vault.name ? { name: vault.name } : {}),
      syncedAt: now,
    };
    window.localStorage.setItem(GROUP_LOG_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearGroupLog(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(GROUP_LOG_KEY);
  } catch {
    // 할 수 있는 게 없다
  }
}

/*
  "○○님이 가계부를 업데이트했습니다"를 한 번만 띄우려고, 어디까지 봤는지 적어 둔다.
  안 적어 두면 화면을 열 때마다 같은 알림이 또 뜬다.
*/
const SEEN_KEY = 'nanaegi.groupseen.v1';

export function loadSeen(): string {
  if (!hasStorage()) return '';
  try {
    return window.localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function markSeen(at: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(SEEN_KEY, at);
    seenCache = at;
    for (const fn of seenListeners) fn();
  } catch {
    // 할 수 있는 게 없다
  }
}

let seenCache: string | undefined;
const seenListeners = new Set<() => void>();

export function subscribeSeen(listener: () => void) {
  seenListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SEEN_KEY || e.key === null) {
      seenCache = undefined;
      for (const fn of seenListeners) fn();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    seenListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function seenSnapshot(): string {
  if (seenCache === undefined) seenCache = loadSeen();
  return seenCache;
}

export function serverSeenSnapshot(): string {
  return '';
}

let cache: StoredGroupLog | null = null;
const listeners = new Set<() => void>();

export function bumpGroupLog() {
  cache = null;
  for (const fn of listeners) fn();
}

export function subscribeGroupLog(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === GROUP_LOG_KEY || e.key === null) bumpGroupLog();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function groupLogSnapshot(): StoredGroupLog {
  if (!cache) cache = loadGroupLog();
  return cache;
}

export function serverGroupLogSnapshot(): StoredGroupLog {
  return EMPTY_LOG;
}
