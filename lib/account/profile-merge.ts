import { EMPTY_PROFILE, sanitizeProfile, type Profile } from '@/lib/profile/schema';

/**
 * 기기 둘이 들고 있는 프로필 중 어느 쪽을 쓸지 고른다.
 *
 * 가계부처럼 줄 단위로 합치지 않는다. 프로필은 한 장짜리 서식이고, 칸끼리
 * 섞으면 말이 안 되는 조합이 나온다. 예를 들어 '미혼'인데 혼인신고일이 남아
 * 있는 상태가 그렇다. 그래서 통째로 나중에 고친 쪽을 쓴다.
 *
 * 비어 있는 프로필은 지지 않게 한다. 새 기기로 처음 들어오면 그 기기의 프로필은
 * 비어 있는데, 그걸 '방금 만든 최신'으로 치면 서버에 있던 연봉을 빈 값으로
 * 덮어 버린다. 로그인했더니 프로필이 날아가는 셈이다.
 */

export type Stamped = { profile: Profile; at: string | null };

export function isBlank(profile: Profile): boolean {
  return Object.keys(sanitizeProfile(profile)).length === 0;
}

export function laterProfile(mine: Stamped, theirs: Stamped): Stamped {
  const a = { profile: sanitizeProfile(mine.profile), at: mine.at };
  const b = { profile: sanitizeProfile(theirs.profile), at: theirs.at };

  const aBlank = isBlank(a.profile);
  const bBlank = isBlank(b.profile);
  if (aBlank && bBlank) return { profile: EMPTY_PROFILE, at: a.at ?? b.at };
  // 빈 쪽이 채워진 쪽을 덮지 않는다. 시각이 더 최근이어도 마찬가지다.
  if (aBlank) return b;
  if (bBlank) return a;

  // 둘 다 채워져 있으면 나중에 고친 쪽. 시각이 없는 쪽은 제일 오래된 것으로 본다.
  return (b.at ?? '') > (a.at ?? '') ? b : a;
}

/** 두 프로필이 같은 내용인가. 괜히 다시 올리지 않으려고 본다. */
export function sameProfile(a: Profile, b: Profile): boolean {
  return JSON.stringify(sanitizeProfile(a)) === JSON.stringify(sanitizeProfile(b));
}
