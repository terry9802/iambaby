'use client';

import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { byDateDesc, newId, LEDGER_STORAGE_KEY, type Entry, type Grave } from './schema';
import { clearEntries, loadEntries, loadGraves, loadLedgerMeta, saveEntries } from './storage';
import { buryIds, type Side } from './sync-merge';

/**
 * 가계부도 프로필과 같은 자리에 산다. localStorage라는 React 밖의 저장소다.
 * 그래서 effect로 끌어오지 않고 useSyncExternalStore로 구독한다.
 */

type Snapshot = { entries: Entry[]; graves: Grave[]; updatedAt: string | null };

const EMPTY: Snapshot = { entries: [], graves: [], updatedAt: null };

let cache: Snapshot | null = null;
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

function getSnapshot(): Snapshot {
  if (!cache) {
    cache = {
      entries: loadEntries(),
      graves: loadGraves(),
      updatedAt: loadLedgerMeta().updatedAt,
    };
  }
  return cache;
}

function getServerSnapshot(): Snapshot {
  return EMPTY;
}

function commit(next: Entry[], graves?: Grave[]): boolean {
  const sorted = [...next].sort(byDateDesc);
  const tombs = graves ?? getSnapshot().graves;
  const saved = saveEntries(sorted, tombs);
  cache = {
    entries: sorted,
    graves: tombs,
    updatedAt: saved ? new Date().toISOString() : getSnapshot().updatedAt,
  };
  emit();
  return saved;
}

type LedgerContextValue = {
  entries: Entry[];
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

  const reset = useCallback(() => {
    /*
      다 지우기는 묘비도 같이 치운다. 묘비를 남겨 두면 상대 기기의 멀쩡한 기록까지
      따라 지워진다. 이건 '내 기기에서 손 떼기'지 '우리 가계부 지우기'가 아니다.
    */
    clearEntries();
    cache = EMPTY;
    emit();
  }, []);

  const value = useMemo<LedgerContextValue>(
    () => ({
      entries: snapshot.entries,
      graves: snapshot.graves,
      updatedAt: snapshot.updatedAt,
      hydrated,
      add,
      update,
      remove,
      replaceAll,
      applySide,
      reset,
    }),
    [snapshot, hydrated, add, update, remove, replaceAll, applySide, reset],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger는 LedgerProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
