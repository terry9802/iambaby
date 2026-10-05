import {
  PROFILE_SCHEMA_VERSION,
  PROFILE_STORAGE_KEY,
  sanitizeProfile,
  type Profile,
  type StoredProfile,
} from './schema';

/**
 * 프로필 저장소. localStorage만 쓴다.
 * 서버 전송 경로가 없다는 것이 이 사이트의 신뢰 근거이므로 여기에 네트워크 호출을 추가하지 말 것.
 */

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    // 사파리 프라이빗 모드 등에서 접근 자체가 예외를 던진다.
    return false;
  }
}

export function loadProfile(): Profile {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<StoredProfile>;
    return sanitizeProfile(parsed?.profile);
  } catch {
    return {};
  }
}

/**
 * @param at 고친 시각. 다른 기기에서 받아 온 프로필을 앉힐 때는 그쪽 시각을
 *   그대로 들고 와야 한다. 여기서 '지금'으로 찍으면 받아 온 것이 늘 최신이
 *   되어, 두 기기가 서로를 덮으며 끝없이 왔다 갔다 한다.
 */
export function saveProfile(profile: Profile, at?: string): boolean {
  if (!hasStorage()) return false;
  try {
    const payload: StoredProfile = {
      version: PROFILE_SCHEMA_VERSION,
      updatedAt: at ?? new Date().toISOString(),
      profile: sanitizeProfile(profile),
    };
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearProfile(): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadProfileMeta(): { updatedAt: string | null } {
  if (!hasStorage()) return { updatedAt: null };
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { updatedAt: null };
    const parsed = JSON.parse(raw) as Partial<StoredProfile>;
    return { updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null };
  } catch {
    return { updatedAt: null };
  }
}
