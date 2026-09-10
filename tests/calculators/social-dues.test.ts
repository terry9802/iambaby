import { describe, expect, it } from 'vitest';
import { calcSocialDues } from '@/lib/calculators/social-dues';

const MAN = 10000;

describe('경조사비 계산기', () => {
  it('정상: 같은 팀 동료 결혼식에 가서 식사까지 하면 10만원', () => {
    const out = calcSocialDues({
      occasion: 'wedding',
      relation: 'teamColleague',
      frequency: 'weekly',
      closeness: 'normal',
      attendance: 'attendMeal',
      venue: 'normal',
      partySize: 1,
    });
    if (!out.ok) throw new Error('계산 실패');
    // 설문에서 직장 동료 축의금 1위가 10만원이었다. 13만원 같은 금액은 내지 않는다.
    expect(out.result.value.recommended).toBe(10 * MAN);
    expect(out.result.value.mealFloor).toBe(5 * MAN);
    expect(out.result.value.max).toBe(15 * MAN);
  });

  it('하한: 식사를 하면 최소한 식대는 넘긴다', () => {
    const out = calcSocialDues({
      occasion: 'wedding',
      relation: 'work',
      frequency: 'rare',
      closeness: 'distant',
      attendance: 'attendMeal',
      venue: 'hotel',
      partySize: 2,
    });
    if (!out.ok) throw new Error('계산 실패');
    // 관계만 보면 3만원이지만 호텔 식사 2명이면 20만원
    expect(out.result.value.mealFloor).toBe(20 * MAN);
    expect(out.result.value.recommended).toBe(20 * MAN);
    expect(out.result.warnings.some((w) => w.includes('식대만큼으로 올렸'))).toBe(true);
  });

  it('상호성: 그 사람이 나에게 냈던 금액보다 적게 내지 않는다', () => {
    const out = calcSocialDues({
      occasion: 'wedding',
      relation: 'friend',
      frequency: 'rare',
      closeness: 'distant',
      attendance: 'absent',
      receivedBefore: 30 * MAN,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.recommended).toBe(30 * MAN);
    expect(out.result.value.reciprocityFloor).toBe(30 * MAN);
  });

  it('상한: 가까운 가족은 가장 높은 구간에서 시작한다', () => {
    const out = calcSocialDues({
      occasion: 'wedding',
      relation: 'family',
      frequency: 'weekly',
      closeness: 'close',
      attendance: 'attendMeal',
      partySize: 2,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.recommended).toBeGreaterThanOrEqual(50 * MAN);
  });

  it('경계값: 못 가고 봉투만 보내면 식대 하한이 붙지 않는다', () => {
    const absent = calcSocialDues({
      occasion: 'wedding',
      relation: 'otherColleague',
      frequency: 'fewTimesYear',
      attendance: 'absent',
    });
    if (!absent.ok) throw new Error('계산 실패');
    expect(absent.result.value.mealFloor).toBe(0);
    expect(absent.result.value.recommended).toBeLessThanOrEqual(5 * MAN);
  });

  it('바로 위 단위에 거의 닿으면 그쪽으로 올린다', () => {
    // 가까운 가족 · 자주 봄 · 아주 친함 = 46.8만원. 50만원의 90%를 넘으므로 50만원으로 올린다.
    const promoted = calcSocialDues({
      occasion: 'wedding',
      relation: 'family',
      frequency: 'weekly',
      closeness: 'close',
      attendance: 'attendMeal',
    });
    if (!promoted.ok) throw new Error('계산 실패');
    expect(promoted.result.value.recommended).toBe(50 * MAN);

    // 같은 조건에 불참이면 39.8만원. 90%에 못 미쳐 30만원으로 내린다.
    const floored = calcSocialDues({
      occasion: 'wedding',
      relation: 'family',
      frequency: 'weekly',
      closeness: 'close',
      attendance: 'absent',
    });
    if (!floored.ok) throw new Error('계산 실패');
    expect(floored.result.value.recommended).toBe(30 * MAN);
  });

  it('돌잔치는 결혼식보다 낮게 잡는다', () => {
    const wedding = calcSocialDues({ occasion: 'wedding', relation: 'friend', attendance: 'absent' });
    const birthday = calcSocialDues({
      occasion: 'firstBirthday',
      relation: 'friend',
      attendance: 'absent',
    });
    if (!wedding.ok || !birthday.ok) throw new Error('계산 실패');
    expect(birthday.result.value.recommended).toBeLessThanOrEqual(wedding.result.value.recommended);
  });

  it('0·빈 입력은 무엇이 부족한지 돌려준다', () => {
    const out = calcSocialDues({});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.missing.map((m) => m.field)).toEqual(['occasion', 'relation']);
  });

  it('정답이 없다는 점과 상호성이 가장 강한 기준임을 반드시 경고한다', () => {
    const out = calcSocialDues({ occasion: 'wedding', relation: 'friend' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('법이 아니라 관습'))).toBe(true);
    expect(out.result.warnings.some((w) => w.includes('냈던 금액'))).toBe(true);
  });

  it('장례식에는 봉투 문구를 알려준다', () => {
    const out = calcSocialDues({ occasion: 'funeral', relation: 'teamColleague' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('부의'))).toBe(true);
    expect(out.result.value.occasionLabel).toBe('조의금');
  });

  it('근거는 설문조사이고 법령이 아님을 밝힌다', () => {
    const out = calcSocialDues({ occasion: 'wedding', relation: 'friend' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.basis[0].source).toContain('조사');
    expect(out.result.basis[0].note).toContain('법이 아니라');
  });
});
