'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { EMPTY_PROFILE, type Profile } from './schema';
import { clearProfile, loadProfile, loadProfileMeta, saveProfile } from './storage';

type ProfileContextValue = {
  profile: Profile;
  /** 첫 렌더에서는 localStorage를 읽기 전이므로 자동 채움을 미뤄야 한다. */
  hydrated: boolean;
  updatedAt: string | null;
  /** 부분 갱신. 기존 값과 얕게 병합한다. */
  update: (patch: Partial<Profile>) => void;
  replace: (next: Profile) => void;
  reset: () => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    setProfile(loadProfile());
    setUpdatedAt(loadProfileMeta().updatedAt);
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Profile) => {
    setProfile(next);
    if (saveProfile(next)) setUpdatedAt(new Date().toISOString());
  }, []);

  const update = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        if (saveProfile(next)) setUpdatedAt(new Date().toISOString());
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    clearProfile();
    setProfile(EMPTY_PROFILE);
    setUpdatedAt(null);
  }, []);

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, hydrated, updatedAt, update, replace: persist, reset }),
    [profile, hydrated, updatedAt, update, persist, reset],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile은 ProfileProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
