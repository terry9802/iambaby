import { loadRule } from '@/lib/rules/loader';
import { missing, ok, type CalcOutcome, type CalcStep } from '@/lib/rules/types';
import { formatKRW, formatManwon } from '@/lib/format';

/**
 * 경조사비 계산기.
 *
 * 다른 계산기와 성격이 다르다. 여긴 법령이 없다. 정답도 없다.
 * 그래서 "얼마다"라고 단정하지 않고, 설문에서 사람들이 실제로 무엇을 기준 삼는지를
 * 그대로 계산에 옮겨 출발점과 범위를 제시한다.
 */

export type OccasionKey = 'wedding' | 'funeral' | 'firstBirthday';
export type RelationKey =
  | 'family'
  | 'closeFriend'
  | 'friend'
  | 'teamColleague'
  | 'otherColleague'
  | 'work'
  | 'club';
export type FrequencyKey = 'weekly' | 'monthly' | 'fewTimesYear' | 'rare';
export type ClosenessKey = 'close' | 'normal' | 'distant';
export type AttendanceKey = 'attendMeal' | 'attendNoMeal' | 'absent';
export type VenueKey = 'normal' | 'hotel';

type Labeled<K extends string> = { key: K; label: string; factor?: number };

export type SocialDuesRule = {
  ladder: number[];
  occasions: (Labeled<OccasionKey> & { factor: number; note: string })[];
  relations: { key: RelationKey; label: string; base: number }[];
  frequency: (Labeled<FrequencyKey> & { factor: number })[];
  closeness: (Labeled<ClosenessKey> & { factor: number })[];
  mealCostPerPerson: { normal: number; hotel: number; note: string };
  attendance: (Labeled<AttendanceKey> & { coversMeal: boolean; factor?: number })[];
  oddNumberCustom: { under100000: number[]; note: string };
};

export type SocialDuesInput = {
  occasion?: OccasionKey;
  relation?: RelationKey;
  frequency?: FrequencyKey;
  closeness?: ClosenessKey;
  attendance?: AttendanceKey;
  venue?: VenueKey;
  /** 나까지 포함해 몇 명이 가는지 */
  partySize?: number;
  /** 이 사람이 내 경조사 때 냈던 금액 */
  receivedBefore?: number;
  asOf?: string;
};

export type SocialDuesValue = {
  recommended: number;
  /** 이 정도면 무난하다는 범위 */
  min: number;
  max: number;
  /** 식사를 한다면 최소한 이만큼 */
  mealFloor: number;
  /** 상호성 때문에 올라간 하한 */
  reciprocityFloor: number;
  occasionLabel: string;
};

/**
 * 사람들은 13만원 같은 금액을 내지 않는다. 10만원을 낸다.
 * 그래서 가까운 값으로 반올림하지 않고 아래 단위로 내린다.
 * 다만 바로 위 단위에 거의 닿았으면(90% 이상) 그쪽으로 올린다.
 */
const PROMOTE_THRESHOLD = 0.9;

function snapToLadder(value: number, ladder: number[]): number {
  const below = ladder.filter((step) => step <= value);
  const floor = below.length > 0 ? below[below.length - 1] : ladder[0];
  const next = ladder.find((step) => step > value);
  if (next && value >= next * PROMOTE_THRESHOLD) return next;
  return floor;
}

function stepUp(value: number, ladder: number[]): number {
  return ladder.find((s) => s > value) ?? ladder[ladder.length - 1];
}

function stepDown(value: number, ladder: number[]): number {
  const below = ladder.filter((s) => s < value);
  return below.length > 0 ? below[below.length - 1] : ladder[0];
}

export function calcSocialDues(input: SocialDuesInput): CalcOutcome<SocialDuesValue> {
  const gaps = [];
  if (!input.occasion) {
    gaps.push({ field: 'occasion', label: '어떤 자리인가요', hint: '결혼식인지 장례식인지에 따라 기준이 조금 달라져요.' });
  }
  if (!input.relation) {
    gaps.push({
      field: 'relation',
      label: '그 사람과 어떤 사이인가요',
      hint: '가족인지, 직장 동료인지, 오래 안 본 친구인지가 가장 큰 기준이에요.',
    });
  }
  if (gaps.length > 0) return missing<SocialDuesValue>(...gaps);

  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const lookup = loadRule<SocialDuesRule>('social-dues', asOf);
  const rule = lookup.rule.values;

  const occasion = rule.occasions.find((o) => o.key === input.occasion)!;
  const relation = rule.relations.find((r) => r.key === input.relation)!;
  const frequency =
    rule.frequency.find((f) => f.key === (input.frequency ?? 'fewTimesYear')) ?? rule.frequency[2];
  const closeness =
    rule.closeness.find((c) => c.key === (input.closeness ?? 'normal')) ?? rule.closeness[1];
  const attendance =
    rule.attendance.find((a) => a.key === (input.attendance ?? 'attendMeal')) ?? rule.attendance[0];

  const partySize = Math.max(1, Math.floor(input.partySize ?? 1));
  const venue: VenueKey = input.venue ?? 'normal';

  const steps: CalcStep[] = [];

  const base = relation.base;
  steps.push({
    label: `${relation.label}이면 보통 이 정도에서 시작해요`,
    formula: '설문에서 사람들이 가장 많이 답한 금액',
    result: base,
    unit: 'KRW',
  });

  const afterFrequency = base * frequency.factor;
  steps.push({
    label: `${frequency.label} 보는 사이`,
    formula: `${formatManwon(base)} × ${frequency.factor}`,
    result: Math.round(afterFrequency),
    unit: 'KRW',
    note: '자주 볼수록 앞으로도 주고받을 일이 많아 조금 올라갑니다.',
  });

  const afterCloseness = afterFrequency * closeness.factor;
  steps.push({
    label: closeness.label,
    formula: `${formatManwon(afterFrequency)} × ${closeness.factor}`,
    result: Math.round(afterCloseness),
    unit: 'KRW',
  });

  const afterOccasion = afterCloseness * occasion.factor;
  if (occasion.factor !== 1) {
    steps.push({
      label: `${occasion.label} 기준`,
      formula: `${formatManwon(afterCloseness)} × ${occasion.factor}`,
      result: Math.round(afterOccasion),
      unit: 'KRW',
    });
  }

  const afterAttendance = afterOccasion * (attendance.factor ?? 1);
  if (attendance.factor && attendance.factor !== 1) {
    steps.push({
      label: attendance.label,
      formula: `${formatManwon(afterOccasion)} × ${attendance.factor}`,
      result: Math.round(afterAttendance),
      unit: 'KRW',
      note: '식사를 안 하면 식대 부담이 없어 조금 낮춰도 괜찮습니다.',
    });
  }

  const snapped = snapToLadder(afterAttendance, rule.ladder);
  steps.push({
    label: '주고받기 편한 금액으로 맞추기',
    formula: `${formatKRW(Math.round(afterAttendance))} → 가까운 단위`,
    result: snapped,
    unit: 'KRW',
    note: rule.oddNumberCustom.note,
  });

  const mealFloor = attendance.coversMeal ? rule.mealCostPerPerson[venue] * partySize : 0;
  if (mealFloor > 0) {
    steps.push({
      label: `식사하는 사람 ${partySize}명`,
      formula: `1인 ${formatManwon(rule.mealCostPerPerson[venue])} × ${partySize}명`,
      result: mealFloor,
      unit: 'KRW',
      note: '적어도 먹는 값은 넘겨야 상대가 손해를 보지 않습니다.',
    });
  }

  const reciprocityFloor = input.receivedBefore ?? 0;
  if (reciprocityFloor > 0) {
    steps.push({
      label: '그때 이 사람이 나에게 냈던 금액',
      formula: '받은 만큼은 돌려주는 게 기준',
      result: reciprocityFloor,
      unit: 'KRW',
      note: '설문에서도 이 항목이 친밀도 다음으로 강한 기준이었습니다.',
    });
  }

  const recommended = Math.max(snapped, mealFloor, reciprocityFloor);
  steps.push({
    label: '그래서 이 정도',
    formula: `셋 중 가장 큰 값 (${formatManwon(snapped)}, ${formatManwon(mealFloor)}, ${formatManwon(reciprocityFloor)})`,
    result: recommended,
    unit: 'KRW',
  });

  const assumptions = [
    '설문조사에서 사람들이 실제로 답한 금액과 판단 기준을 그대로 계산에 옮겼어요.',
    '식대는 일반 예식장 1인 5만원, 호텔 1인 10만원으로 잡았어요. 실제 식대는 장소마다 다릅니다.',
    occasion.key === 'funeral'
      ? '장례식은 결혼식과 달리 식사를 하더라도 금액을 더 얹지 않는 분위기인 곳도 많아요.'
      : '결혼식은 식사 여부와 동행 인원이 금액에 크게 영향을 줍니다.',
  ];

  const warnings = [
    '이건 법이 아니라 관습이에요. 정답이 없고 집안·지역·업계마다 다릅니다. 여기 숫자는 출발점으로만 봐주세요.',
    '가장 강한 기준은 계산이 아니라 **그 사람이 내 경조사 때 냈던 금액**입니다. 기억나신다면 꼭 넣어보세요.',
  ];
  if (attendance.coversMeal && recommended === mealFloor && mealFloor > snapped) {
    warnings.push(
      '관계만 보면 더 적게 내도 될 사이지만, 식사를 하시기 때문에 식대만큼으로 올렸어요. 부담되시면 식사를 안 하는 것도 방법입니다.',
    );
  }
  if (recommended >= 100000 && recommended % 100000 !== 0) {
    warnings.push('10만원이 넘어가면 보통 10만원 단위로 맞춥니다.');
  }
  if (input.occasion === 'funeral') {
    warnings.push('조의금 봉투에는 축하 문구를 쓰지 않습니다. 부의(賻儀) 또는 근조(謹弔)라고 적으면 됩니다.');
  }

  return ok({
    value: {
      recommended,
      min: stepDown(recommended, rule.ladder),
      max: stepUp(recommended, rule.ladder),
      mealFloor,
      reciprocityFloor,
      occasionLabel: occasion.note,
    },
    steps,
    assumptions,
    warnings,
    basis: [lookup.rule.meta],
  });
}
