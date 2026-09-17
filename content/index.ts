import type { Article } from '@/lib/content/types';
import { article as parentalLeavePay } from '@/content/childcare/parental-leave-pay';
import { article as postPaymentAbolished } from '@/content/childcare/post-payment-abolished';
import { article as sixPlusSix } from '@/content/childcare/six-plus-six';
import { article as leave18Months } from '@/content/childcare/leave-18-months';
import { article as first60Days } from '@/content/childcare/first-60-days';
import { article as threeCashBenefits } from '@/content/childcare/three-cash-benefits';
import { article as maternityLeave90 } from '@/content/childcare/maternity-leave-90';
import { article as priorityCompany } from '@/content/childcare/priority-company';
import { article as apply30DaysBefore } from '@/content/childcare/apply-30-days-before';
import { article as ordinaryWage } from '@/content/childcare/ordinary-wage';
import { article as seoulDistrictGrants } from '@/content/childcare/seoul-district-grants';
import { article as marriageTaxCredit } from '@/content/marriage/tax-credit';
import { article as newlywedJeonseLoan } from '@/content/marriage/jeonse-loan';
import { article as weddingGiftMoney } from '@/content/socialdues/wedding-gift-money';
import { article as condolenceMoney } from '@/content/socialdues/condolence-money';
import { article as netSalaryGap } from '@/content/jobchange/net-salary-gap';
import { article as taxFreeAllowance } from '@/content/jobchange/tax-free-allowance';
import { article as payrollDeductions } from '@/content/jobchange/payroll-deductions';
import { article as averageWage } from '@/content/retirement/average-wage';
import { article as severanceOneYear } from '@/content/retirement/severance-one-year';
import { article as unemploymentVoluntary } from '@/content/retirement/unemployment-voluntary';
import { article as reform2027 } from '@/content/childcare/reform-2027';
import { article as weddingGrant2027 } from '@/content/marriage/wedding-grant-2027';
import { article as restWhoGetsWhat } from '@/content/rest/who-gets-what';

/** 읽는 순서대로. 목록 화면이 이 순서를 그대로 쓴다. */
export const ARTICLES: Article[] = [
  reform2027,
  ordinaryWage,
  parentalLeavePay,
  postPaymentAbolished,
  sixPlusSix,
  leave18Months,
  apply30DaysBefore,
  maternityLeave90,
  priorityCompany,
  first60Days,
  threeCashBenefits,
  seoulDistrictGrants,
  weddingGrant2027,
  marriageTaxCredit,
  newlywedJeonseLoan,
  weddingGiftMoney,
  condolenceMoney,
  netSalaryGap,
  taxFreeAllowance,
  payrollDeductions,
  averageWage,
  severanceOneYear,
  unemploymentVoluntary,
  restWhoGetsWhat,
];

export function findArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function articlesOf(event: string): Article[] {
  return ARTICLES.filter((a) => a.event === event);
}
