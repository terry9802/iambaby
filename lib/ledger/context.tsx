'use client';

import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { byDateDesc, newId, LEDGER_STORAGE_KEY, type Entry, type Grave } from './schema';
import { loadEntries, loadGraves, loadLedgerMeta, saveEntries } from './storage';
import { buryIds, mergeSides, type Side } from './sync-merge';
import { keepSnapshot, loadSnapshots, shrinks, type Snapshot } from './backup';

/**
 * 가계부도 프로필과 같은 자리에 산다. localStorage라는 React 밖의 저장소다.
 * 그래서 effect로 끌어오지 않고 useSyncExternalStore로 구독한다.
 */

type Shot = {
  entries: Entry[];
  graves: Grave[];
  updatedAt: string | null;
  backups: Snapshot[];
};

const EMPTY: Shot = { entries: [], graves: [], updatedAt: null, backups: [] };

let cache: Shot | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 다른 탭에서 적은 줄도 따라온다.
  const onStorage = (e: StorageEvent) => {
    if (e.key === LEDGER_STORAGE_KEY || e.key === null) {
      cache = null;
      emit();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): Shot {
  if (!cache) {
    cache = {
      entries: loadEntries(),
      graves: loadGraves(),
      updatedAt: loadLedgerMeta().updatedAt,
      backups: loadSnapshots(),
    };
  }
  return cache;
}

function getServerSnapshot(): Shot {
  return EMPTY;
}

function commit(next: Entry[], graves?: Grave[]): boolean {
  const sorted = [...next].sort(byDateDesc);

  /*
    줄이 줄어드는 저장이면 그 전 모습을 떠 둔다.

    사장님 기록이 두 번 사라졌는데 원인을 코드에서 못 찾았다. 합치기는 무작위로
    두들겨 봐도 줄을 삼키지 않는다. 원인을 못 밝힌 채 "이제 괜찮다"고 할 수는
    없으니, 무엇이 줄였든 되돌릴 수 있게 해 둔다. 저장보다 먼저 떠야 지금 것이
    덮이기 전의 모습이 남는다.
  */
  let backups = getSnapshot().backups;
  if (shrinks(getSnapshot().entries, sorted)) {
    if (keepSnapshot(getSnapshot().entries, new Date().toISOString())) backups = loadSnapshots();
  }
  const tombs = graves ?? getSnapshot().graves;
  const saved = saveEntries(sorted, tombs);
  cache = {
    entries: sorted,
    graves: tombs,
    updatedAt: saved ? new Date().toISOString() : getSnapshot().updatedAt,
    backups,
  };
  emit();
  return saved;
}

type LedgerContextValue = {
  entries: Entry[];
  /** 줄이 줄어들기 직전에 떠 둔 모습들. 최근 것이 앞. */
  backups: Snapshot[];
  /** 지운 줄의 흔적. 다른 기기에서 되살아나지 않게 하려고 들고 있는다. */
  graves: Grave[];
  hydrated: boolean;
  updatedAt: string | null;
  /** 여러 줄을 한꺼번에 넣는다. 한 건씩 저장하면 저장소를 그만큼 두드린다. */
  add: (drafts: Omit<Entry, 'id'>[]) => boolean;
  update: (id: string, patch: Partial<Omit<Entry, 'id'>>) => boolean;
  remove: (id: string) => boolean;
  replaceAll: (next: Entry[]) => boolean;
  /** 다른 기기와 맞춘 결과를 통째로 앉힌다. */
  applySide: (side: Side) => boolean;
  /** 떠 둔 모습으로 되돌린다. 지금 것도 떠 두고 바꾼다. */
  restore: (at: string) => boolean;
  reset: () => void;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  /*
    적고 고친 시각을 줄마다 남긴다. 둘이 같은 줄을 각자 고쳤을 때 어느 쪽이
    이기는지는 이 시각으로 가린다. 안 남기면 폰에서 고친 게 컴퓨터의 옛 줄에
    되돌려진다.
  */
  const add = useCallback((drafts: Omit<Entry, 'id'>[]) => {
    const at = new Date().toISOString();
    const rows = drafts.map((d) => ({ ...d, id: newId(), at }));
    return commit([...getSnapshot().entries, ...rows]);
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<Entry, 'id'>>) => {
    const at = new Date().toISOString();
    return commit(
      getSnapshot().entries.map((e) => (e.id === id ? { ...e, ...patch, at } : e)),
    );
  }, []);

  /*
    지울 때는 묘비를 남긴다. 합치기는 더하기만 하므로, 지웠다는 사실이 같이
    건너가지 않으면 다음에 상대 기기에서 그 줄이 되살아난다.
  */
  const remove = useCallback((id: string) => {
    const now = getSnapshot();
    return commit(
      now.entries.filter((e) => e.id !== id),
      buryIds(now.graves, [id], new Date().toISOString()),
    );
  }, []);

  const replaceAll = useCallback((next: Entry[]) => commit(next), []);

  const applySide = useCallback((side: Side) => commit(side.entries, side.graves), []);

  /*
    떠 둔 모습으로 되돌린다.

    묘비는 그대로 둔다. 되돌리기는 '이 기기 화면을 그때로 돌리는 일'이지
    '상대가 지운 걸 되살리는 일'이 아니다. 묘비를 지우면 상대 기기에서 제대로
    지운 줄까지 같이 살아 돌아온다.
  */
  const restore = useCallback((at: string) => {
    const shot = loadSnapshots().find((s) => s.at === at);
    if (!shot) return false;
    const now = getSnapshot();
    // 되돌리기 직전 모습도 떠 둔다. 잘못 되돌리셨을 때 다시 돌아올 자리가 있어야 한다.
    if (now.entries.length > 0) keepSnapshot(now.entries, new Date().toISOString());
    const merged = mergeSides(
      { entries: shot.entries, graves: [] },
      { entries: now.entries, graves: now.graves },
    );
    return commit(merged.entries, merged.graves);
  }, []);

  /*
    기록 전부 지우기.

    묘비는 남긴다. 처음엔 같이 치웠는데, 그러면 전에 지운 줄이 되살아난다.
    묘비를 들고 있던 기기가 이 기기뿐이었으면, 지웠다는 사실이 세상에서 사라져서
    상대 기기에 남아 있던 그 줄이 다음 합치기에 다시 올라온다. 무작위 시험에서
    실제로 그렇게 됐다.

    줄을 비우는 일은 commit에 맡긴다. 그래야 지우기 전 모습이 '되살리기'에
    자동으로 떠 두어진다.
  */
  const reset = useCallback(() => commit([], getSnapshot().graves), []);

  const value = useMemo<LedgerContextValue>(
    () => ({
      entries: snapshot.entries,
      graves: snapshot.graves,
      backups: snapshot.backups,
      updatedAt: snapshot.updatedAt,
      hydrated,
      add,
      update,
      remove,
      replaceAll,
      applySide,
      restore,
      reset,
    }),
    [snapshot, hydrated, add, update, remove, replaceAll, applySide, restore, reset],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger는 LedgerProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
