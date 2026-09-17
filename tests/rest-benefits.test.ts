import { describe, expect, test } from 'vitest';
import { checkRestBenefits } from '@/lib/calculators/rest-benefits';

const T = '2026-03-01';

function run(input: Parameters<typeof checkRestBenefits>[0]) {
  const out = checkRestBenefits({ today: T, ...input });
  if (!out.ok) throw new Error('입력이 모자랍니다: ' + out.missing.map((m) => m.field).join(','));
  return out.result.value;
}

describe('쉼 지원 판정', () => {
  test('태어난 해와 소득 구분이 없으면 계산하지 않고 무엇이 필요한지 알려준다', () => {
    const out = checkRestBenefits({ today: T });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.missing.map((m) => m.field)).toEqual(['birthYear', 'income']);
  });

  test('대기업 다니는 30대 비수급자는 해당되는 게 없다', () => {
    const v = run({ birthYear: 1994, income: 'none', workplace: 'other' });
    expect(v.eligible).toHaveLength(0);
    // 왜 안 되는지는 다섯 개 모두 이유가 붙어야 한다
    expect(v.missed).toHaveLength(5);
    expect(v.missed.map((m) => m.id)).toContain('worker-vacation');
  });

  test('중소기업 재직자는 근로자 휴가지원사업 하나가 잡히고, 이득은 20만원이다', () => {
    const v = run({ birthYear: 1994, income: 'none', workplace: 'sme' });
    expect(v.eligible.map((b) => b.id)).toEqual(['worker-vacation']);
    const vacation = v.eligible[0];
    expect(vacation.yearlyAmount).toBe(400_000);
    expect(vacation.myCost).toBe(200_000);
    expect(vacation.netGain).toBe(200_000);
    expect(vacation.applyBy).toBe('company');
    // 40만원을 다 번 것처럼 보이면 안 된다
    expect(v.totalNet).toBe(200_000);
  });

  test('2006년생 비수도권 청년은 청년문화예술패스 20만원', () => {
    const v = run({ birthYear: 2006, income: 'none', region: 'nonCapital' });
    const pass = v.eligible.find((b) => b.id === 'youth-culture-pass');
    expect(pass?.amount).toBe(200_000);
    expect(pass?.myCost).toBe(0);
  });

  test('같은 청년이 수도권이면 15만원', () => {
    const v = run({ birthYear: 2006, income: 'none', region: 'capital' });
    expect(v.eligible.find((b) => b.id === 'youth-culture-pass')?.amount).toBe(150_000);
  });

  test('2005년생은 청년문화예술패스 대상이 아니다', () => {
    const v = run({ birthYear: 2005, income: 'none' });
    expect(v.eligible.find((b) => b.id === 'youth-culture-pass')).toBeUndefined();
    expect(v.missed.find((m) => m.id === 'youth-culture-pass')?.reason).toContain('2006~2007');
  });

  test('기초생활수급 15세는 문화누리카드에 청소년 추가지원금 1만원이 붙는다', () => {
    const v = run({ birthYear: 2011, income: 'basic' });
    const nuri = v.eligible.find((b) => b.id === 'culture-nuri');
    expect(nuri?.amount).toBe(160_000);
    expect(nuri?.bonusLabels.join()).toContain('청소년');
  });

  test('62세 차상위는 준고령 추가지원금 1만원이 붙는다', () => {
    const v = run({ birthYear: 1964, income: 'nearpoor' });
    expect(v.eligible.find((b) => b.id === 'culture-nuri')?.amount).toBe(160_000);
  });

  test('40대 비수급자여도 장애가 있으면 스포츠강좌이용권은 월 11만원으로 잡힌다', () => {
    const v = run({ birthYear: 1985, income: 'none', disabled: true });
    const sports = v.eligible.find((b) => b.id === 'sports-voucher');
    expect(sports?.amount).toBe(110_000);
    expect(sports?.unit).toBe('month');
    // 월 지원은 1년으로 환산해 합계에 넣는다
    expect(sports?.yearlyAmount).toBe(1_320_000);
  });

  test('신청 기간이 지난 것은 마감으로 표시한다', () => {
    const v = run({ birthYear: 2011, income: 'basic', today: '2026-12-05' } as never);
    const nuri = v.eligible.find((b) => b.id === 'culture-nuri');
    expect(nuri?.applyStatus).toBe('closed');
  });

  test('산림복지는 신청 기간을 확인 못 했으므로 지어내지 않고 unknown으로 둔다', () => {
    const v = run({ birthYear: 1980, income: 'basic' });
    const forest = v.eligible.find((b) => b.id === 'forest-voucher');
    expect(forest?.applyStatus).toBe('unknown');
    expect(forest?.dDay).toBeNull();
    expect(forest?.phone?.number).toBe('1544-3228');
  });

  test('해당되는 게 없으면 없다고 경고한다', () => {
    const out = checkRestBenefits({ birthYear: 1994, income: 'none', workplace: 'other', today: T });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.warnings.join()).toContain('해당되는 게 하나도 없습니다');
  });
});
