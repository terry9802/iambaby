'use client';

import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { byDateDesc, newId, LEDGER_STORAGE_KEY, type Entry } from './schema';
import { clearEntries, loadEntries, loadLedgerMeta, saveEntries } from './storage';

/**
 * 가계부도 프로필과 같은 자리에 산다. localStorage라는 React 밖의 저장소다.
 * 그래서 effect로 끌어오지 않고 useSyncExternalStore로 구독한다.
 */

type Snapshot = { entries: Entry[]; updatedAt: string | null };

const EMPTY: Snapshot = { entries: [], updatedAt: null };

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
  if (!cache) cache = { entries: loadEntries(), updatedAt: loadLedgerMeta().updatedAt };
  return cache;
}

function getServerSnapshot(): Snapshot {
  return EMPTY;
}

function commit(next: Entry[]): boolean {
  const sorted = [...next].sort(byDateDesc);
  const saved = saveEntries(sorted);
  cache = {
    entries: sorted,
    updatedAt: saved ? new Date().toISOString() : getSnapshot().updatedAt,
  };
  emit();
  return saved;
}

type LedgerContextValue = {
  entries: Entry[];
  hydrated: boolean;
  updatedAt: string | null;
  /** 여러 줄을 한꺼번에 넣는다. 한 건씩 저장하면 저장소를 그만큼 두드린다. */
  add: (drafts: Omit<Entry, 'id'>[]) => boolean;
  update: (id: string, patch: Partial<Omit<Entry, 'id'>>) => boolean;
  remove: (id: string) => boolean;
  replaceAll: (next: Entry[]) => boolean;
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

  const add = useCallback((drafts: Omit<Entry, 'id'>[]) => {
    const rows = drafts.map((d) => ({ ...d, id: newId() }));
    return commit([...getSnapshot().entries, ...rows]);
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<Entry, 'id'>>) => {
    return commit(getSnapshot().entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const remove = useCallback((id: string) => {
    return commit(getSnapshot().entries.filter((e) => e.id !== id));
  }, []);

  const replaceAll = useCallback((next: Entry[]) => commit(next), []);

  const reset = useCallback(() => {
    clearEntries();
    cache = EMPTY;
    emit();
  }, []);

  const value = useMemo<LedgerContextValue>(
    () => ({
      entries: snapshot.entries,
      updatedAt: snapshot.updatedAt,
      hydrated,
      add,
      update,
      remove,
      replaceAll,
      reset,
    }),
    [snapshot, hydrated, add, update, remove, replaceAll, reset],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger는 LedgerProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
