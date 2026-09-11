import { loadRule } from '@/lib/rules/loader';
import type { RuleMeta } from '@/lib/rules/types';

/**
 * 세전 연봉에서 4대보험과 소득세를 빼 실수령액을 구한다.
 *
 * 4대보험은 요율이 공개돼 있어 정확히 계산된다.
 * 소득세는 회사가 매달 떼는 간이세액표와 연말정산 결과가 달라서, 연간 기준 근사치로 낸다.
 * 그래서 결과에는 언제나 "연말정산에서 달라진다"는 단서를 붙인다.
 */

export type PayrollRule = {
  nationalPension: { totalRate: number; employeeShare: number; baseMin: number; baseMax: number; note: string };
  healthInsurance: { totalRate: number; employeeShare: number };
  longTermCare: { totalRate: number; employeeShare: number; note: string };
  employmentInsurance: { employeeRate: number };
  taxFreeMealLimit: number;
  earnedIncomeDeduction: { upTo: number | null; base: number; rate: number; over: number }[];
  earnedIncomeDeductionCap: number;
  personalDeduction: number;
  taxBrackets: { upTo: number | null; rate: number }[];
  earnedIncomeTaxCredit: {
    threshold: number;
    lowRate: number;
    highBase: number;
    highRate: number;
    limits: { salaryUpTo: number | null; limit?: number; from?: number; minus?: number; floor?: number }[];
  };
  localIncomeTaxRate: number;
  consult: { label: string; number: string; note: string };
};

export type NetSalaryBreakdown = {
  grossAnnual: number;
  grossMonthly: number;
  taxFreeMonthly: number;
  /** 4대보험 근로자 부담 (월) */
  pension: number;
  health: number;
  longTermCare: number;
  employment: number;
  insuranceTotal: number;
  /** 소득세 + 지방소득세 (월) */
  incomeTax: number;
  localTax: number;
  taxTotal: number;
  netMonthly: number;
  netAnnual: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 구간별로 나눠 세금을 매긴다. 누진공제 상수를 쓰지 않아도 결과가 같다. */
export function progressiveTax(base: number, brackets: PayrollRule['taxBrackets']): number {
  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    const upper = bracket.upTo ?? Infinity;
    if (base <= lower) break;
    tax += (Math.min(base, upper) - lower) * bracket.rate;
    lower = upper;
  }
  return tax;
}

export function earnedIncomeDeduction(gross: number, rule: PayrollRule): number {
  const band =
    rule.earnedIncomeDeduction.find((b) => b.upTo === null || gross <= b.upTo) ??
    rule.earnedIncomeDeduction[rule.earnedIncomeDeduction.length - 1];
  const deduction = band.base + (gross - band.over) * band.rate;
  return Math.min(Math.max(0, deduction), rule.earnedIncomeDeductionCap);
}

function earnedIncomeTaxCredit(taxBeforeCredit: number, gross: number, rule: PayrollRule): number {
  const c = rule.earnedIncomeTaxCredit;
  const raw =
    taxBeforeCredit <= c.threshold
      ? taxBeforeCredit * c.lowRate
      : c.highBase + (taxBeforeCredit - c.threshold) * c.highRate;

  const band = c.limits.find((l) => l.salaryUpTo === null || gross <= l.salaryUpTo) ?? c.limits[c.limits.length - 1];
  if (band.limit !== undefined) return Math.min(raw, band.limit);

  const prevCeiling = c.limits[c.limits.indexOf(band) - 1]?.salaryUpTo ?? 0;
  const limit = Math.max(band.floor ?? 0, (band.from ?? 0) - (gross - prevCeiling) * (band.minus ?? 0));
  return Math.min(raw, limit);
}

export function calcNetSalary(
  grossAnnual: number,
  options: { taxFreeMonthly?: number; dependents?: number; asOf?: string } = {},
): { breakdown: NetSalaryBreakdown; basis: RuleMeta; rule: PayrollRule } {
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  const lookup = loadRule<PayrollRule>('payroll', asOf);
  const rule = lookup.rule.values;

  const grossMonthly = grossAnnual / 12;
  const taxFreeMonthly = Math.min(options.taxFreeMonthly ?? 0, rule.taxFreeMealLimit);
  // 비과세 수당은 보험료와 세금 어느 쪽에도 들어가지 않는다.
  const taxableMonthly = Math.max(0, grossMonthly - taxFreeMonthly);

  const pensionBase = clamp(taxableMonthly, rule.nationalPension.baseMin, rule.nationalPension.baseMax);
  const pension = Math.floor(pensionBase * rule.nationalPension.totalRate * rule.nationalPension.employeeShare);
  const health = Math.floor(taxableMonthly * rule.healthInsurance.totalRate * rule.healthInsurance.employeeShare);
  const longTermCare = Math.floor(taxableMonthly * rule.longTermCare.totalRate * rule.longTermCare.employeeShare);
  const employment = Math.floor(taxableMonthly * rule.employmentInsurance.employeeRate);
  const insuranceTotal = pension + health + longTermCare + employment;

  const taxableAnnual = taxableMonthly * 12;
  const deduction = earnedIncomeDeduction(taxableAnnual, rule);
  const dependents = Math.max(1, Math.floor(options.dependents ?? 1));
  const taxBase = Math.max(
    0,
    taxableAnnual - deduction - rule.personalDeduction * dependents - insuranceTotal * 12,
  );

  const taxBeforeCredit = progressiveTax(taxBase, rule.taxBrackets);
  const credit = earnedIncomeTaxCredit(taxBeforeCredit, taxableAnnual, rule);
  const annualIncomeTax = Math.max(0, taxBeforeCredit - credit);

  const incomeTax = Math.floor(annualIncomeTax / 12);
  const localTax = Math.floor((annualIncomeTax * rule.localIncomeTaxRate) / 12);
  const taxTotal = incomeTax + localTax;

  const netMonthly = Math.round(grossMonthly - insuranceTotal - taxTotal);

  return {
    breakdown: {
      grossAnnual,
      grossMonthly: Math.round(grossMonthly),
      taxFreeMonthly,
      pension,
      health,
      longTermCare,
      employment,
      insuranceTotal,
      incomeTax,
      localTax,
      taxTotal,
      netMonthly,
      netAnnual: netMonthly * 12,
    },
    basis: lookup.rule.meta,
    rule,
  };
}

/** 지금과 같은 실수령액이 되려면 세전 연봉이 얼마여야 하는가 */
export function grossForNet(
  targetNetMonthly: number,
  options: { taxFreeMonthly?: number; dependents?: number; asOf?: string } = {},
): number {
  let low = 0;
  let high = 2_000_000_000;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    const { breakdown } = calcNetSalary(mid, options);
    if (breakdown.netMonthly < targetNetMonthly) low = mid;
    else high = mid;
  }
  // 만원 단위로 올려 실제로 부를 수 있는 숫자로 만든다.
  return Math.ceil(high / 10000) * 10000;
}
