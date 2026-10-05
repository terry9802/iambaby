'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { EMPTY_PROFILE, PROFILE_STORAGE_KEY, type Profile } from './schema';
import { clearProfile, loadProfile, loadProfileMeta, saveProfile } from './storage';

/**
 * 프로필은 localStorage라는 React 밖의 저장소에 산다.
 * 그래서 effect로 끌어오지 않고 useSyncExternalStore로 구독한다.
 * 서버 렌더와 첫 클라이언트 렌더는 빈 프로필로 맞춰지고, 그 뒤에 실제 값으로 바뀐다.
 */

type Snapshot = { profile: Profile; updatedAt: string | null };

const EMPTY_SNAPSHOT: Snapshot = { profile: EMPTY_PROFILE, updatedAt: null };

let cache: Snapshot | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 다른 탭에서 고친 값도 따라온다.
  const onStorage = (e: StorageEvent) => {
    if (e.key === PROFILE_STORAGE_KEY || e.key === null) {
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
    cache = { profile: loadProfile(), updatedAt: loadProfileMeta().updatedAt };
  }
  return cache;
}

function getServerSnapshot(): Snapshot {
  return EMPTY_SNAPSHOT;
}

function commit(next: Profile, at?: string) {
  const stamp = at ?? new Date().toISOString();
  const saved = saveProfile(next, stamp);
  cache = { profile: next, updatedAt: saved ? stamp : getSnapshot().updatedAt };
  emit();
}

type ProfileContextValue = {
  profile: Profile;
  /** 첫 렌더에서는 localStorage를 아직 읽지 않았으므로 자동 채움을 미뤄야 한다. */
  hydrated: boolean;
  updatedAt: string | null;
  /** 부분 갱신. 기존 값과 얕게 병합한다. */
  update: (patch: Partial<Profile>) => void;
  replace: (next: Profile) => void;
  /**
   * 다른 기기에서 받아 온 프로필을 그쪽 시각 그대로 앉힌다.
   * 시각을 '지금'으로 다시 찍으면 두 기기가 서로를 덮으며 왔다 갔다 한다.
   */
  adopt: (next: Profile, at: string | null) => void;
  reset: () => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const update = useCallback((patch: Partial<Profile>) => {
    commit({ ...getSnapshot().profile, ...patch });
  }, []);

  const replace = useCallback((next: Profile) => {
    commit(next);
  }, []);

  const adopt = useCallback((next: Profile, at: string | null) => {
    commit(next, at ?? undefined);
  }, []);

  const reset = useCallback(() => {
    clearProfile();
    cache = { profile: EMPTY_PROFILE, updatedAt: null };
    emit();
  }, []);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile: snapshot.profile,
      updatedAt: snapshot.updatedAt,
      hydrated,
      update,
      replace,
      adopt,
      reset,
    }),
    [snapshot, hydrated, update, replace, adopt, reset],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile은 ProfileProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
