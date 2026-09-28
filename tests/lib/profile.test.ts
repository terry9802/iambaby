import { describe, expect, it } from 'vitest';
import { profileCompletion, sanitizeProfile } from '@/lib/profile/schema';

describe('프로필', () => {
  it('저장소에서 읽은 이상한 값은 조용히 버린다', () => {
    const dirty = {
      birthYear: '1990',
      maritalStatus: 'complicated',
      income: { monthlyWage: 3000000, annualSalary: -1 },
      children: [{ birthDate: '2026-03-01' }, { birthDate: 'nope' }, {}],
      spouse: { monthlyWage: 2500000 },
      junk: { evil: true },
    };
    const clean = sanitizeProfile(dirty);
    expect(clean.birthYear).toBeUndefined();
    expect(clean.maritalStatus).toBeUndefined();
    expect(clean.income).toEqual({ monthlyWage: 3000000 });
    expect(clean.children).toEqual([{ birthDate: '2026-03-01' }]);
    expect(clean.spouse).toEqual({ monthlyWage: 2500000 });
    expect('junk' in clean).toBe(false);
  });

  it('빈 값·잘못된 타입도 예외 없이 빈 프로필이 된다', () => {
    expect(sanitizeProfile(null)).toEqual({});
    expect(sanitizeProfile('nope')).toEqual({});
    expect(sanitizeProfile(undefined)).toEqual({});
  });

  it('채워진 정도를 센다', () => {
    expect(profileCompletion({})).toEqual({ filled: 0, total: 8 });
    expect(
      profileCompletion({
        birthYear: 1990,
        maritalStatus: 'married',
        income: { monthlyWage: 3000000, annualSalary: 42000000 },
      }),
    ).toEqual({ filled: 4, total: 8 });
  });

  it('혼인신고일과 배우자 연봉을 받아 둔다', () => {
    // 카드 공제와 결혼세액공제가 이 두 값으로 갈린다.
    const clean = sanitizeProfile({
      marriageDate: '2026-05-20',
      spouse: { monthlyWage: 2500000, annualSalary: 38000000 },
    });
    expect(clean.marriageDate).toBe('2026-05-20');
    expect(clean.spouse).toEqual({ monthlyWage: 2500000, annualSalary: 38000000 });
  });

  it('날짜 꼴이 아닌 혼인신고일은 버린다', () => {
    expect(sanitizeProfile({ marriageDate: '2026년 5월' }).marriageDate).toBeUndefined();
    expect(sanitizeProfile({ marriageDate: 20260520 }).marriageDate).toBeUndefined();
  });
});
