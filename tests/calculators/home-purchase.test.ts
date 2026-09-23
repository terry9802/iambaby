import { describe, expect, it } from 'vitest';
import { calcHomePurchase } from '@/lib/calculators/home-purchase';

const EOK = 100000000;
const MAN = 10000;
const ASOF = '2026-06-01';

describe('집 살 때 드는 돈 계산기', () => {
  it('6억 이하는 취득세 1%', () => {
    const out = calcHomePurchase({ price: 5 * EOK, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.acquisitionRate).toBe(0.01);
    expect(out.result.value.acquisitionTax).toBe(500 * MAN);
    // 전용 84㎡는 농특세 면제
    expect(out.result.value.ruralTax).toBe(0);
    // 지방교육세 = 1% × 50% × 20% = 0.1%
    expect(out.result.value.localEducationTax).toBe(50 * MAN);
  });

  it('9억 초과는 취득세 3%', () => {
    const out = calcHomePurchase({ price: 10 * EOK, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.acquisitionRate).toBe(0.03);
    expect(out.result.value.acquisitionTax).toBe(3000 * MAN);
    expect(out.result.value.localEducationTax).toBe(300 * MAN);
  });

  it('6억~9억 구간은 계단이 아니라 기울기다', () => {
    // 지방세법 제11조: (취득가액 × 2 ÷ 3억 − 3) × 1/100, 소수점 넷째자리까지
    // 7.5억 → (7.5억 × 2 ÷ 3억 − 3) / 100 = (5 − 3) / 100 = 2%
    const out = calcHomePurchase({ price: 7.5 * EOK, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.acquisitionRate).toBe(0.02);
    expect(out.result.value.acquisitionTax).toBe(1500 * MAN);

    // 경계에서 이어져야 한다. 6억은 1%, 9억은 3%.
    const at6 = calcHomePurchase({ price: 6 * EOK, areaSqm: 84, asOf: ASOF });
    const at9 = calcHomePurchase({ price: 9 * EOK, areaSqm: 84, asOf: ASOF });
    if (!at6.ok || !at9.ok) throw new Error('계산 실패');
    expect(at6.result.value.acquisitionRate).toBe(0.01);
    expect(at9.result.value.acquisitionRate).toBe(0.03);
  });

  it('전용 85㎡를 넘으면 농어촌특별세 0.2%가 붙는다', () => {
    const out = calcHomePurchase({ price: 5 * EOK, areaSqm: 101, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.ruralTax).toBe(100 * MAN);
  });

  it('조정대상지역 2주택은 8% 중과', () => {
    const out = calcHomePurchase({
      price: 5 * EOK,
      housesAfter: 2,
      regulated: true,
      areaSqm: 84,
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.acquisitionRate).toBe(0.08);
    expect(out.result.value.acquisitionTax).toBe(4000 * MAN);
    // 중과면 지방교육세는 0.4% 고정
    expect(out.result.value.localEducationTax).toBe(200 * MAN);
  });

  it('비조정대상지역 2주택은 중과가 아니다', () => {
    const out = calcHomePurchase({
      price: 5 * EOK,
      housesAfter: 2,
      regulated: false,
      areaSqm: 84,
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.acquisitionRate).toBe(0.01);
  });

  it('비조정 3주택은 8%, 4주택 이상은 12%', () => {
    const three = calcHomePurchase({ price: 5 * EOK, housesAfter: 3, areaSqm: 84, asOf: ASOF });
    const four = calcHomePurchase({ price: 5 * EOK, housesAfter: 4, areaSqm: 84, asOf: ASOF });
    const five = calcHomePurchase({ price: 5 * EOK, housesAfter: 5, areaSqm: 84, asOf: ASOF });
    if (!three.ok || !four.ok || !five.ok) throw new Error('계산 실패');
    expect(three.result.value.acquisitionRate).toBe(0.08);
    expect(four.result.value.acquisitionRate).toBe(0.12);
    expect(five.result.value.acquisitionRate).toBe(0.12);
  });

  it('중과 85㎡ 초과는 농특세가 0.6%·1.0%로 오른다', () => {
    const eight = calcHomePurchase({ price: 5 * EOK, housesAfter: 3, areaSqm: 101, asOf: ASOF });
    const twelve = calcHomePurchase({ price: 5 * EOK, housesAfter: 4, areaSqm: 101, asOf: ASOF });
    if (!eight.ok || !twelve.ok) throw new Error('계산 실패');
    expect(eight.result.value.ruralTax).toBe(300 * MAN);
    expect(twelve.result.value.ruralTax).toBe(500 * MAN);
  });

  it('생애최초 감면은 2,000,000원 한도', () => {
    const out = calcHomePurchase({ price: 5 * EOK, firstHome: true, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.reliefApplied).toBe(200 * MAN);
    expect(out.result.value.acquisitionTax).toBe(500 * MAN - 200 * MAN);
  });

  it('생애최초 감면은 12억을 넘으면 안 나온다', () => {
    const out = calcHomePurchase({ price: 13 * EOK, firstHome: true, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.firstHomeEligible).toBe(false);
    expect(out.result.value.reliefApplied).toBe(0);
    expect(out.result.warnings.some((w) => w.includes('한도를 넘어서'))).toBe(true);
  });

  it('전용 60㎡ 이하 6억 이하는 감면 한도가 3,000,000원', () => {
    const out = calcHomePurchase({ price: 5 * EOK, firstHome: true, areaSqm: 59, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.reliefApplied).toBe(300 * MAN);
  });

  it('중개보수는 구간별 상한과 한도액을 따른다', () => {
    // 5천만 미만 0.6%에 한도 25만원
    const small = calcHomePurchase({ price: 4000 * MAN, areaSqm: 40, asOf: ASOF });
    if (!small.ok) throw new Error('계산 실패');
    expect(small.result.value.brokerFeeCeiling).toBe(24 * MAN);

    // 1억이면 0.5% = 50만원 (한도 80만원 안)
    const mid = calcHomePurchase({ price: 1 * EOK, areaSqm: 59, asOf: ASOF });
    if (!mid.ok) throw new Error('계산 실패');
    expect(mid.result.value.brokerFeeCeiling).toBe(50 * MAN);

    // 5억이면 0.4% = 200만원, 한도 없음
    const big = calcHomePurchase({ price: 5 * EOK, areaSqm: 84, asOf: ASOF });
    if (!big.ok) throw new Error('계산 실패');
    expect(big.result.value.brokerFeeCeiling).toBe(200 * MAN);

    // 15억이면 0.7% = 1,050만원
    const luxury = calcHomePurchase({ price: 15 * EOK, areaSqm: 84, asOf: ASOF });
    if (!luxury.ok) throw new Error('계산 실패');
    expect(luxury.result.value.brokerFeeCeiling).toBe(1050 * MAN);
  });

  it('집값 말고 더 드는 돈을 합쳐서 보여준다', () => {
    const out = calcHomePurchase({ price: 5 * EOK, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    const v = out.result.value;
    // 취득세 500만 + 지방교육세 50만 + 농특세 0 + 중개보수 200만 + 부가세 20만
    expect(v.extraTotal).toBe(770 * MAN);
    expect(v.grandTotal).toBe(5 * EOK + 770 * MAN);
  });

  it('전용면적을 안 넣으면 농특세가 붙는 쪽으로 계산하고 그 사실을 알린다', () => {
    const out = calcHomePurchase({ price: 5 * EOK, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.ruralTax).toBe(100 * MAN);
    expect(out.result.warnings[0]).toContain('전용면적을 넣어주세요');
  });

  it('법무사 보수는 넣지 않았다고 분명히 말한다', () => {
    const out = calcHomePurchase({ price: 5 * EOK, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('법무사'))).toBe(true);
  });

  it('0·빈 입력은 무엇이 부족한지 돌려준다', () => {
    expect(calcHomePurchase({}).ok).toBe(false);
    expect(calcHomePurchase({ price: 0 }).ok).toBe(false);
  });

  it('근거는 지방세법 조문이다', () => {
    const out = calcHomePurchase({ price: 5 * EOK, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.basis[0].source).toContain('지방세법');
  });
});
