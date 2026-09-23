import { describe, expect, it } from 'vitest';
import { calcGiftTax, listGiftRelationships } from '@/lib/calculators/gift-tax';

const EOK = 100000000;
const MAN = 10000;
const GIFT = '2026-03-15';
const TODAY = '2026-03-20';

describe('증여세 계산기', () => {
  it('성인 자녀가 부모에게 1억원을 받으면 4,850,000원', () => {
    // 1억 − 공제 5천만 = 과세표준 5천만 → 10% = 500만 → 신고세액공제 3% 빼고 485만
    const out = calcGiftTax({
      amount: 1 * EOK,
      relationship: 'linealAscendant',
      giftDate: GIFT,
      today: TODAY,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.taxBase).toBe(5000 * MAN);
    expect(out.result.value.grossTax).toBe(500 * MAN);
    expect(out.result.value.filingCredit).toBe(15 * MAN);
    expect(out.result.value.finalTax).toBe(485 * MAN);
  });

  it('공제 한도까지만 받으면 세금이 없고, 남은 여유분을 알려준다', () => {
    const out = calcGiftTax({
      amount: 3000 * MAN,
      relationship: 'linealAscendant',
      giftDate: GIFT,
      today: TODAY,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.finalTax).toBe(0);
    expect(out.result.value.headroom).toBe(2000 * MAN);
  });

  it('10년 안에 이미 받은 것이 있으면 합쳐서 센다', () => {
    // 아버지에게 5천만을 받았으면 어머니에게 받는 5천만은 전부 과세 대상이다.
    const out = calcGiftTax({
      amount: 5000 * MAN,
      priorGifts: 5000 * MAN,
      relationship: 'linealAscendant',
      giftDate: GIFT,
      today: TODAY,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.taxableAmount).toBe(1 * EOK);
    expect(out.result.value.taxBase).toBe(5000 * MAN);
    expect(out.result.value.headroom).toBe(0);
  });

  it('미성년자는 직계존속 공제가 2,000만원이다', () => {
    const out = calcGiftTax({
      amount: 5000 * MAN,
      relationship: 'linealAscendant',
      minor: true,
      giftDate: GIFT,
      today: TODAY,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.relationshipDeduction).toBe(2000 * MAN);
    expect(out.result.value.taxBase).toBe(3000 * MAN);
  });

  it('배우자는 6억원까지 세금이 없다', () => {
    const out = calcGiftTax({
      amount: 6 * EOK,
      relationship: 'spouse',
      giftDate: GIFT,
      today: TODAY,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.finalTax).toBe(0);
  });

  it('혼인·출산 공제를 켜면 1억원이 더 빠진다', () => {
    const out = calcGiftTax({
      amount: 2 * EOK,
      relationship: 'linealAscendant',
      marriageBirth: true,
      giftDate: GIFT,
      today: TODAY,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.marriageBirthDeduction).toBe(1 * EOK);
    expect(out.result.value.taxBase).toBe(5000 * MAN);
    expect(out.result.value.finalTax).toBe(485 * MAN);
  });

  it('혼인·출산 공제는 혼인과 출산을 합쳐 1억원이 한도다', () => {
    const out = calcGiftTax({
      amount: 2 * EOK,
      relationship: 'linealAscendant',
      marriageBirth: true,
      marriageBirthUsed: 1 * EOK,
      giftDate: GIFT,
      today: TODAY,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.marriageBirthDeduction).toBe(0);
  });

  it('혼인·출산 공제는 직계존속에게 받을 때만 적용된다', () => {
    const out = calcGiftTax({
      amount: 2 * EOK,
      relationship: 'otherRelative',
      marriageBirth: true,
      giftDate: GIFT,
      today: TODAY,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.marriageBirthDeduction).toBe(0);
  });

  it('누진공제 방식으로 세금을 센다 (구간별로 쪼개 더하지 않는다)', () => {
    // 6억 − 5천만 = 5.5억 → 10억 이하 구간 30%, 누진공제 6천만
    // 5.5억 × 30% − 6천만 = 1억 500만
    const out = calcGiftTax({
      amount: 6 * EOK,
      relationship: 'linealAscendant',
      giftDate: GIFT,
      today: TODAY,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.taxBase).toBe(55000 * MAN);
    expect(out.result.value.grossTax).toBe(10500 * MAN);
  });

  it('신고기한은 받은 날이 아니라 그 달 말일부터 3개월이다', () => {
    // 국세청 예시: 1월 15일 증여 → 4월 30일까지
    const jan = calcGiftTax({ amount: 1 * EOK, giftDate: '2026-01-15', today: '2026-01-20' });
    if (!jan.ok) throw new Error('계산 실패');
    expect(jan.result.value.filingDueAt).toBe('2026-04-30');

    // 3월 15일 증여 → 6월 30일까지
    const mar = calcGiftTax({ amount: 1 * EOK, giftDate: '2026-03-15', today: '2026-03-20' });
    if (!mar.ok) throw new Error('계산 실패');
    expect(mar.result.value.filingDueAt).toBe('2026-06-30');

    // 4월은 말일이 30일이라 7월 31일이 된다
    const apr = calcGiftTax({ amount: 1 * EOK, giftDate: '2026-04-10', today: '2026-04-20' });
    if (!apr.ok) throw new Error('계산 실패');
    expect(apr.result.value.filingDueAt).toBe('2026-07-31');
  });

  it('기한이 지났으면 지났다고 말한다', () => {
    const out = calcGiftTax({ amount: 1 * EOK, giftDate: '2026-01-15', today: '2026-06-01' });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.filingPassed).toBe(true);
    expect(out.result.warnings[0]).toContain('지났습니다');
  });

  it('0·빈 입력은 무엇이 부족한지 돌려준다', () => {
    expect(calcGiftTax({}).ok).toBe(false);
    expect(calcGiftTax({ amount: 0 }).ok).toBe(false);
  });

  it('근거는 상속세 및 증여세법 조문이다', () => {
    const out = calcGiftTax({ amount: 1 * EOK, giftDate: GIFT, today: TODAY });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.basis[0].source).toContain('상속세 및 증여세법');
  });

  it('관계 목록은 룰 파일에서 나온다', () => {
    const list = listGiftRelationships(GIFT);
    expect(list.length).toBe(5);
    expect(list.find((r) => r.code === 'spouse')?.deduction).toBe(6 * EOK);
  });
});
