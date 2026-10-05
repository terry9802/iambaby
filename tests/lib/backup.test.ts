import { beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUP_STORAGE_KEY,
  keepSnapshot,
  loadSnapshots,
  MAX_SNAPSHOTS,
  sanitizeSnapshots,
  shrinks,
} from '@/lib/ledger/backup';
import type { Entry } from '@/lib/ledger/schema';

/** 브라우저 저장소 흉내. 테스트는 node에서 돌아서 진짜 localStorage가 없다. */
function fakeStorage(limitBytes = Infinity) {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > limitBytes) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
  };
}

function install(storage: ReturnType<typeof fakeStorage>) {
  (globalThis as { window?: unknown }).window = { localStorage: storage };
}

function rows(n: number, each = 1000): Entry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    date: '2026-03-14',
    amount: each,
    purse: 'personal' as const,
    method: 'credit' as const,
    holder: 'me' as const,
    category: 'general' as const,
  }));
}

describe('자동 백업', () => {
  beforeEach(() => install(fakeStorage()));

  it('떠 둔 걸 그대로 읽어 온다', () => {
    expect(keepSnapshot(rows(3), '2026-10-05T01:00:00Z')).toBe(true);
    const got = loadSnapshots();
    expect(got).toHaveLength(1);
    expect(got[0]?.count).toBe(3);
    expect(got[0]?.total).toBe(3000);
    expect(got[0]?.entries).toHaveLength(3);
  });

  it('최근 것이 앞에 온다', () => {
    keepSnapshot(rows(3), '2026-10-05T01:00:00Z');
    keepSnapshot(rows(5), '2026-10-05T02:00:00Z');
    expect(loadSnapshots().map((s) => s.count)).toEqual([5, 3]);
  });

  it('똑같은 모습은 또 안 떠 둔다 — 쌓이면 되돌리고 싶은 어제가 밀려난다', () => {
    expect(keepSnapshot(rows(3), '2026-10-05T01:00:00Z')).toBe(true);
    expect(keepSnapshot(rows(3), '2026-10-05T02:00:00Z')).toBe(false);
    expect(loadSnapshots()).toHaveLength(1);
  });

  it('줄 수가 같아도 금액이 바뀌었으면 떠 둔다', () => {
    keepSnapshot(rows(3, 1000), '2026-10-05T01:00:00Z');
    expect(keepSnapshot(rows(3, 2000), '2026-10-05T02:00:00Z')).toBe(true);
    expect(loadSnapshots()).toHaveLength(2);
  });

  it('빈 가계부는 안 떠 둔다 — 되돌려 봐야 빈 화면이다', () => {
    expect(keepSnapshot([], '2026-10-05T01:00:00Z')).toBe(false);
    expect(loadSnapshots()).toHaveLength(0);
  });

  it(`${MAX_SNAPSHOTS}개까지만 들고 있는다`, () => {
    for (let i = 1; i <= MAX_SNAPSHOTS + 5; i += 1) {
      keepSnapshot(rows(i), `2026-10-05T${String(i).padStart(2, '0')}:00:00Z`);
    }
    const got = loadSnapshots();
    expect(got).toHaveLength(MAX_SNAPSHOTS);
    // 최근 것들이 남아야 한다
    expect(got[0]?.count).toBe(MAX_SNAPSHOTS + 5);
  });

  it('저장소가 꽉 차면 오래된 걸 버리고라도 떠 둔다', () => {
    install(fakeStorage(4000));
    for (let i = 0; i < 6; i += 1) {
      keepSnapshot(rows(10 + i), `2026-10-05T0${i}:00:00Z`);
    }
    const got = loadSnapshots();
    // 다 못 담더라도 최근 것은 남아 있어야 한다
    expect(got.length).toBeGreaterThan(0);
    expect(got[0]?.count).toBe(15);
  });

  it('저장소를 아예 못 쓰면 조용히 포기하고 본 저장을 막지 않는다', () => {
    (globalThis as { window?: unknown }).window = undefined;
    expect(keepSnapshot(rows(3), '2026-10-05T01:00:00Z')).toBe(false);
    expect(loadSnapshots()).toEqual([]);
  });

  it('남이 손댄 백업은 읽을 수 있는 것만 남긴다', () => {
    expect(sanitizeSnapshots('아님')).toEqual([]);
    expect(sanitizeSnapshots([{ at: '2026-10-05', entries: [] }])).toEqual([]);
    expect(sanitizeSnapshots([{ entries: rows(2) }])).toEqual([]);
    expect(sanitizeSnapshots([{ at: '2026-10-05', entries: rows(2) }])).toHaveLength(1);
  });

  it('깨진 글자가 들어 있어도 터지지 않는다', () => {
    const storage = fakeStorage();
    install(storage);
    storage.setItem(BACKUP_STORAGE_KEY, '{{{아님');
    expect(loadSnapshots()).toEqual([]);
  });

  it('줄어드는 저장만 백업 대상으로 본다', () => {
    expect(shrinks(rows(5), rows(3))).toBe(true);
    expect(shrinks(rows(5), rows(4))).toBe(true);
    expect(shrinks(rows(5), rows(5))).toBe(false);
    expect(shrinks(rows(3), rows(9))).toBe(false);
    expect(shrinks([], rows(0))).toBe(false);
  });
});
