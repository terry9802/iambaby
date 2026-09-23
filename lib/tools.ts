import type { IconName } from '@/components/ui/Icon';
import type { Profile } from '@/lib/profile/schema';

export type EventKey =
  | 'childcare'
  | 'marriage'
  | 'housing'
  | 'jobchange'
  | 'retirement'
  | 'inheritance'
  | 'socialdues'
  | 'rest';

export type LifeEvent = {
  key: EventKey;
  title: string;
  /** 사용자 언어로 된 한 줄. 홈에서 이 문장을 보고 고른다. */
  lead: string;
  status: 'live' | 'soon';
  icon: IconName;
  /** 이벤트 허브 아래에 붙는 "알아두면 덜 억울한 것" */
  tips?: { title: string; body: string }[];
};

export const EVENTS: LifeEvent[] = [
  {
    key: 'childcare',
    title: '출산 · 육아',
    lead: '아이가 생겼는데 뭘 언제 신청해야 하는지 하나도 모르겠어요',
    status: 'live',
    icon: 'childcare',
    tips: [
      {
        title: '사후지급금은 폐지됐어요.',
        body: '예전에는 급여의 25%를 복직 6개월 뒤에 줬지만, 지금은 휴직 중에 전액을 받습니다. 오래된 블로그 글에 속지 마세요.',
      },
      {
        title: '부모급여·아동수당은 60일이 전부예요.',
        body: '출생일 포함 60일 안에 신청해야 태어난 달까지 소급됩니다. 하루만 늦어도 그 전 달치는 사라져요.',
      },
      {
        title: '육아휴직은 30일 전에 신청해야 해요.',
        body: '시작 예정일 30일 전까지 회사에 알려야 합니다. 급여 신청과는 별개예요.',
      },
      {
        title: '부부가 나눠 쓰면 상한액이 올라갑니다.',
        body: '생후 18개월 안에 둘 다 육아휴직을 쓰면 첫 6개월 상한이 매달 올라가요. 한 사람만 쓰면 해당되지 않습니다.',
      },
    ],
  },
  {
    key: 'marriage',
    title: '내 결혼',
    lead: '결혼하면 세금이랑 지원이 어떻게 달라지나요',
    status: 'live',
    icon: 'marriage',
    tips: [
      {
        title: '기준은 결혼식이 아니라 혼인신고일이에요.',
        body: '식을 올렸어도 혼인신고를 하지 않으면 세제 혜택은 하나도 적용되지 않습니다.',
      },
      {
        title: '결혼세액공제는 2026년 12월 31일에 끝납니다.',
        body: '2024년 1월 1일부터 2026년 12월 31일 사이에 혼인신고를 한 경우에만 받을 수 있는 한시 제도예요.',
      },
      {
        title: '생애 한 번뿐입니다.',
        body: '재혼도 받을 수 있지만, 예전 결혼에서 이미 받았다면 다시 받을 수 없습니다.',
      },
    ],
  },
  {
    key: 'housing',
    title: '내 집 마련',
    lead: '집값 말고 세금이랑 수수료는 얼마나 더 드나요',
    status: 'live',
    icon: 'housing',
    tips: [
      {
        title: '집값만 보고 예산을 짜면 잔금 날 모자랍니다.',
        body: '500,000,000원짜리 집이면 취득세·지방교육세·중개보수로 7,700,000원쯤이 더 나갑니다. 계약금 내기 전에 이 돈이 어디서 나올지 정해 두세요.',
      },
      {
        title: '전용 85㎡가 경계선입니다.',
        body: '85㎡를 넘으면 농어촌특별세 0.2%가 더 붙습니다. 흔히 말하는 국민평형 84㎡는 딱 면제 대상이에요. 1㎡ 차이로 금액이 갈립니다.',
      },
      {
        title: '중개보수는 상한일 뿐입니다.',
        body: '조례에 적힌 요율은 최대치고, 실제 금액은 중개사와 협의해서 정합니다. 깎아달라고 해도 됩니다.',
      },
      {
        title: '경매는 낙찰가가 다가 아닙니다.',
        body: '감정가의 75%에 받았다고 해도 세금, 명도비, 밀린 관리비를 더하면 이야기가 달라집니다. 그리고 잔금을 한 달 안에 내야 해요. 못 내면 보증금을 잃습니다.',
      },
      {
        title: '처음 사는 집이면 2,000,000원을 깎아줍니다.',
        body: '본인과 배우자 모두 집을 가진 적이 없고 취득가액이 1,200,000,000원 이하일 때입니다. 다만 3년 안에 팔거나 세를 주면 다시 뱉어내야 해요.',
      },
    ],
  },
  {
    key: 'jobchange',
    title: '이직',
    lead: '연봉 얼마를 불러야 지금보다 이득인가요',
    status: 'live',
    icon: 'jobchange',
    tips: [
      {
        title: '연봉이 올라도 실수령액은 줄 수 있습니다.',
        body: '지금 회사의 식대 같은 비과세 수당이 크면, 연봉이 조금 올라도 손에 쥐는 돈은 오히려 줄어듭니다.',
      },
      {
        title: '퇴직금 정산 시점을 확인하세요.',
        body: '1년을 못 채우고 옮기면 퇴직금이 없습니다. 며칠 차이로 갈리니 퇴사일을 꼭 따져보세요.',
      },
      {
        title: '남은 연차도 돈입니다.',
        body: '쓰지 못한 연차는 수당으로 받을 수 있습니다. 퇴사 전에 인사팀에 확인하세요.',
      },
    ],
  },
  {
    key: 'retirement',
    title: '퇴직',
    lead: '퇴직금이랑 실업급여가 얼마나 나오나요',
    status: 'live',
    icon: 'retirement',
    tips: [
      {
        title: '1년이 기준선입니다.',
        body: '재직 기간이 365일에 하루라도 모자라면 퇴직금이 나오지 않습니다. 퇴사일을 정하기 전에 꼭 세어보세요.',
      },
      {
        title: '평균임금에는 상여금과 연차수당도 들어갑니다.',
        body: '월급만 넣고 계산하면 퇴직금이 실제보다 적게 나옵니다. 1년치의 3개월분이 더해집니다.',
      },
      {
        title: '실업급여는 퇴사하면 바로 신청하세요.',
        body: '퇴직 다음 날부터 12개월이 지나면 남은 일수가 있어도 받지 못합니다.',
      },
      {
        title: '스스로 그만두면 원칙적으로 못 받습니다.',
        body: '임금 체불, 통근 곤란, 질병처럼 정당한 사유가 인정되는 경우만 예외입니다. 판단은 고용센터가 합니다.',
      },
    ],
  },
  {
    key: 'inheritance',
    title: '상속 · 증여',
    lead: '부모님이 보태주시는 돈, 세금이 얼마나 붙나요',
    status: 'live',
    icon: 'inheritance',
    tips: [
      {
        title: '공제는 사람마다가 아니라 관계마다입니다.',
        body: '아버지에게 50,000,000원을 받았으면 어머니에게는 더 받을 공제가 없습니다. 둘 다 직계존속이라 한도를 함께 씁니다. 10년을 합쳐서 봐요.',
      },
      {
        title: '결혼이나 출산 전후 2년 안이면 100,000,000원이 더 나옵니다.',
        body: '부모·조부모에게 받는 경우에만 됩니다. 혼인신고일 전후 2년, 아이 출생신고일부터 2년이 기간이에요. 결혼과 출산을 합쳐 평생 100,000,000원이 한도입니다.',
      },
      {
        title: '세금이 0원이어도 신고는 하는 게 낫습니다.',
        body: '신고해 두면 그 돈이 어디서 났는지 나중에 설명할 필요가 없습니다. 집을 살 때 자금출처를 묻는 경우가 많아요.',
      },
      {
        title: '기한은 받은 날부터가 아닙니다.',
        body: '증여받은 날이 속하는 달의 말일부터 3개월입니다. 1월 15일에 받았으면 4월 30일까지예요. 기한 안에 신고하면 세금의 3%를 깎아줍니다.',
      },
    ],
  },
  {
    key: 'socialdues',
    title: '남의 경조사',
    lead: '이 사람 결혼식에 얼마 내야 실례가 아닌가요',
    status: 'live',
    icon: 'socialdues',
    tips: [
      {
        title: '정답은 없습니다.',
        body: '경조사비는 법이 아니라 관습이에요. 집안·지역·업계마다 다르고, 결국 두 사람 사이의 문제입니다.',
      },
      {
        title: '가장 강한 기준은 상호성입니다.',
        body: '설문에서도 친밀도 다음으로 강한 기준이 "그 사람이 내 경조사 때 낸 금액"이었어요. 기억나신다면 그게 답에 가깝습니다.',
      },
      {
        title: '식사를 하면 식대는 넘기는 게 좋아요.',
        body: '일반 예식장은 1인 50,000원, 호텔은 1인 100,000원쯤 듭니다. 동행하는 사람 수까지 세어야 해요.',
      },
    ],
  },
  {
    key: 'rest',
    title: '잘 쉬는 법',
    lead: '쉬는 데도 돈이 드는데, 나라에서 보태주는 게 있나요',
    status: 'live',
    icon: 'rest',
    tips: [
      {
        title: '대부분 연초에 한 번만 열립니다.',
        body: '선착순이거나 추첨인 게 많아서, 기간을 놓치면 1년을 기다려야 합니다. 근로자 휴가지원사업은 1월 30일 선착순, 문화누리카드는 2월 2일부터, 청년문화예술패스는 2월 25일부터 시작했어요.',
      },
      {
        title: '회사가 신청해 주는 것도 있어요.',
        body: '근로자 휴가지원사업은 개인이 신청할 수 없습니다. 200,000원을 내면 400,000원이 되는데도 회사가 신청을 안 해서 못 받는 경우가 많아요. 총무·인사팀에 "올해 신청하나요"라고 한 번 물어보세요.',
      },
      {
        title: '남은 돈은 그냥 사라집니다.',
        body: '문화누리카드는 12월 31일, 산림복지서비스이용권은 11월 30일이 지나면 잔액이 소멸합니다. 이월도 환불도 안 돼요.',
      },
    ],
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
};

export const TOOLS: Tool[] = [
  {
    slug: 'marriage-tax-credit',
    event: 'marriage',
    type: 'calculator',
    title: '결혼세액공제 계산기',
    question: '혼인신고만 해도 돌려받는 돈이 있나요?',
    lead: '2026년 12월 31일까지 혼인신고를 하면 부부 합쳐 최대 1,000,000원을 세금에서 돌려받습니다.',
    profileFields: ['maritalStatus', 'spouse'],
    ruleFile: 'marriage-tax-credit',
    timing: '혼인신고 전후',
  },
  {
    slug: 'salary-compare',
    event: 'jobchange',
    type: 'calculator',
    title: '이직 연봉 비교 계산기',
    question: '연봉 얼마를 불러야 지금보다 이득인가요?',
    lead: '지금 연봉과 제안받은 연봉의 실수령액을 나란히 놓고, 본전이 되는 금액을 알려드립니다.',
    profileFields: ['income'],
    ruleFile: 'payroll',
    timing: '제안을 받았을 때',
  },
  {
    slug: 'severance-pay',
    event: 'retirement',
    type: 'calculator',
    title: '퇴직금 계산기',
    question: '퇴직금 얼마나 나오나요?',
    lead: '입사일과 퇴사일, 급여를 넣으면 법이 정한 방식 그대로 계산해 드립니다.',
    profileFields: ['employment', 'income'],
    ruleFile: 'severance-pay',
    timing: '퇴사를 정할 때',
  },
  {
    slug: 'unemployment-benefit',
    event: 'retirement',
    type: 'calculator',
    title: '실업급여 계산기',
    question: '실업급여 얼마씩 며칠 받나요?',
    lead: '나이와 고용보험 가입기간으로 받는 일수를, 급여로 하루 금액을 계산합니다.',
    profileFields: ['income'],
    ruleFile: 'unemployment-benefit',
    timing: '퇴사한 직후',
  },
  {
    slug: 'jeonse-loan',
    event: 'marriage',
    type: 'checker',
    title: '신혼부부 전세자금대출 판정기',
    question: '우리도 신혼부부 전세대출 받을 수 있나요?',
    lead: '소득·자산·혼인 기간 요건을 하나씩 확인해 얼마까지 빌릴 수 있는지 알려드립니다.',
    profileFields: ['income', 'spouse', 'housing'],
    ruleFile: 'newlywed-jeonse-loan',
    timing: '집 구할 때',
  },
  {
    slug: 'social-dues',
    event: 'socialdues',
    type: 'calculator',
    title: '경조사비 계산기',
    question: '이 사람한테 얼마 내는 게 맞을까요?',
    lead: '관계, 자주 보는 정도, 식사 여부를 넣으면 무난한 금액과 그 이유를 알려드립니다.',
    profileFields: [],
    ruleFile: 'social-dues',
    timing: '봉투 쓰기 직전',
  },
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
  {
    slug: 'auction-cost',
    event: 'housing',
    type: 'checker',
    title: '경매 낙찰 총비용 계산기',
    question: '경매로 받으면 진짜 얼마에 산 건가요?',
    lead: '낙찰가에 세금·명도비·체납 관리비를 더해 실제로 드는 돈을 세고, 입찰 전에 확인해야 할 것을 짚어드립니다.',
    profileFields: [],
    ruleFile: 'auction',
    timing: '입찰표 쓰기 전에',
  },
  {
    slug: 'purchase-cost',
    event: 'housing',
    type: 'calculator',
    title: '집 살 때 드는 돈 계산기',
    question: '집값 말고 세금이랑 수수료는 얼마나 더 드나요?',
    lead: '취득세·지방교육세·농어촌특별세·중개보수를 모아 집값 외에 더 있어야 하는 돈을 알려드립니다.',
    profileFields: [],
    ruleFile: 'home-purchase',
    timing: '계약금 넣기 전에',
  },
  {
    slug: 'gift-tax',
    event: 'inheritance',
    type: 'calculator',
    title: '증여세 계산기',
    question: '부모님이 주시는 돈, 세금이 얼마나 붙나요?',
    lead: '받는 금액과 관계를 넣으면 낼 세금과 신고 마감일이 바로 나옵니다. 얼마까지 세금 없이 받을 수 있는지도 함께 보여드려요.',
    profileFields: [],
    ruleFile: 'gift-tax',
    timing: '돈을 받기 전에',
  },
  {
    slug: 'rest-benefits',
    event: 'rest',
    type: 'checker',
    title: '쉼 지원 통합 조회',
    question: '쉬는 데 나라에서 보태주는 돈, 나는 뭐가 돼요?',
    lead: '휴가비·문화·체육·숲 지원 다섯 가지를 놓고 내가 되는 것과 안 되는 것을 이유까지 가려냅니다.',
    profileFields: ['birthYear', 'residence'],
    ruleFile: 'rest-benefits',
    timing: '연초 (1~2월에 대부분 열립니다)',
  },
];

export const TOOL_TYPE_LABEL: Record<ToolType, string> = {
  calculator: '계산기',
  checker: '판정기',
  optimizer: '최적화계산기',
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
