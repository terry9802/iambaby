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
    expect(profileCompletion({})).toEqual({ filled: 0, total: 7 });
  });

  it('아이가 없으면 아이 생일을 세지 않는다', () => {
    // 아이 없는 사람에게 아이 생일을 세면 100%가 영영 안 나온다.
    const base = {
      birthYear: 1990,
      maritalStatus: 'single' as const,
      income: { monthlyWage: 3000000, annualSalary: 42000000 },
      employment: { joinDate: '2020-03-02' },
      residence: { sido: 'other' },
    };
    expect(profileCompletion({ ...base, childPlan: 'none' })).toEqual({ filled: 7, total: 7 });
    // 아이가 있다고 하면 그때 한 칸이 늘고, 아직 안 적었으니 미달이다.
    expect(profileCompletion({ ...base, childPlan: 'has' })).toEqual({ filled: 7, total: 8 });
  });

  it('미혼이면 배우자 칸을 세지 않는다', () => {
    const single = profileCompletion({ maritalStatus: 'single', childPlan: 'none' });
    const wed = profileCompletion({ maritalStatus: 'married', childPlan: 'none' });
    expect(wed.total - single.total).toBe(3); // 혼인신고일 + 배우자 통상임금 + 배우자 연봉
  });

  it("'그 밖의 지역'을 골라도 거주지 한 칸은 채워진 것으로 본다", () => {
    // 시·군·구 목록은 룰이 있는 지역에만 뜬다. 없는 칸을 못 채웠다고 하면 안 된다.
    const { filled } = profileCompletion({ residence: { sido: 'other' } });
    expect(filled).toBe(1);
  });

  it('있을 수 없는 태어난 해는 안 받는다', () => {
    // 네 자리를 다 치기 전에 저장되면 "199년생"이 남는다.
    expect(sanitizeProfile({ birthYear: 199 }).birthYear).toBeUndefined();
    expect(sanitizeProfile({ birthYear: 2999 }).birthYear).toBeUndefined();
    expect(sanitizeProfile({ birthYear: 1992 }).birthYear).toBe(1992);
  });

  it('아이 상황을 받아 둔다', () => {
    expect(sanitizeProfile({ childPlan: 'expecting' }).childPlan).toBe('expecting');
    expect(sanitizeProfile({ childPlan: 'maybe' }).childPlan).toBeUndefined();
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
