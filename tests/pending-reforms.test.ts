import { describe, expect, test } from 'vitest';
import { pendingReformsFor } from '@/lib/calculators/pending-reforms';
import { checkBirthGrants } from '@/lib/calculators/birth-grants';
import { calcMarriageTaxCredit } from '@/lib/calculators/marriage-tax-credit';

describe('예고된 제도', () => {
  test('출산·육아에는 아이맞이지원금과 아동기본수당이 걸린다', () => {
    const notice = pendingReformsFor('childcare', '2026-09-13');
    expect(notice).not.toBeNull();
    expect(notice!.items.map((i) => i.id)).toEqual([
      'child-welcome-payment',
      'child-basic-allowance',
    ]);
  });

  test('결혼에는 혼인지원금이 걸린다', () => {
    const notice = pendingReformsFor('marriage', '2026-09-13');
    expect(notice!.items).toHaveLength(1);
    expect(notice!.items[0].amounts).toEqual([
      { label: '1인당', value: 500_000 },
      { label: '부부 합계', value: 1_000_000 },
    ]);
  });

  test('걸린 제도가 없는 이벤트는 아무것도 띄우지 않는다', () => {
    expect(pendingReformsFor('retirement', '2026-09-13')).toBeNull();
    expect(pendingReformsFor('jobchange', '2026-09-13')).toBeNull();
  });

  test('발표 전 날짜로 보면 아직 없는 소식이다', () => {
    expect(pendingReformsFor('marriage', '2026-01-01')).toBeNull();
  });

  /*
    이 사이트의 약속을 지키는 테스트.
    예산안 단계의 금액이 실수로 계산에 섞이면 사이트가 존재할 이유가 없어진다.
  */
  test('예고 금액은 출산 지원금 계산에 절대 들어가지 않는다', () => {
    const out = checkBirthGrants({ childBirthDate: '2027-08-01', birthOrder: 'first', today: '2026-09-13' });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // 아이맞이지원금 첫째 1,000만원이 섞였다면 첫만남이용권 200만원 자리가 달라진다
    const firstMeeting = out.result.value.grants.find((g) => g.id === 'first-meeting-voucher');
    expect(firstMeeting?.totalAmount).toBe(2_000_000);
    expect(out.result.basis.map((b) => b.ruleId)).not.toContain('pending-reforms');
  });

  test('예고 금액은 결혼세액공제 계산에 절대 들어가지 않는다', () => {
    const out = calcMarriageTaxCredit({ registrationDate: '2026-05-01', myIncome: true, spouseIncome: true, today: '2026-09-13' });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.value.total).toBe(1_000_000);
    expect(out.result.basis.map((b) => b.ruleId)).not.toContain('pending-reforms');
  });
});
