import { describe, expect, it } from 'vitest';
import { checkBirthGrants, listSeoulDistricts } from '@/lib/calculators/birth-grants';

const MAN = 10000;
const BIRTH = '2026-03-01';

describe('출산·육아 지원금 통합 조회', () => {
  it('정상: 서울 강남구 첫째는 전 기간 3,450만원 · 첫 1년 1,890만원', () => {
    const out = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'first',
      sido: 'seoul',
      sigungu: 'gangnam',
      today: '2026-03-05',
    });
    if (!out.ok) throw new Error('계산 실패');

    // 첫만남 200 + 부모급여 1,800 + 아동수당 1,080 + 산후조리 100 + 교통비 70 + 강남 200
    expect(out.result.value.totalAmount).toBe(3450 * MAN);
    // 첫만남 200 + 부모급여 1,200 + 아동수당 120 + 산후조리 100 + 교통비 70 + 강남 200
    expect(out.result.value.firstYearAmount).toBe(1890 * MAN);
    expect(out.result.value.districtStatus).toBe('verified');
  });

  it('출산 순위에 따라 첫만남이용권이 달라진다', () => {
    const second = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'second',
      sido: 'seoul',
      sigungu: 'gangnam',
      today: '2026-03-05',
    });
    if (!second.ok) throw new Error('계산 실패');
    const voucher = second.result.value.grants.find((g) => g.id === 'first-meeting-voucher');
    expect(voucher?.totalAmount).toBe(300 * MAN);
    const seoulCare = second.result.value.grants.find((g) => g.id === 'seoul-postpartum-care');
    expect(seoulCare?.totalAmount).toBe(120 * MAN);
  });

  it('경계값: 출생 후 60일째까지는 부모급여 신청이 살아 있고 61일째에 지난다', () => {
    const day60 = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'first',
      today: '2026-04-30', // 출생일 + 60일
    });
    if (!day60.ok) throw new Error('계산 실패');
    const benefit60 = day60.result.value.grants.find((g) => g.id === 'parental-benefit');
    expect(benefit60?.deadline?.status).toBe('open');
    expect(benefit60?.deadline?.dDay).toBe(0);

    const day61 = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'first',
      today: '2026-05-01',
    });
    if (!day61.ok) throw new Error('계산 실패');
    const benefit61 = day61.result.value.grants.find((g) => g.id === 'parental-benefit');
    expect(benefit61?.deadline?.status).toBe('passed');
    expect(day61.result.warnings.some((w) => w.includes('기한이 지난'))).toBe(true);
  });

  it('나중에 신청하는 지원(광진구 첫돌축하금)은 아직 창구가 열리지 않았음을 표시한다', () => {
    const out = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'first',
      sido: 'seoul',
      sigungu: 'gwangjin',
      today: '2026-03-05',
    });
    if (!out.ok) throw new Error('계산 실패');
    const firstBirthday = out.result.value.grants.find((g) => g.id === 'gwangjin-first-birthday');
    expect(firstBirthday?.deadline?.status).toBe('not-yet');
    expect(firstBirthday?.deadline?.opensAt).toBe('2027-03-01');
    expect(firstBirthday?.deadline?.dueAt).toBe('2027-08-28');
  });

  it('셋째부터 주는 구는 첫째에게 항목을 띄우지 않고 그 사실을 알려준다', () => {
    const first = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'first',
      sido: 'seoul',
      sigungu: 'seongdong',
      today: '2026-03-05',
    });
    if (!first.ok) throw new Error('계산 실패');
    expect(first.result.value.grants.some((g) => g.scope === 'district')).toBe(false);
    expect(
      first.result.value.extraNotes.some((n) => n.text.includes('해당되지 않아요')),
    ).toBe(true);

    const third = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'thirdOrMore',
      sido: 'seoul',
      sigungu: 'seongdong',
      today: '2026-03-05',
    });
    if (!third.ok) throw new Error('계산 실패');
    const seongdong = third.result.value.grants.find((g) => g.scope === 'district');
    expect(seongdong?.totalAmount).toBe(300 * MAN);
  });

  it('합계에 넣지 않는 안내(넷째 이상 금액, 현물 지원)를 따로 모아준다', () => {
    const out = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'thirdOrMore',
      sido: 'seoul',
      sigungu: 'yangcheon',
      today: '2026-03-05',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.extraNotes.some((n) => n.text.includes('넷째'))).toBe(true);
    // 서울시 무주택 주거비 지원도 조건부라 합계에 넣지 않는다
    expect(out.result.value.extraNotes.some((n) => n.text.includes('무주택'))).toBe(true);
  });

  it('확인되지 않은 자치구는 금액을 지어내지 않고 그렇다고 말한다', () => {
    const out = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'first',
      sido: 'seoul',
      sigungu: 'nowon',
      today: '2026-03-05',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.districtStatus).toBe('unverified');
    expect(out.result.value.grants.some((g) => g.scope === 'district')).toBe(false);
    expect(out.result.warnings.some((w) => w.includes('노원구'))).toBe(true);
    // 확인 못 한 구라도 조사 중 알게 된 현물 지원은 알려준다
    expect(out.result.value.extraNotes.some((n) => n.scope === '노원구')).toBe(true);
  });

  it('금액을 확인한 자치구는 여덟 곳이고 전부 출처가 붙어 있다', () => {
    const seoul = listSeoulDistricts(BIRTH);
    expect(seoul.length).toBe(25);
    expect(seoul.filter((d) => d.status === 'verified').length).toBe(8);
  });

  it('서울 밖 지역은 중앙정부 지원만 보여주고 그 사실을 알린다', () => {
    const out = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'first',
      sido: 'busan',
      today: '2026-03-05',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.districtStatus).toBe('unsupported');
    expect(out.result.value.totalAmount).toBe(3080 * MAN);
    expect(out.result.warnings.some((w) => w.includes('서울'))).toBe(true);
  });

  it('입력이 비면 무엇이 부족한지 돌려준다', () => {
    const out = checkBirthGrants({});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.missing.map((m) => m.field)).toEqual(['childBirthDate', 'birthOrder']);
  });

  it('마감 30일 이내 항목을 따로 모아준다', () => {
    const out = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'first',
      today: '2026-04-10',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.urgent.map((g) => g.id).sort()).toEqual([
      'child-allowance',
      'parental-benefit',
    ]);
  });

  it('근거와 계산 과정을 채운다', () => {
    const out = checkBirthGrants({
      childBirthDate: BIRTH,
      birthOrder: 'first',
      sido: 'seoul',
      sigungu: 'gangnam',
      today: '2026-03-05',
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.basis.length).toBe(2);
    expect(out.result.steps.length).toBeGreaterThan(3);
  });
});
