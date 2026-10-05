import { describe, expect, it } from 'vitest';
import { isBlank, laterProfile, sameProfile } from '@/lib/account/profile-merge';
import type { Profile } from '@/lib/profile/schema';

const filled = (salary: number): Profile => ({
  maritalStatus: 'single',
  income: { annualSalary: salary },
});

describe('프로필 고르기', () => {
  it('나중에 고친 쪽을 쓴다', () => {
    const old = { profile: filled(5000), at: '2026-10-01T00:00:00Z' };
    const neu = { profile: filled(6000), at: '2026-10-05T00:00:00Z' };
    expect(laterProfile(old, neu).profile.income?.annualSalary).toBe(6000);
    // 순서를 바꿔도 같은 답
    expect(laterProfile(neu, old).profile.income?.annualSalary).toBe(6000);
  });

  it('빈 프로필이 채워진 프로필을 덮지 않는다 — 새 기기로 로그인했다고 연봉이 날아가면 안 된다', () => {
    const server = { profile: filled(5678), at: '2026-10-01T00:00:00Z' };
    // 새 기기: 비어 있는데 시각은 더 최근
    const fresh = { profile: {}, at: '2026-10-09T00:00:00Z' };
    expect(laterProfile(fresh, server).profile.income?.annualSalary).toBe(5678);
    expect(laterProfile(server, fresh).profile.income?.annualSalary).toBe(5678);
  });

  it('둘 다 비어 있으면 빈 채로 둔다', () => {
    const out = laterProfile({ profile: {}, at: null }, { profile: {}, at: '2026-10-01' });
    expect(isBlank(out.profile)).toBe(true);
  });

  it('시각이 없는 쪽은 제일 오래된 것으로 본다', () => {
    const noStamp = { profile: filled(1000), at: null };
    const stamped = { profile: filled(2000), at: '2026-01-01T00:00:00Z' };
    expect(laterProfile(noStamp, stamped).profile.income?.annualSalary).toBe(2000);
    expect(laterProfile(stamped, noStamp).profile.income?.annualSalary).toBe(2000);
  });

  it('시각이 같으면 내 것을 둔다 — 깜빡이지 않게', () => {
    const a = { profile: filled(1000), at: '2026-10-05T00:00:00Z' };
    const b = { profile: filled(2000), at: '2026-10-05T00:00:00Z' };
    expect(laterProfile(a, b).profile.income?.annualSalary).toBe(1000);
  });

  it('고른 쪽의 시각도 같이 따라온다 — 안 그러면 다음 번에 또 뒤집힌다', () => {
    const old = { profile: filled(5000), at: '2026-10-01T00:00:00Z' };
    const neu = { profile: filled(6000), at: '2026-10-05T00:00:00Z' };
    expect(laterProfile(old, neu).at).toBe('2026-10-05T00:00:00Z');
  });

  it('이상한 값이 섞여 와도 버리고 읽는다', () => {
    const dirty = { profile: { income: { annualSalary: '많이' } } as unknown as Profile, at: '2026-10-09' };
    const good = { profile: filled(5000), at: '2026-10-01T00:00:00Z' };
    expect(laterProfile(dirty, good).profile.income?.annualSalary).toBe(5000);
  });

  it('같은 내용인지 가린다', () => {
    expect(sameProfile(filled(5000), filled(5000))).toBe(true);
    expect(sameProfile(filled(5000), filled(6000))).toBe(false);
    expect(sameProfile({}, {})).toBe(true);
  });
});
