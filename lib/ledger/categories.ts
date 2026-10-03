import type { Category, Method } from './schema';

/**
 * 사장님이 쓰시던 가계부 양식의 어휘.
 *
 * 올려주신 파일을 열어 보니 칸이 이렇게 돼 있었다.
 *   지출 내역 | 금액 | 날짜 | 카테고리 | 출금처
 * 그리고 옆에 SUMIF로 카테고리별·출금처별 합계를 내고 차트를 붙여 두셨다.
 *
 * 우리는 그동안 '공제 분류'(일반/전통시장/대중교통/도서공연/공제 안 됨)만 받았는데,
 * 그건 세법의 축이지 가계부의 축이 아니다. 식비를 얼마 썼는지는 안 나온다.
 * 사장님 어휘를 그대로 들여와서 두 가지를 한꺼번에 푼다.
 *
 *  1) 쓰시던 시트의 수식과 차트가 그대로 붙는다
 *  2) 소비 카테고리 하나만 고르면 공제 분류는 거기서 유추한다
 *
 * 다만 유추에는 한계가 있다. 아래 note가 붙은 것들은 추측이라 화면에서 바꿀 수 있게 둔다.
 */

export type SpendCategory =
  | '식비'
  | '교통'
  | '주거비'
  | '월세/이자/통신비'
  | '의료/건강'
  | '문화생활'
  | '쇼핑'
  | '일상용품'
  | '꾸밈비'
  | '구독'
  | '운동'
  | '여행'
  | '경조비'
  | '저축/투자'
  | '기타';

export const SPEND_CATEGORIES: SpendCategory[] = [
  '식비',
  '교통',
  '주거비',
  '월세/이자/통신비',
  '의료/건강',
  '문화생활',
  '쇼핑',
  '일상용품',
  '꾸밈비',
  '구독',
  '운동',
  '여행',
  '경조비',
  '저축/투자',
  '기타',
];

export const DEFAULT_SPEND_CATEGORY: SpendCategory = '식비';

/**
 * 소비 카테고리에서 공제 분류를 유추한다.
 *
 * 확실한 것만 특별 대우하고 나머지는 '일반'으로 둔다. 애매한 걸 40%짜리로
 * 올려 두면 연말정산 때 실제보다 많이 돌려받는 줄 알고 계시게 된다.
 * 모자라게 세는 건 놀랄 일이 없지만, 넘치게 세는 건 사람을 속이는 것이다.
 */
export function deductionCategoryOf(spend: SpendCategory): Category {
  switch (spend) {
    /*
      저축·투자·청약은 애초에 쓴 돈이 아니라 옮긴 돈이고,
      월세·이자·통신비는 조특법이 카드 공제 대상에서 빼 둔 항목이다.
    */
    case '저축/투자':
    case '월세/이자/통신비':
      return 'excluded';

    /*
      교통은 40%짜리 대중교통일 수도, 택시나 주유일 수도 있다. 섞여 있으므로
      기본은 일반으로 두고, 버스·지하철·기차만 쓰셨으면 화면에서 바꾸시게 한다.
      여기서 40%로 올려 두면 안 돌려받을 돈을 돌려받는 줄 아시게 된다.
    */
    case '교통':
      return 'general';

    /*
      문화생활도 마찬가지다. 도서·공연·영화·박물관만 30%(총급여 7천만 이하)이고
      카페나 술자리는 아니다.
    */
    case '문화생활':
      return 'general';

    default:
      return 'general';
  }
}

/** 화면에서 "이건 바꾸면 더 받을 수 있어요"라고 귀띔할 항목 */
export const CATEGORY_HINT: Partial<Record<SpendCategory, string>> = {
  교통: '버스·지하철·기차만 쓰신 줄이면 공제 분류를 대중교통으로 바꾸세요. 40%가 붙습니다. 택시·주유는 안 됩니다.',
  문화생활:
    '도서·공연·영화·박물관이면 공제 분류를 도서·공연·영화로 바꾸세요. 총급여 7,000만원 이하만 30%가 붙습니다.',
  '월세/이자/통신비': '카드 공제 대상이 아닙니다. 월세는 따로 월세 세액공제가 있어요.',
  '저축/투자': '쓴 돈이 아니라 옮긴 돈이라 공제에 들어가지 않습니다.',
};

/**
 * 사장님 시트의 '출금처'.
 *
 * 결제수단과 계좌가 한 칸에 섞여 있다. 공제는 결제수단으로 갈리므로 우리 쪽에선
 * 나눠 두되, 엑셀로 내보낼 때는 다시 한 칸으로 합쳐서 쓰시던 수식이 그대로 돌게 한다.
 */
export const SOURCE_LABEL: Record<Method, string> = {
  credit: '신용카드',
  check: '체크카드',
  cash: '현금영수증',
};

/** 사장님 시트의 출금처 값을 우리 결제수단으로 옮긴다. */
export function methodFromSource(source: string): { method: Method; category?: Category } {
  const s = source.replace(/\s/g, '');
  if (s.includes('신용')) return { method: 'credit' };
  if (s.includes('체크')) return { method: 'check' };
  if (s.includes('현금영수증')) return { method: 'cash' };
  /*
    계좌이체·청약·카드값은 현금영수증을 따로 발급받지 않으면 공제가 안 된다.
    카드값은 더 그렇다. 이미 카드로 긁을 때 공제에 들어갔으니 갚는 걸 또 세면
    같은 돈을 두 번 세는 꼴이 된다.
  */
  if (s.includes('카드값') || s.includes('카드비')) return { method: 'cash', category: 'excluded' };
  if (s.includes('이체') || s.includes('청약') || s.includes('저축')) {
    return { method: 'cash', category: 'excluded' };
  }
  return { method: 'cash' };
}

/**
 * 카드값을 갚은 줄인가.
 *
 * 가계부에 "카드값 722,633"처럼 적는 분이 많다. 그런데 그 돈은 이미 카드로
 * 긁을 때 한 줄씩 적혔다. 갚은 것까지 또 세면 같은 돈을 두 번 세는 꼴이고,
 * 공제도 두 배로 부풀어 보인다. 그래서 쓴 돈이 아니라 옮긴 돈으로 본다.
 */
export function isCardBill(text: string): boolean {
  const s = text.replace(/\s/g, '');
  return s.includes('카드값') || s.includes('카드비') || s.includes('카드대금');
}

/** 올려주신 파일에 있던 값 중 우리 목록에 없는 말을 가장 가까운 것으로 옮긴다. */
export function spendCategoryFrom(raw: string): SpendCategory {
  const s = raw.trim();
  const exact = SPEND_CATEGORIES.find((c) => c === s);
  if (exact) return exact;
  if (s.includes('카드값') || s.includes('카드비')) return '기타';
  if (s.includes('노조') || s.includes('회비')) return '기타';
  if (s.includes('청약')) return '저축/투자';
  if (s.includes('통신') || s.includes('월세') || s.includes('이자')) return '월세/이자/통신비';
  if (s.includes('교통') || s.includes('주유')) return '교통';
  if (s.includes('의료') || s.includes('건강') || s.includes('약')) return '의료/건강';
  return '기타';
}
