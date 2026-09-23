import { loadRule, type RuleId } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep, type RuleMeta } from '@/lib/rules/types';
import { addDays, diffDays, formatKRW, parseDate, toISODate } from '@/lib/format';

/**
 * 7-3 출산·육아 지원금 통합 조회.
 * 금액을 더하는 것보다 "언제까지 신청해야 하는지"를 알려주는 쪽이 실제로 돈을 지켜준다.
 */

export type BirthOrder = 'first' | 'second' | 'thirdOrMore';

export type AmountByBirthOrder = Record<BirthOrder, number>;

export type RawGrant = {
  id: string;
  name: string;
  kind: 'cash' | 'voucher';
  description: string;
  amountByBirthOrder?: AmountByBirthOrder;
  monthlyByAge?: { fromMonth: number; toMonth: number; amount: number }[];
  payout: 'once' | 'monthly';
  /** 출생일로부터 며칠 안에 신청해야 하는가 */
  applyWithinDays?: number;
  /** 출생일로부터 며칠 뒤에 신청 창구가 열리는가 (첫돌축하금처럼 나중에 신청하는 것) */
  applyOffsetDays?: number;
  /** 창구가 열린 뒤 며칠 동안 신청할 수 있는가 */
  applyWindowDays?: number;
  /**
   * 사업 자체가 끝나는 날. 출생일 기준 기한이 아직 남았어도 이 날이 지나면 못 받는다.
   * 경기도 산후조리비처럼 예산이 끊겨 중단되는 지원에 쓴다.
   */
  applyHardDeadline?: string;
  applyDeadlineNote?: string;
  applyAt: string;
  applyUrl?: string;
  eligibility?: string;
};

export type NationalRule = { items: RawGrant[] };
export type SidoRule = {
  sido: { code: string; name: string; items: RawGrant[]; extraNotes: string[] };
  /** 그 시도에 속한 시·군·구 */
  districts: {
    code: string;
    name: string;
    status: 'verified' | 'unverified';
    items: RawGrant[];
    /** 합계에 넣지는 않지만 알려주면 좋은 것 (현물 지원, 넷째 이상 금액, 거주 요건 등) */
    extraNotes: string[];
    source?: string;
    sourceUrl?: string;
    verifiedAt?: string;
    verifiedBy?: string;
    note?: string;
    lookupUrl?: string;
  }[];
};

/*
  시도 코드에서 룰 파일을 찾는 표. 예전에는 계산기 안에 "서울이면"이 네 군데
  박혀 있어서 다른 지역을 붙이려면 계산 로직을 고쳐야 했다. 이제 지역을
  늘리는 일은 룰 파일 하나와 이 표의 한 줄이다.
*/
const SIDO_RULES = {
  seoul: 'birth-grants-seoul',
  gyeonggi: 'birth-grants-gyeonggi',
} as const satisfies Record<string, RuleId>;

export type SidoCode = keyof typeof SIDO_RULES;

/** 지역 선택 UI에 쓸 시도 목록. 룰이 있는 곳만 고를 수 있어야 한다. */
export function listSupportedSido(asOf: string): { code: SidoCode; name: string }[] {
  return (Object.keys(SIDO_RULES) as SidoCode[]).map((code) => ({
    code,
    name: loadRule<SidoRule>(SIDO_RULES[code], asOf).rule.values.sido.name,
  }));
}

export type GrantDeadline = {
  /** 신청 창구가 열리는 날 */
  opensAt: string | null;
  /** 신청 마감일 */
  dueAt: string;
  dDay: number;
  status: 'open' | 'not-yet' | 'passed';
  note: string;
};

export type ResolvedGrant = {
  id: string;
  name: string;
  scope: 'national' | 'sido' | 'district';
  scopeLabel: string;
  kind: 'cash' | 'voucher';
  description: string;
  /** 한 번 받는 돈이면 그 금액, 매달 받는 돈이면 전체 기간 합계 */
  totalAmount: number;
  /** 첫 1년 동안 실제로 통장에 들어오는 금액 */
  firstYearAmount: number;
  monthlyBreakdown?: { fromMonth: number; toMonth: number; amount: number }[];
  payout: 'once' | 'monthly';
  deadline: GrantDeadline | null;
  /** 마감일을 날짜로 셀 수 없는 경우에도 남는 안내 문구 */
  deadlineNote?: string;
  applyAt: string;
  applyUrl?: string;
  eligibility?: string;
};

export type BirthGrantsValue = {
  grants: ResolvedGrant[];
  totalAmount: number;
  firstYearAmount: number;
  /** 30일 안에 마감되는 항목 */
  urgent: ResolvedGrant[];
  /** 고른 시도 이름. 룰이 없는 지역이면 null이다. */
  sidoName: string | null;
  districtStatus: 'verified' | 'unverified' | 'unsupported';
  districtName: string | null;
  districtLookupUrl?: string;
  /** 합계에 안 들어가지만 알려드릴 것 */
  extraNotes: { scope: string; text: string }[];
  /** 금액을 확인한 구들의 평균. 확인 안 된 구에서 짐작할 출발점으로 쓴다. */
  districtEstimate: number;
  /** 사용자가 구청에 물어 직접 넣은 금액 */
  districtOverride: number | null;
};

function amountFor(grant: RawGrant, order: BirthOrder): number {
  if (grant.amountByBirthOrder) return grant.amountByBirthOrder[order];
  return 0;
}

function monthlyTotals(
  grant: RawGrant,
): { total: number; firstYear: number; breakdown: { fromMonth: number; toMonth: number; amount: number }[] } {
  const breakdown = grant.monthlyByAge ?? [];
  let total = 0;
  let firstYear = 0;
  for (const band of breakdown) {
    const months = band.toMonth - band.fromMonth + 1;
    total += band.amount * months;
    const firstYearMonths = Math.max(0, Math.min(band.toMonth, 11) - band.fromMonth + 1);
    firstYear += band.amount * firstYearMonths;
  }
  return { total, firstYear, breakdown };
}

function resolveDeadline(grant: RawGrant, birthDate: Date, today: Date): GrantDeadline | null {
  const offset = grant.applyOffsetDays ?? 0;
  const window = grant.applyWindowDays;
  const within = grant.applyWithinDays;

  if (within === undefined && window === undefined && grant.applyHardDeadline === undefined) {
    return null;
  }

  const opens = offset > 0 ? addDays(birthDate, offset) : null;
  const relativeDue =
    window !== undefined ? addDays(birthDate, offset + window) : addDays(birthDate, within as number);

  /*
    출생일 기준 기한과 사업 종료일 중 먼저 오는 날이 진짜 마감이다. 아이가 어제
    태어났어도 사업이 다음 주에 끝나면 남은 날은 다음 주까지다.
  */
  const hard = grant.applyHardDeadline ? parseDate(grant.applyHardDeadline) : null;
  const due = hard !== null && hard.getTime() < relativeDue.getTime() ? hard : relativeDue;

  const dDay = diffDays(today, due);
  const notOpenYet = opens !== null && diffDays(today, opens) > 0;

  return {
    opensAt: opens ? toISODate(opens) : null,
    dueAt: toISODate(due),
    dDay,
    status: dDay < 0 ? 'passed' : notOpenYet ? 'not-yet' : 'open',
    note: grant.applyDeadlineNote ?? '',
  };
}

function resolveGrant(
  grant: RawGrant,
  scope: ResolvedGrant['scope'],
  scopeLabel: string,
  order: BirthOrder,
  birthDate: Date,
  today: Date,
): ResolvedGrant {
  const once = amountFor(grant, order);
  const monthly = grant.payout === 'monthly' ? monthlyTotals(grant) : null;

  return {
    id: grant.id,
    name: grant.name,
    scope,
    scopeLabel,
    kind: grant.kind,
    description: grant.description,
    totalAmount: monthly ? monthly.total : once,
    firstYearAmount: monthly ? monthly.firstYear : once,
    monthlyBreakdown: monthly?.breakdown,
    payout: grant.payout,
    deadline: resolveDeadline(grant, birthDate, today),
    deadlineNote: grant.applyDeadlineNote,
    applyAt: grant.applyAt,
    applyUrl: grant.applyUrl,
    eligibility: grant.eligibility,
  };
}

export type BirthGrantsInput = {
  childBirthDate?: string;
  birthOrder?: BirthOrder;
  sido?: string;
  sigungu?: string;
  /** 구청에 물어서 알게 된 실제 금액. 넣으면 합계에 들어간다. */
  districtAmount?: number;
  /** 테스트에서 오늘 날짜를 고정하기 위한 값 */
  today?: string;
};

export function checkBirthGrants(input: BirthGrantsInput): CalcOutcome<BirthGrantsValue> {
  const gaps = [];
  if (!input.childBirthDate) {
    gaps.push({
      field: 'childBirthDate',
      label: '자녀 출생일 (또는 출산 예정일)',
      hint: '신청 기한이 전부 출생일 기준이라, 이 날짜가 있어야 D-day를 세어드릴 수 있어요.',
    });
  }
  if (!input.birthOrder) {
    gaps.push({
      field: 'birthOrder',
      label: '출산 순위',
      hint: '첫째인지 둘째인지에 따라 첫만남이용권과 지자체 지원금이 달라져요.',
    });
  }
  if (gaps.length > 0) return missing<BirthGrantsValue>(...gaps);

  const birthDateIso = input.childBirthDate as string;
  const order = input.birthOrder as BirthOrder;
  const birthDate = parseDate(birthDateIso);
  const today = input.today ? parseDate(input.today) : new Date();

  const nationalLookup = loadRule<NationalRule>('birth-grants-national', birthDateIso);
  const grants: ResolvedGrant[] = nationalLookup.rule.values.items.map((g) =>
    resolveGrant(g, 'national', '정부', order, birthDate, today),
  );
  const basis: RuleMeta[] = [nationalLookup.rule.meta];
  const extraNotes: { scope: string; text: string }[] = [];

  let districtStatus: BirthGrantsValue['districtStatus'] = 'unsupported';
  let districtName: string | null = null;
  let districtLookupUrl: string | undefined;
  let districtEstimate = 0;

  const sidoRuleId = input.sido ? SIDO_RULES[input.sido as SidoCode] : undefined;
  let sidoName: string | null = null;

  if (sidoRuleId) {
    const sidoLookup = loadRule<SidoRule>(sidoRuleId, birthDateIso);
    const region = sidoLookup.rule.values;
    basis.push(sidoLookup.rule.meta);
    sidoName = region.sido.name;

    for (const item of region.sido.items) {
      grants.push(resolveGrant(item, 'sido', region.sido.name, order, birthDate, today));
    }
    for (const text of region.sido.extraNotes ?? []) {
      extraNotes.push({ scope: region.sido.name, text });
    }

    // 금액을 확인한 시군구들의 평균. 첫째에게 아무것도 주지 않는 곳도 0원으로 함께 센다.
    const verified = region.districts.filter((d) => d.status === 'verified');
    if (verified.length > 0) {
      const sum = verified.reduce(
        (acc, d) => acc + d.items.reduce((s2, item) => s2 + amountFor(item, order), 0),
        0,
      );
      districtEstimate = Math.round(sum / verified.length / 10000) * 10000;
    }

    const district = region.districts.find((d) => d.code === input.sigungu);
    if (district) {
      districtName = district.name;
      districtStatus = district.status;
      districtLookupUrl = district.lookupUrl;
      for (const item of district.items) {
        // 첫째는 안 주고 셋째부터 주는 구가 많다. 해당 순위에 0원이면 항목 자체를 띄우지 않는다.
        if (amountFor(item, order) <= 0 && item.payout === 'once') continue;
        grants.push(resolveGrant(item, 'district', district.name, order, birthDate, today));
      }
      for (const text of district.extraNotes ?? []) {
        extraNotes.push({ scope: district.name, text });
      }
      if (district.status === 'verified' && district.items.length > 0 && !district.items.some((i) => amountFor(i, order) > 0)) {
        extraNotes.push({
          scope: district.name,
          text: `${district.name}의 자체 지원은 이 출산 순위에는 해당되지 않아요. 셋째부터 지원하는 곳이 많습니다.`,
        });
      }
    }
  }

  // 구청에 물어 직접 넣은 금액은 확인 안 된 구에서만 합계에 넣는다.
  const districtOverride =
    districtStatus === 'unverified' && input.districtAmount !== undefined && input.districtAmount > 0
      ? input.districtAmount
      : null;
  if (districtOverride !== null && districtName) {
    grants.push({
      id: 'district-manual',
      name: `${districtName} 자체 지원 (직접 입력)`,
      scope: 'district',
      scopeLabel: districtName,
      kind: 'cash',
      description: '구청에 확인하고 넣으신 금액입니다. 저희가 검증한 값이 아니에요.',
      totalAmount: districtOverride,
      firstYearAmount: districtOverride,
      payout: 'once',
      deadline: null,
      applyAt: '주소지 동주민센터',
    });
  }

  const totalAmount = grants.reduce((acc, g) => acc + g.totalAmount, 0);
  const firstYearAmount = grants.reduce((acc, g) => acc + g.firstYearAmount, 0);
  const urgent = grants.filter(
    (g) => g.deadline && g.deadline.status === 'open' && g.deadline.dDay <= 30,
  );

  const steps: CalcStep[] = [
    ...grants.map((g) => ({
      label: `${g.scopeLabel} · ${g.name}`,
      formula:
        g.payout === 'monthly' && g.monthlyBreakdown
          ? g.monthlyBreakdown
              .map(
                (b) =>
                  `${formatKRW(b.amount)} × ${b.toMonth - b.fromMonth + 1}개월(생후 ${b.fromMonth}~${b.toMonth}개월)`,
              )
              .join(' + ')
          : '한 번 지급',
      result: g.totalAmount,
      unit: 'KRW' as const,
      note: g.deadline
        ? g.deadline.status === 'passed'
          ? `신청 기한(${g.deadline.dueAt})이 지났어요.`
          : `신청 마감 ${g.deadline.dueAt} (D${g.deadline.dDay >= 0 ? '-' : '+'}${Math.abs(g.deadline.dDay)})`
        : undefined,
    })),
    {
      label: '전 기간 합계',
      formula: grants.map((g) => formatKRW(g.totalAmount)).join(' + '),
      result: totalAmount,
      unit: 'KRW',
      note: '아동수당처럼 몇 해에 걸쳐 나오는 돈까지 모두 더한 금액이에요.',
    },
    {
      label: '첫 1년 동안 들어오는 돈',
      formula: grants.map((g) => formatKRW(g.firstYearAmount)).join(' + '),
      result: firstYearAmount,
      unit: 'KRW',
      note: '아이가 태어난 뒤 12개월 안에 실제로 통장에 들어오는 금액이에요.',
    },
  ];

  const assumptions = [
    '소득이나 재산과 무관하게 모두에게 나오는 지원만 담았어요. 저소득·다자녀·장애 가정 대상 지원은 빠져 있습니다.',
    '아동수당은 수도권 기준 월 100,000원으로 계산했어요. 비수도권과 인구감소지역은 더 많이 받습니다.',
    '어린이집이나 유치원을 이용하면 부모급여에서 보육료를 뺀 차액만 현금으로 들어와요.',
  ];

  const warnings = [
    '부모급여와 아동수당은 출생일 포함 60일 안에 신청해야 출생한 달까지 소급됩니다. 하루만 늦어도 그 전 달치는 사라져요.',
    '금액과 요건은 지자체 예산에 따라 해가 바뀌면 달라질 수 있어요. 신청 전에 주민센터나 링크로 한 번 더 확인해 주세요.',
  ];

  if (sidoRuleId && districtStatus === 'unverified') {
    warnings.push(
      `${districtName ?? '선택하신 시·군·구'}의 자체 지원은 공식 출처로 확인하지 못해 합계에 넣지 않았어요. 실제로는 더 받으실 수 있으니 정부24 지역별 조회로 확인해 주세요.`,
    );
  }
  if (!sidoRuleId) {
    const names = listSupportedSido(birthDateIso)
      .map((s2) => s2.name)
      .join(', ');
    warnings.push(
      `지금은 ${names} 지원만 정리돼 있어요. 다른 지역은 정부24 행복출산 지역별 조회에서 확인해 주세요.`,
    );
  }
  const passed = grants.filter((g) => g.deadline?.status === 'passed');
  if (passed.length > 0) {
    warnings.push(
      `이미 기한이 지난 항목이 ${passed.length}개 있어요: ${passed.map((g) => g.name).join(', ')}. 소급이 되는 경우도 있으니 주민센터에 한 번 물어보세요.`,
    );
  }

  return ok({
    value: {
      grants,
      totalAmount,
      firstYearAmount,
      urgent,
      sidoName,
      districtStatus,
      districtName,
      districtLookupUrl,
      extraNotes,
      districtEstimate,
      districtOverride,
    },
    steps,
    assumptions,
    warnings,
    basis,
  });
}

export function formatDDay(deadline: GrantDeadline): string {
  if (deadline.dDay === 0) return '오늘 마감';
  if (deadline.dDay < 0) return `${Math.abs(deadline.dDay)}일 지남`;
  return `D-${deadline.dDay}`;
}

export { formatKRW };

/** 지역 선택 UI에 쓸 시·군·구 목록. 룰 파일에서 그대로 뽑는다. */
export function listSigungu(
  sido: string | undefined,
  asOf: string,
): { code: string; name: string; status: string }[] {
  const ruleId = sido ? SIDO_RULES[sido as SidoCode] : undefined;
  if (!ruleId) return [];
  const region = loadRule<SidoRule>(ruleId, asOf).rule.values;
  return region.districts.map((d) => ({ code: d.code, name: d.name, status: d.status }));
}
