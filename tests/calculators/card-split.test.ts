import { describe, expect, it } from 'vitest';
import {
  calcCardSplit,
  cardDeductionRule,
  cardSplitVerdict,
  deductionOf,
} from '@/lib/calculators/card-split';

const MAN = 10000;
const ASOF = '2026-09-01';
const rule = cardDeductionRule(ASOF);

describe('신용카드 소득공제 계산', () => {
  it('총급여의 25%를 안 넘기면 공제가 0원이다', () => {
    // 총급여 5,000만원 → 문턱 1,250만원
    const under = deductionOf(5000 * MAN, 0, 1000 * MAN, rule);
    expect(under.threshold).toBe(1250 * MAN);
    expect(under.deduction).toBe(0);
  });

  it('최저사용금액은 신용카드분부터 차감한다', () => {
    // 이게 이 계산기의 핵심이다. 순서가 반대면 체크카드 공제가 깎인다.
    // 총급여 4,000만원 → 문턱 1,000만원. 신용 1,000만 + 체크 1,000만.
    const out = deductionOf(4000 * MAN, 1000 * MAN, 1000 * MAN, rule);
    // 문턱이 신용에서 전부 빠지고, 체크 1,000만이 온전히 30%
    expect(out.deduction).toBe(300 * MAN);
  });

  it('신용카드로 문턱을 채우는 것과 전부 체크로 쓰는 것은 공제가 같다', () => {
    const salary = 4000 * MAN;
    const spend = 2000 * MAN;
    const threshold = salary * 0.25;
    const filled = deductionOf(salary, threshold, spend - threshold, rule);
    const allCheck = deductionOf(salary, 0, spend, rule);
    expect(filled.deduction).toBe(allCheck.deduction);
  });

  it('문턱 위로 신용카드를 더 쓰면 공제가 줄어든다', () => {
    const salary = 4000 * MAN;
    const good = deductionOf(salary, 1000 * MAN, 1000 * MAN, rule);
    const worse = deductionOf(salary, 2000 * MAN, 0, rule);
    expect(worse.deduction).toBeLessThan(good.deduction);
    // 신용카드분은 15%라 절반만 공제된다
    expect(worse.deduction).toBe(150 * MAN);
  });

  it('공제 한도에서 잘린다', () => {
    // 총급여 5,000만원(7천만 이하) → 한도 300만원
    const out = deductionOf(5000 * MAN, 0, 5000 * MAN, rule);
    expect(out.limit).toBe(300 * MAN);
    expect(out.deduction).toBe(300 * MAN);
    expect(out.cappedBy).toBeGreaterThan(0);
  });

  it('총급여 7천만원 초과는 한도가 250만원이다', () => {
    const out = deductionOf(9000 * MAN, 0, 9000 * MAN, rule);
    expect(out.limit).toBe(250 * MAN);
  });
});

describe('카드 배분 최적화', () => {
  it('마일리지가 없으면 신용카드를 문턱까지만 쓴다', () => {
    const out = calcCardSplit({
      yearlySpend: 3000 * MAN,
      aSalary: 4000 * MAN,
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    // 혜택이 없으면 신용카드를 더 쓸 이유가 없다. 문턱까지가 최대.
    expect(out.result.value.a.credit).toBeLessThanOrEqual(out.result.value.a.threshold + 1);
  });

  it('문턱을 못 넘기는 사람이 있으면 알려준다', () => {
    // 한 사람 총급여가 1억이면 문턱이 2,500만원. 생활비 1,200만원으로는 못 넘는다.
    const out = calcCardSplit({
      yearlySpend: 1200 * MAN,
      aSalary: 10000 * MAN,
      bSalary: 3000 * MAN,
      aLabel: '남편',
      bLabel: '아내',
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    // 문턱이 낮은 쪽(아내, 750만원)으로 몰아야 공제를 받는다
    expect(out.result.value.b.spend).toBeGreaterThan(out.result.value.a.spend);
    expect(out.result.value.taxSavedTotal).toBeGreaterThan(0);
  });

  it('한도에 걸리면 남는 돈은 신용카드로 돌린다', () => {
    // 마일리지가 있고 한도를 이미 채웠으면 그 위는 신용카드가 이득이다.
    const out = calcCardSplit({
      yearlySpend: 6000 * MAN,
      aSalary: 4000 * MAN,
      milesPer1000: 1,
      wonPerMile: 20,
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.a.cappedBy).toBeGreaterThan(0);
    // 한도를 넘긴 만큼은 신용카드로 가야 하므로 문턱보다 많이 쓴다
    expect(out.result.value.a.credit).toBeGreaterThan(out.result.value.a.threshold);
    expect(out.result.value.miles).toBeGreaterThan(0);
  });

  it('마일리지 값어치를 0으로 두면 마일리지도 0이다', () => {
    const out = calcCardSplit({
      yearlySpend: 3000 * MAN,
      aSalary: 4000 * MAN,
      milesPer1000: 1,
      wonPerMile: 0,
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.mileValue).toBe(0);
  });

  it('연회비를 순이익에서 뺀다', () => {
    const withFee = calcCardSplit({
      yearlySpend: 3000 * MAN,
      aSalary: 4000 * MAN,
      annualFee: 10 * MAN,
      asOf: ASOF,
    });
    const without = calcCardSplit({
      yearlySpend: 3000 * MAN,
      aSalary: 4000 * MAN,
      asOf: ASOF,
    });
    if (!withFee.ok || !without.ok) throw new Error('계산 실패');
    expect(without.result.value.netBenefit - withFee.result.value.netBenefit).toBe(10 * MAN);
  });

  it('합산 여부는 혼인신고가 아니라 배우자 소득으로 갈린다고 알린다', () => {
    const out = calcCardSplit({ yearlySpend: 3000 * MAN, aSalary: 4000 * MAN, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('배우자의 소득으로 갈립니다'))).toBe(true);
  });

  it('맞벌이면 결혼해도 결과가 같다', () => {
    const base = { yearlySpend: 3600 * MAN, aSalary: 4000 * MAN, bSalary: 3600 * MAN, asOf: ASOF };
    const single = calcCardSplit({ ...base, married: false });
    const wed = calcCardSplit({ ...base, married: true });
    if (!single.ok || !wed.ok) throw new Error('계산 실패');
    expect(wed.result.value.combined).toBe(false);
    // 카드 사용액이 합쳐지지 않으므로 숫자가 한 톨도 달라지지 않아야 한다.
    expect(wed.result.value.netBenefit).toBe(single.result.value.netBenefit);
    expect(wed.result.value.a.credit).toBe(single.result.value.a.credit);
    // 대신 왜 안 바뀌는지를 말해 준다. 말 없이 그대로면 계산이 틀린 줄 안다.
    expect(wed.result.value.spouseNote).toContain('결혼 여부는 이 답을 바꾸지 않습니다');
  });

  it('배우자가 기본공제 대상이면 카드 사용액이 한 사람 공제로 합쳐진다', () => {
    // 총급여 400만원은 기본공제 선(500만원) 아래다.
    const apart = calcCardSplit({
      yearlySpend: 3000 * MAN, aSalary: 6000 * MAN, bSalary: 400 * MAN,
      married: false, asOf: ASOF,
    });
    const together = calcCardSplit({
      yearlySpend: 3000 * MAN, aSalary: 6000 * MAN, bSalary: 400 * MAN,
      married: true, asOf: ASOF,
    });
    if (!apart.ok || !together.ok) throw new Error('계산 실패');
    expect(together.result.value.combined).toBe(true);
    expect(apart.result.value.combined).toBe(false);
    /*
      합쳐져도 돌려받는 돈은 같다. 안 합쳐질 때도 계산기가 알아서 소득 많은 쪽
      카드에 몰아 주기 때문이다. 합산이 주는 건 돈이 아니라 자유다. 배우자 카드로
      긁어도 공제가 따라오므로 명의를 고민할 필요가 없어진다. 그 사실을 말해 준다.
    */
    expect(together.result.value.netBenefit).toBeCloseTo(apart.result.value.netBenefit, 0);
    expect(together.result.value.spouseNote).toContain('합쳐집니다');
    expect(together.result.value.spouseNote).toContain('혜택이 가장 좋은');
    // 아직 결혼 전이라면, 혼인신고가 답을 바꾼다는 사실을 미리 알려 준다.
    expect(apart.result.value.spouseNote).toContain('혼인신고를 하면 답이 달라집니다');
  });

  it('세금을 안 내는 사람 카드로는 쓰라고 하지 않는다', () => {
    /*
      총급여 400만원이면 과세표준이 0이라 소득세가 한 푼도 없다. 세율표는 6%를
      돌려주지만 그 6%를 믿으면 "소득 적은 쪽 카드로 쓰세요"라는 엉뚱한 답이 된다.
      돌려받을 세금이 없는 사람에게 공제를 몰아 줘 봐야 아무것도 안 돌아온다.
    */
    const out = calcCardSplit({
      yearlySpend: 3000 * MAN, aSalary: 6000 * MAN, bSalary: 400 * MAN,
      married: false, asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.b.spend).toBe(0);
    expect(out.result.value.b.marginalRate).toBe(0);
  });

  it('배우자 소득이 0인 외벌이 부부도 합쳐진다', () => {
    const out = calcCardSplit({
      yearlySpend: 3000 * MAN, aSalary: 6000 * MAN, bSalary: 0,
      married: true, asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.combined).toBe(true);
    expect(out.result.value.earnerLabel).toBe('나');
  });

  it('소득이 적은 쪽이 첫 번째 사람이어도 공제는 많이 버는 쪽이 받는다', () => {
    const out = calcCardSplit({
      yearlySpend: 3000 * MAN, aSalary: 300 * MAN, bSalary: 7000 * MAN,
      aLabel: '나', bLabel: '남편', married: true, asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.combined).toBe(true);
    expect(out.result.value.earnerLabel).toBe('남편');
    // 문턱은 7,000만원의 25%로 잡혀야 한다.
    expect(out.result.value.a.threshold).toBe(1750 * MAN);
  });

  it('공제가 안 되는 지출이 있다는 걸 알린다', () => {
    const out = calcCardSplit({ yearlySpend: 3000 * MAN, aSalary: 4000 * MAN, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.warnings.some((w) => w.includes('관리비'))).toBe(true);
  });

  it('0·빈 입력은 무엇이 부족한지 돌려준다', () => {
    expect(calcCardSplit({}).ok).toBe(false);
    expect(calcCardSplit({ yearlySpend: 100 * MAN }).ok).toBe(false);
  });

  it('근거는 조세특례제한법 조문이다', () => {
    const out = calcCardSplit({ yearlySpend: 3000 * MAN, aSalary: 4000 * MAN, asOf: ASOF });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.basis[0].source).toContain('조세특례제한법');
  });
});

describe('손익분기 마일 단가', () => {
  it('공제 손실과 마일 값어치가 같아지는 지점을 알려준다', () => {
    // 신용카드 1원 더 쓰면 공제가 15%p 줄고, 그만큼 세금이 는다.
    // 세율 15% + 지방소득세 10% → 0.15 × 0.165 = 2.475% → 1마일 기준 24.75원
    const out = calcCardSplit({
      yearlySpend: 2000 * MAN,
      aSalary: 5000 * MAN,
      milesPer1000: 1,
      wonPerMile: 20,
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.breakEvenWonPerMile).toBeCloseTo(24.75, 1);
  });

  it('적립률이 두 배면 손익분기 단가는 절반이다', () => {
    const one = calcCardSplit({
      yearlySpend: 2000 * MAN, aSalary: 5000 * MAN, milesPer1000: 1, asOf: ASOF,
    });
    const two = calcCardSplit({
      yearlySpend: 2000 * MAN, aSalary: 5000 * MAN, milesPer1000: 2, asOf: ASOF,
    });
    if (!one.ok || !two.ok) throw new Error('계산 실패');
    expect(two.result.value.breakEvenWonPerMile).toBeCloseTo(
      (one.result.value.breakEvenWonPerMile as number) / 2,
      2,
    );
  });

  it('한도를 채우면 손익분기를 따질 필요가 없다고 말한다', () => {
    const out = calcCardSplit({
      yearlySpend: 6000 * MAN, aSalary: 4000 * MAN, milesPer1000: 1, wonPerMile: 20, asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.limitReached).toBe(true);
    expect(out.result.warnings[0]).toContain('한도를 이미 채웠');
  });

  it('마일리지 카드가 아니면 손익분기가 없다', () => {
    const out = calcCardSplit({
      yearlySpend: 2000 * MAN, aSalary: 5000 * MAN, milesPer1000: 0, asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    expect(out.result.value.breakEvenWonPerMile).toBeNull();
  });

  it('아무도 문턱을 못 넘으면 손익분기가 없고, 혜택 좋은 카드를 쓰라고 말한다', () => {
    // 소득 1.6억 둘, 카드로 쓸 돈은 3,600만. 문턱이 4,000만이라 몰아줘도 못 넘는다.
    const out = calcCardSplit({
      yearlySpend: 3600 * MAN,
      aSalary: 16000 * MAN,
      bSalary: 16000 * MAN,
      milesPer1000: 1,
      wonPerMile: 20,
      asOf: ASOF,
    });
    if (!out.ok) throw new Error('계산 실패');
    // 포기할 공제가 없으니 경계선도 없다. 있다고 말하면 거짓말이 된다.
    expect(out.result.value.breakEvenWonPerMile).toBeNull();
    expect(out.result.warnings[0]).toContain('다 몰아줘도 문턱을 못 넘깁니다');
    // 공제가 0원이면 신용카드를 써도 잃는 게 없다.
    expect(out.result.value.a.check).toBe(0);
  });
});

describe('한 줄 판정', () => {
  function verdictFor(input: Parameters<typeof calcCardSplit>[0]) {
    const out = calcCardSplit(input);
    if (!out.ok) throw new Error('계산 실패');
    return cardSplitVerdict(out.result.value);
  }

  it('한 사람 카드만 쓰면 그 사람 이름을 말한다', () => {
    const v = verdictFor({
      yearlySpend: 3600 * MAN, aSalary: 4500 * MAN, bSalary: 4500 * MAN,
      milesPer1000: 1, wonPerMile: 20, asOf: ASOF,
    });
    expect(v.action).toContain('한 장에 몰아서');
    // 한도를 채운 뒤로는 체크카드를 써도 세금이 안 줄어서 전부 신용이 답이다.
    expect(v.action).toContain('전부 신용카드로');
    expect(v.why).toContain('한도');
  });

  it('공제를 못 받는 집에는 세금을 잊으라고 말한다', () => {
    const v = verdictFor({
      yearlySpend: 3600 * MAN, aSalary: 16000 * MAN, bSalary: 16000 * MAN,
      milesPer1000: 1, wonPerMile: 20, asOf: ASOF,
    });
    expect(v.why).toContain('올해는 공제가 없어요');
  });

  it('마일리지 카드가 아니면 체크카드로 몰고 갈림길을 말하지 않는다', () => {
    const v = verdictFor({
      yearlySpend: 1600 * MAN, aSalary: 4000 * MAN, milesPer1000: 0, asOf: ASOF,
    });
    expect(v.action).toContain('전부 체크카드로');
    expect(v.why).not.toContain('1마일');
  });

  it('합산되면 명의를 고민하지 말라고 말한다', () => {
    const v = verdictFor({
      yearlySpend: 3000 * MAN, aSalary: 6000 * MAN, bSalary: 0,
      married: true, milesPer1000: 0, asOf: ASOF,
    });
    expect(v.action).toContain('명의는 상관없습니다');
    expect(v.action).not.toContain('카드 한 장에 몰아서');
  });

  it('마일 단가가 갈림길 근처면 손익분기를 말한다', () => {
    const v = verdictFor({
      yearlySpend: 3600 * MAN, aSalary: 2800 * MAN, bSalary: 2800 * MAN,
      milesPer1000: 1, wonPerMile: 20, asOf: ASOF,
    });
    expect(v.why).toContain('1마일');
  });
});
