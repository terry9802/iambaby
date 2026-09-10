import type { IconName } from '@/components/ui/Icon';
import type { Profile } from '@/lib/profile/schema';

export type EventKey =
  | 'childcare'
  | 'marriage'
  | 'housing'
  | 'jobchange'
  | 'retirement'
  | 'inheritance'
  | 'socialdues';

export type LifeEvent = {
  key: EventKey;
  title: string;
  /** 사용자 언어로 된 한 줄. 홈에서 이 문장을 보고 고른다. */
  lead: string;
  status: 'live' | 'soon';
  icon: IconName;
};

export const EVENTS: LifeEvent[] = [
  {
    key: 'childcare',
    title: '출산 · 육아',
    lead: '아이가 생겼는데 뭘 언제 신청해야 하는지 하나도 모르겠어요',
    status: 'live',
    icon: 'childcare',
  },
  {
    key: 'marriage',
    title: '결혼',
    lead: '결혼하면 세금이랑 청약이 어떻게 달라지나요',
    status: 'soon',
    icon: 'marriage',
  },
  {
    key: 'housing',
    title: '내 집 마련',
    lead: '전세랑 매매 중에 뭐가 나은지 계산해 주세요',
    status: 'soon',
    icon: 'housing',
  },
  {
    key: 'jobchange',
    title: '이직',
    lead: '연봉 얼마를 불러야 지금보다 이득인가요',
    status: 'soon',
    icon: 'jobchange',
  },
  {
    key: 'retirement',
    title: '퇴직',
    lead: '퇴직금이랑 실업급여가 얼마나 나오나요',
    status: 'soon',
    icon: 'retirement',
  },
  {
    key: 'inheritance',
    title: '상속 · 증여',
    lead: '물려받으면 세금을 얼마나 내야 하나요',
    status: 'soon',
    icon: 'inheritance',
  },
  {
    key: 'socialdues',
    title: '남의 경조사',
    lead: '이 사람 결혼식에 얼마 내야 실례가 아닌가요',
    status: 'soon',
    icon: 'socialdues',
  },
];

export type ToolType = 'calculator' | 'checker' | 'optimizer';

export type Tool = {
  slug: string;
  event: EventKey;
  type: ToolType;
  title: string;
  /** 사용자 언어로 된 질문. 페이지 제목으로 그대로 쓴다. */
  question: string;
  /** 한 줄 설명 */
  lead: string;
  profileFields: (keyof Profile)[];
  ruleFile: string;
  /** 타임라인에서 이 도구가 필요한 시점 */
  timing: string;
  featured?: boolean;
};

export const TOOLS: Tool[] = [
  {
    slug: 'leave-timeline',
    event: 'childcare',
    type: 'calculator',
    title: '출산휴가·육아휴직 타임라인',
    question: '언제부터 언제까지 쉬고, 언제 뭘 신청해요?',
    lead: '출산전후휴가부터 복직까지의 전체 일정과 신청 마감일을 한 장으로 봅니다.',
    profileFields: ['children', 'income', 'employment'],
    ruleFile: 'maternity-leave',
    timing: '임신 중 · 출산 전',
  },
  {
    slug: 'parental-leave-pay',
    event: 'childcare',
    type: 'calculator',
    title: '육아휴직 급여 계산기',
    question: '육아휴직 쓰면 매달 얼마 받아요?',
    lead: '통상임금과 사용 개월 수를 넣으면 달마다 얼마인지, 총 얼마인지 계산합니다.',
    profileFields: ['income', 'singleParent'],
    ruleFile: 'parental-leave',
    timing: '육아휴직 결정할 때',
  },
  {
    slug: 'couple-leave',
    event: 'childcare',
    type: 'optimizer',
    title: '6+6 부모육아휴직 조합 최적화기',
    question: '우리 부부, 누가 언제 얼마나 쓰는 게 제일 이득이에요?',
    lead: '가능한 조합을 전부 계산해 총액이 가장 큰 조합과 월별 현금흐름을 함께 보여줍니다.',
    profileFields: ['income', 'spouse', 'children'],
    ruleFile: 'parental-leave-couple',
    timing: '자녀 생후 18개월 이내',
    featured: true,
  },
  {
    slug: 'birth-grants',
    event: 'childcare',
    type: 'checker',
    title: '출산·육아 지원금 통합 조회',
    question: '우리 지역에서 받을 수 있는 돈, 전부 얼마예요?',
    lead: '정부와 지자체 지원을 모아 합계와 신청 마감일을 D-day로 보여줍니다.',
    profileFields: ['children', 'residence'],
    ruleFile: 'birth-grants-national',
    timing: '출생신고 직후 (60일 이내)',
  },
];

export const TOOL_TYPE_LABEL: Record<ToolType, string> = {
  calculator: '계산기',
  checker: '판정기',
  optimizer: '최적화기',
};

export function toolsOf(event: EventKey): Tool[] {
  return TOOLS.filter((t) => t.event === event);
}

export function findTool(event: string, slug: string): Tool | undefined {
  return TOOLS.find((t) => t.event === event && t.slug === slug);
}

export function findEvent(key: string): LifeEvent | undefined {
  return EVENTS.find((e) => e.key === key);
}
