import { sanitizeEntries, type Entry } from './schema';

/**
 * 가계부 자동 백업.
 *
 * 사장님 기록이 두 번 사라졌다. 합치기 로직은 무작위로 두들겨 봐도 줄을 삼키지
 * 않는다는 걸 확인했지만, 원인을 못 밝힌 채로 "이제 괜찮습니다"라고 말할 수는 없다.
 * 그래서 원인과 상관없이 되돌릴 수 있게 해 둔다.
 *
 * 줄이 줄어드는 저장이 일어나기 직전에 그 전 상태를 떠 둔다. 지우기, 합치기,
 * 전부 지우기 — 무엇이 줄였든 상관없이 직전 모습이 남는다.
 *
 * 한계는 분명히 해 둔다. 이 백업도 같은 브라우저 안에 산다. 브라우저가 사이트
 * 데이터를 통째로 비우면 백업도 같이 사라진다. 그 경우까지 막으려면 엑셀로
 * 받아 두시거나 둘이 같이 쓰기를 켜 두셔야 하고, 화면에도 그렇게 적는다.
 */

export const BACKUP_STORAGE_KEY = 'nanaegi.ledger.backup.v1';

/** 몇 개까지 들고 있을지. 100줄짜리가 20KB쯤이라 여덟 개면 넉넉하다. */
export const MAX_SNAPSHOTS = 8;

export type Snapshot = {
  /** 떠 둔 시각 (ISO) */
  at: string;
  count: number;
  total: number;
  entries: Entry[];
};

export type StoredBackup = { version: 1; snapshots: Snapshot[] };

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function sumOf(entries: Entry[]): number {
  return entries.reduce((n, e) => n + e.amount, 0);
}

export function sanitizeSnapshots(input: unknown): Snapshot[] {
  if (!Array.isArray(input)) return [];
  const out: Snapshot[] = [];
  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const raw = row as Record<string, unknown>;
    if (typeof raw.at !== 'string' || !raw.at) continue;
    const entries = sanitizeEntries(raw.entries);
    if (entries.length === 0) continue;
    out.push({ at: raw.at, count: entries.length, total: sumOf(entries), entries });
  }
  // 최근 것이 앞
  return out.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, MAX_SNAPSHOTS);
}

export function loadSnapshots(): Snapshot[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeSnapshots((JSON.parse(raw) as Partial<StoredBackup>)?.snapshots);
  } catch {
    return [];
  }
}

function write(snapshots: Snapshot[]): boolean {
  if (!hasStorage()) return false;
  try {
    const payload: StoredBackup = { version: 1, snapshots };
    window.localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    /*
      자리가 모자라면 오래된 것부터 버리고 다시 해 본다. 백업을 못 떠서 본 저장이
      막히면 안 된다. 백업은 보험이지 본 일이 아니다.
    */
    try {
      if (snapshots.length > 1) return write(snapshots.slice(0, Math.floor(snapshots.length / 2)));
    } catch {
      // 아래로
    }
    return false;
  }
}

/**
 * 지금 모습을 떠 둔다.
 *
 * 같은 모습을 또 떠 두지 않는다. 줄 수와 합이 모두 같으면 같은 상태로 본다.
 * 그렇게 안 하면 화면에 들어올 때마다 쌓여서, 정작 되돌리고 싶은 어제 모습이
 * 오늘 찍힌 똑같은 사진 여덟 장에 밀려 사라진다.
 */
export function keepSnapshot(entries: Entry[], now: string): boolean {
  const clean = sanitizeEntries(entries);
  if (clean.length === 0) return false;
  const snap: Snapshot = { at: now, count: clean.length, total: sumOf(clean), entries: clean };
  const had = loadSnapshots();
  const newest = had[0];
  if (newest && newest.count === snap.count && newest.total === snap.total) return false;
  return write([snap, ...had].slice(0, MAX_SNAPSHOTS));
}

export function clearSnapshots(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(BACKUP_STORAGE_KEY);
  } catch {
    // 할 수 있는 게 없다
  }
}

/**
 * 이번 저장이 백업을 떠 둘 만한 저장인가.
 *
 * 줄이 줄어드는 저장만 본다. 늘어나는 저장은 잃을 게 없다. 한 줄 지우기도
 * 포함한다 — 잘못 지운 한 줄을 되살리는 것도 똑같이 쓸모 있다.
 */
export function shrinks(before: Entry[], after: Entry[]): boolean {
  return before.length > 0 && after.length < before.length;
}
