import { describe, expect, it } from 'vitest';
import { auctionChecklist, calcAuction, failedRoundPrices } from '@/lib/calculators/auction';

const EOK = 100000000;
const MAN = 10000;
const ASOF = '2026-06-01';

describe('경매 총비용 계산기', () => {
  it('입찰보증금은 낙찰가가 아니라 최저매각가격의 10%다', () => {
    // 여기서 헷갈려 보증금을 모자라게 준비하면 입찰 자체가 무효가 된다.
    const out = calcAuction({
      appraised: 6 * EOK,
      minimumPrice: 4 * EOK,
      bid: 45000 * MAN,
      areaSqm: 84,
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.deposit).toBe(4000 * MAN);
    expect(out.result.value.balance).toBe(45000 * MAN - 4000 * MAN);
  });

  it('세금은 집 살 때 계산기와 같은 값이 나온다', () => {
    // 경매로 받아도 유상취득이라 취득세가 같다. 4.5억이면 1% 구간.
    const out = calcAuction({ bid: 45000 * MAN, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    // 취득세 450만 + 지방교육세 45만 + 농특세 0 (85㎡ 이하)
    expect(out.result.value.tax).toBe(495 * MAN);
  });

  it('명도비와 체납 관리비를 더해 진짜 낙찰가를 보여준다', () => {
    const out = calcAuction({
      appraised: 6 * EOK,
      minimumPrice: 4 * EOK,
      bid: 45000 * MAN,
      areaSqm: 84,
      evictionCost: 500 * MAN,
      unpaidDues: 300 * MAN,
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.extraTotal).toBe(495 * MAN + 500 * MAN + 300 * MAN);
    expect(out.result.value.grandTotal).toBe(45000 * MAN + 1295 * MAN);
  });

  it('감정가 대비 몇 %인지 낙찰가가 아니라 총비용으로 센다', () => {
    // "감정가의 75%에 받았다"는 말에 세금과 명도비는 안 들어 있다.
    const out = calcAuction({
      appraised: 6 * EOK,
      minimumPrice: 4 * EOK,
      bid: 45000 * MAN,
      areaSqm: 84,
      evictionCost: 500 * MAN,
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.bidRate).toBeCloseTo(0.75, 4);
    expect(out.result.value.vsAppraised).toBeGreaterThan(0.75);
  });

  it('명도비를 안 넣으면 0원으로 셌다고 경고한다', () => {
    const out = calcAuction({ bid: 45000 * MAN, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('명도비를 0원으로'))).toBe(true);
  });

  it('잔금 기한과 보증금을 잃는다는 사실을 먼저 알린다', () => {
    const out = calcAuction({ bid: 45000 * MAN, minimumPrice: 4 * EOK, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.paymentDeadlineDays).toBe(30);
    expect(out.result.warnings[0]).toContain('잔금 기한');
    expect(out.result.warnings[1]).toContain('보증금');
  });

  it('유찰 저감은 법원이 정한 비율로 센다', () => {
    const twenty = failedRoundPrices(10 * EOK, 0.2, 2);
    expect(twenty[0].price).toBe(10 * EOK);
    expect(twenty[1].price).toBe(8 * EOK);
    expect(twenty[2].price).toBe(64000 * MAN);

    const thirty = failedRoundPrices(10 * EOK, 0.3, 2);
    expect(thirty[1].price).toBe(7 * EOK);
    expect(thirty[2].price).toBe(49000 * MAN);
  });

  it('권리분석 체크리스트에 어디서 확인하는지가 붙어 있다', () => {
    const list = auctionChecklist(ASOF);
    expect(list.length).toBeGreaterThanOrEqual(7);
    for (const item of list) {
      expect(item.where.length, item.id).toBeGreaterThan(5);
      expect(item.body.length, item.id).toBeGreaterThan(30);
    }
    // 가장 크게 물릴 수 있는 항목이 맨 앞에 있어야 한다.
    expect(list[0].id).toBe('senior-tenant');
  });

  it('근거에 민사집행법과 지방세법이 모두 들어간다', () => {
    const out = calcAuction({ bid: 45000 * MAN, areaSqm: 84, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    const sources = out.result.basis.map((b) => b.source).join(' ');
    expect(sources).toContain('민사집행법');
    expect(sources).toContain('지방세법');
  });

  it('0·빈 입력은 무엇이 부족한지 돌려준다', () => {
    expect(calcAuction({}).ok).toBe(false);
    expect(calcAuction({ bid: 0 }).ok).toBe(false);
  });
});
