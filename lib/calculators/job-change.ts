import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { formatKRW, formatManwon } from '@/lib/format';
import { calcNetSalary, grossForNet, type NetSalaryBreakdown } from './net-salary';

/** 이직 제안을 받았을 때, 실제로 손에 쥐는 돈이 얼마나 달라지는지 */

export type JobChangeInput = {
  currentSalary?: number;
  offeredSalary?: number;
  /** 월 비과세 수당 (식대 등) */
  currentTaxFree?: number;
  offeredTaxFree?: number;
  dependents?: number;
  asOf?: string;
};

export type JobChangeValue = {
  current: NetSalaryBreakdown;
  offered: NetSalaryBreakdown;
  monthlyDiff: number;
  annualDiff: number;
  /** 지금과 실수령액이 같아지는 제안 연봉 */
  breakEvenSalary: number;
  better: boolean;
};

export function compareJobChange(input: JobChangeInput): CalcOutcome<JobChangeValue> {
  const gaps = [];
  if (!input.currentSalary || input.currentSalary <= 0) {
    gaps.push({
      field: 'currentSalary',
      label: '지금 연봉 (세전)',
      hint: '계약서에 적힌 연봉이에요. 상여금이 연봉에 포함돼 있으면 그대로 넣으시면 됩니다.',
    });
  }
  if (!input.offeredSalary || input.offeredSalary <= 0) {
    gaps.push({
      field: 'offeredSalary',
      label: '제안받은 연봉 (세전)',
      hint: '아직 제안을 안 받으셨다면 부르고 싶은 금액을 넣고 실수령액이 얼마나 늘어나는지 보세요.',
    });
  }
  if (gaps.length > 0) return missing<JobChangeValue>(...gaps);

  const dependents = input.dependents ?? 1;
  const asOf = input.asOf;
  const currentTaxFree = input.currentTaxFree ?? 0;
  const offeredTaxFree = input.offeredTaxFree ?? 0;

  const cur = calcNetSalary(input.currentSalary as number, {
    taxFreeMonthly: currentTaxFree,
    dependents,
    asOf,
  });
  const off = calcNetSalary(input.offeredSalary as number, {
    taxFreeMonthly: offeredTaxFree,
    dependents,
    asOf,
  });

  const monthlyDiff = off.breakdown.netMonthly - cur.breakdown.netMonthly;
  const breakEvenSalary = grossForNet(cur.breakdown.netMonthly, {
    taxFreeMonthly: offeredTaxFree,
    dependents,
    asOf,
  });

  const row = (label: string, b: NetSalaryBreakdown): CalcStep => ({
    label,
    formula: `세전 월 ${formatManwon(b.grossMonthly)} − 4대보험 ${formatManwon(b.insuranceTotal)} − 세금 ${formatManwon(b.taxTotal)}`,
    result: b.netMonthly,
    unit: 'KRW',
    children: [
      { label: '국민연금', formula: '기준소득월액 × 4.75%', result: b.pension, unit: 'KRW' as const },
      { label: '건강보험', formula: '보수월액 × 3.595%', result: b.health, unit: 'KRW' as const },
      { label: '장기요양', formula: '보수월액 × 0.4724%', result: b.longTermCare, unit: 'KRW' as const },
      { label: '고용보험', formula: '보수월액 × 0.9%', result: b.employment, unit: 'KRW' as const },
      { label: '소득세', formula: '연간 기준 근사치', result: b.incomeTax, unit: 'KRW' as const },
      { label: '지방소득세', formula: '소득세 × 10%', result: b.localTax, unit: 'KRW' as const },
    ],
  });

  const steps: CalcStep[] = [
    row('지금 회사 월 실수령액', cur.breakdown),
    row('옮길 회사 월 실수령액', off.breakdown),
    {
      label: '월 차이',
      formula: `${formatKRW(off.breakdown.netMonthly)} − ${formatKRW(cur.breakdown.netMonthly)}`,
      result: monthlyDiff,
      unit: 'KRW',
    },
    {
      label: '연 차이',
      formula: `월 ${formatManwon(monthlyDiff)} × 12개월`,
      result: monthlyDiff * 12,
      unit: 'KRW',
    },
    {
      label: '본전이 되는 제안 연봉',
      formula: '지금과 실수령액이 같아지는 세전 연봉',
      result: breakEvenSalary,
      unit: 'KRW',
      note: '이 금액보다 낮게 부르면 지금보다 손해입니다.',
    },
  ];

  const assumptions = [
    '연봉을 12로 나눠 매달 같은 금액을 받는다고 보고 계산했어요. 상여금이 따로 나오면 달마다 금액이 달라집니다.',
    `부양가족을 본인 포함 ${dependents}명으로 잡았어요. 실제 공제는 가족 구성에 따라 달라집니다.`,
    '의료비·기부금·주택청약처럼 사람마다 다른 공제는 넣지 않았어요. 넣으면 세금이 더 줄어듭니다.',
  ];

  const warnings = [
    '**소득세는 근사치입니다.** 회사가 매달 떼는 금액은 간이세액표를 따르고, 최종 금액은 연말정산에서 정해집니다. 실제와 몇만원씩 차이 날 수 있어요.',
    '연봉만으로 이직을 결정하기는 어렵습니다. 퇴직금 정산 시점, 남은 연차, 스톡옵션, 통근 시간처럼 돈으로 환산되지 않는 것들이 더 클 때가 많아요.',
  ];
  if (monthlyDiff < 0) {
    warnings.push(
      `제안받은 연봉이 지금보다 높아 보여도 실수령액은 월 ${formatManwon(Math.abs(monthlyDiff))} 줄어듭니다. 비과세 수당 차이 때문일 수 있어요.`,
    );
  }
  if (offeredTaxFree < currentTaxFree) {
    warnings.push(
      '지금 회사의 비과세 수당(식대 등)이 더 큽니다. 비과세는 세금도 보험료도 안 붙어서 같은 연봉이라도 실수령액이 달라져요.',
    );
  }

  return ok({
    value: {
      current: cur.breakdown,
      offered: off.breakdown,
      monthlyDiff,
      annualDiff: monthlyDiff * 12,
      breakEvenSalary,
      better: monthlyDiff > 0,
    },
    steps,
    assumptions,
    warnings,
    basis: [cur.basis],
  });
}
