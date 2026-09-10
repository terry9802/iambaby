import { loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { diffDays, formatKRW, formatDate, parseDate } from '@/lib/format';

/**
 * 결혼세액공제 계산기.
 * 금액 자체는 단순하다. 진짜 가치는 "언제까지 혼인신고를 해야 받는지"를 날짜로 알려주는 것이다.
 */

export type MarriageTaxCreditRule = {
  creditPerPerson: number;
  applicableFrom: string;
  applicableTo: string;
  oncePerLifetime: boolean;
  requiresIncome: boolean;
  incomeNote: string;
  claimAt: string;
  proofDocument: string;
};

export type MarriageTaxCreditInput = {
  /** 혼인신고를 한 날 또는 할 예정인 날 */
  registrationDate?: string;
  /** 혼인신고한 해에 근로·사업 소득이 있는가 */
  myIncome?: boolean;
  spouseIncome?: boolean;
  /** 예전 결혼에서 이미 이 공제를 받았는가 */
  myAlreadyClaimed?: boolean;
  spouseAlreadyClaimed?: boolean;
  today?: string;
};

export type MarriageTaxCreditValue = {
  total: number;
  mine: number;
  spouse: number;
  eligible: boolean;
  /** 제도 종료일까지 남은 날 */
  daysLeft: number;
  deadline: string;
  claimYear: number;
  claimAt: string;
};

export function calcMarriageTaxCredit(
  input: MarriageTaxCreditInput,
): CalcOutcome<MarriageTaxCreditValue> {
  if (!input.registrationDate) {
    return missing<MarriageTaxCreditValue>({
      field: 'registrationDate',
      label: '혼인신고 날짜 (예정일도 괜찮아요)',
      hint: '결혼식 날이 아니라 구청이나 주민센터에 혼인신고서를 낸 날이 기준이에요. 아직 안 하셨으면 하려는 날짜를 적어주세요.',
    });
  }

  const registrationDate = input.registrationDate;
  const lookup = loadRule<MarriageTaxCreditRule>('marriage-tax-credit', registrationDate);
  const rule = lookup.rule.values;
  const today = input.today ? parseDate(input.today) : new Date();

  const inWindow =
    registrationDate >= rule.applicableFrom && registrationDate <= rule.applicableTo;

  const myIncome = input.myIncome ?? true;
  const spouseIncome = input.spouseIncome ?? true;

  const mine = inWindow && myIncome && !input.myAlreadyClaimed ? rule.creditPerPerson : 0;
  const spouse =
    inWindow && spouseIncome && !input.spouseAlreadyClaimed ? rule.creditPerPerson : 0;
  const total = mine + spouse;

  const deadline = parseDate(rule.applicableTo);
  const daysLeft = diffDays(today, deadline);
  const claimYear = Number(registrationDate.slice(0, 4));

  const steps: CalcStep[] = [
    {
      label: '혼인신고 날짜가 기간 안에 드는지',
      formula: `${rule.applicableFrom} ~ ${rule.applicableTo}`,
      result: inWindow ? 1 : 0,
      unit: 'COUNT',
      note: inWindow
        ? `${registrationDate}은 적용 기간 안에 있어요.`
        : `${registrationDate}은 적용 기간 밖이라 이 공제를 받을 수 없어요.`,
    },
    {
      label: '본인',
      formula: !inWindow
        ? '적용 기간 밖'
        : input.myAlreadyClaimed
          ? '이미 받은 적 있음 (생애 1회)'
          : !myIncome
            ? '소득이 없어 공제할 세금이 없음'
            : `1인당 ${formatKRW(rule.creditPerPerson)}`,
      result: mine,
      unit: 'KRW',
    },
    {
      label: '배우자',
      formula: !inWindow
        ? '적용 기간 밖'
        : input.spouseAlreadyClaimed
          ? '이미 받은 적 있음 (생애 1회)'
          : !spouseIncome
            ? '소득이 없어 공제할 세금이 없음'
            : `1인당 ${formatKRW(rule.creditPerPerson)}`,
      result: spouse,
      unit: 'KRW',
    },
    {
      label: '부부 합계',
      formula: `${formatKRW(mine)} + ${formatKRW(spouse)}`,
      result: total,
      unit: 'KRW',
    },
  ];

  const assumptions = [
    '두 분 다 국내에 거주하고 혼인신고한 해에 소득이 있다고 보고 계산했어요.',
    '세액공제는 낼 세금에서 빼주는 것이라, 낼 세금이 50만원보다 적으면 그 세금만큼만 줄어듭니다.',
    '재혼도 받을 수 있지만 예전에 이 공제를 받은 사람은 다시 받을 수 없어요.',
  ];

  const warnings: string[] = [
    `기준은 결혼식 날이 아니라 **혼인신고를 접수한 날**입니다. 식을 올렸어도 신고를 안 했으면 해당되지 않아요.`,
    `${rule.applicableTo}까지 혼인신고한 경우에만 적용되는 한시 제도예요.`,
  ];

  if (inWindow && daysLeft >= 0 && daysLeft <= 365) {
    warnings.push(
      `제도가 끝나기까지 ${daysLeft}일 남았어요. 혼인신고를 미루고 계셨다면 ${formatDate(deadline)} 안에 하시는 게 부부 합쳐 ${formatKRW(rule.creditPerPerson * 2)} 차이입니다.`,
    );
  }
  if (!inWindow && registrationDate > rule.applicableTo) {
    warnings.push(
      `${formatDate(deadline)}까지 혼인신고를 하면 받을 수 있어요. 날짜를 앞당길 수 있다면 부부 합쳐 ${formatKRW(rule.creditPerPerson * 2)}입니다.`,
    );
  }
  warnings.push(`신청은 ${claimYear}년 귀속 ${rule.claimAt} 때 ${rule.proofDocument}를 내면 됩니다.`);

  return ok({
    value: {
      total,
      mine,
      spouse,
      eligible: total > 0,
      daysLeft,
      deadline: rule.applicableTo,
      claimYear,
      claimAt: rule.claimAt,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta],
  });
}
