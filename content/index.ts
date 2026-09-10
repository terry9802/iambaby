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

/** 읽는 순서대로. 목록 화면이 이 순서를 그대로 쓴다. */
export const ARTICLES: Article[] = [
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
];

export function findArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function articlesOf(event: string): Article[] {
  return ARTICLES.filter((a) => a.event === event);
}
