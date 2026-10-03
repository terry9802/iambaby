import { SPEND_CATEGORIES, type SpendCategory } from './categories';

/**
 * 가계부 한 줄.
 *
 * 이 데이터는 프로필과 같은 약속 아래 있다. 서버로 보내지 않고 브라우저에만 남는다.
 * 여기에 fetch/axios/서버액션을 붙이지 말 것.
 *
 * 칸을 이렇게 나눈 이유는 연말정산 때문이다. 공제는 세 가지로 갈린다.
 *  - 누구 명의 카드인가 (공제는 명의자 소득에서만 받는다)
 *  - 신용인가 체크인가 (15% 대 30%)
 *  - 무엇을 샀는가 (전통시장·대중교통 40%, 도서공연 30%)
 * 이 셋을 안 적으면 나중에 아무것도 못 세어 준다. 그래서 적을 때 받아 둔다.
 */

/**
 * 내 생활비인가, 둘이 모아 쓰는 데이트비인가.
 *
 * 커플통장에서 카드값을 갚든 내 통장에서 갚든 연말정산은 달라지지 않는다.
 * 공제는 '무엇으로 긁었나'와 '누구 명의인가'로만 갈리고, 그 돈이 어느 통장에서
 * 빠져나갔는지는 보지 않는다. 그래도 이 칸을 받는 이유는 둘이 쓴 돈과 혼자 쓴
 * 돈을 갈라서 보고 싶기 때문이고, 데이트비를 한 사람 카드로 몰았을 때 손익이
 * 어떻게 되는지 그 덩어리만 따로 세어 보려는 것이다.
 */
export type Purse = 'personal' | 'couple';

/** 무엇으로 결제했는가. 공제율이 여기서 갈린다. */
export type Method = 'credit' | 'check' | 'cash';

/** 어느 쪽 명의 카드인가. 공제는 명의자 소득에서만 붙는다. */
export type Holder = 'me' | 'partner';

/**
 * 무엇을 샀는가. 공제율이 다른 것만 따로 둔다.
 * 나머지는 전부 general이고, 공제가 아예 안 되는 지출은 excluded다.
 */
export type Category = 'general' | 'market' | 'transit' | 'culture' | 'excluded';

export type Entry = {
  id: string;
  /**
   * 무엇에 썼는가. 사장님이 쓰시던 가계부 양식의 어휘를 그대로 쓴다.
   * 공제 분류(category)는 보통 여기서 유추되지만, 유추가 애매한 줄은
   * 화면에서 따로 바꿀 수 있어서 둘을 각각 들고 있는다.
   */
  spend?: SpendCategory;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
  purse: Purse;
  method: Method;
  holder: Holder;
  category: Category;
  memo?: string;
  /** 합칠 때 누가 적은 줄인지 알아보려고 둔다. 내가 적은 줄은 비어 있다. */
  source?: string;
};

export const PURSE_LABEL: Record<Purse, string> = {
  personal: '개인 생활비',
  couple: '커플 데이트비',
};

export const METHOD_LABEL: Record<Method, string> = {
  credit: '신용카드',
  check: '체크카드',
  cash: '현금영수증',
};

export const HOLDER_LABEL: Record<Holder, string> = {
  me: '내 명의',
  partner: '배우자 명의',
};

/**
 * 혼인신고 전이면 '배우자'가 아직 아니다. 예비부부에게 배우자라고 적으면
 * 화면이 자기 얘기가 아닌 것처럼 읽힌다. 엑셀처럼 한 번 떨구면 못 고치는
 * 곳은 기본값을 그대로 쓰고, 화면에서만 부르는 말을 바꾼다.
 */
export function holderLabel(holder: Holder, married: boolean): string {
  if (holder === 'me') return HOLDER_LABEL.me;
  return married ? '배우자 명의' : '상대 명의';
}

export const CATEGORY_LABEL: Record<Category, string> = {
  general: '일반',
  market: '전통시장',
  transit: '대중교통',
  culture: '도서·공연·영화',
  excluded: '공제 안 됨',
};

/**
 * 공제가 안 되는 지출을 고를 때 보여 주는 보기.
 * 사람들이 제일 많이 헷갈리는 것들이라 적어 둔다.
 */
export const EXCLUDED_HINT =
  '보험료, 교육비, 세금·공과금, 아파트 관리비, 통신비, 상품권 구입, 자동차 구입(중고차는 10%만 인정)은 공제 대상이 아닙니다.';

export const LEDGER_STORAGE_KEY = 'nanaegi.ledger.v1';
export const LEDGER_SCHEMA_VERSION = 1;

export type StoredLedger = {
  version: number;
  updatedAt: string;
  entries: Entry[];
};

const PURSES: Purse[] = ['personal', 'couple'];
const METHODS: Method[] = ['credit', 'check', 'cash'];
const HOLDERS: Holder[] = ['me', 'partner'];
const CATEGORIES: Category[] = ['general', 'market', 'transit', 'culture', 'excluded'];

/**
 * 저장소에서 읽은 줄은 사람이 직접 고쳤을 수도, 남이 보낸 파일일 수도 있다.
 * 모양이 맞는 줄만 남기고 나머지는 조용히 버린다. 한 줄이 이상하다고
 * 가계부 전체를 못 쓰게 만들면 안 된다.
 */
export function sanitizeEntry(input: unknown): Entry | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;

  const date =
    typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
  if (!date) return null;

  const amount = typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? raw.amount : null;
  if (amount === null || amount <= 0) return null;

  const purse = PURSES.includes(raw.purse as Purse) ? (raw.purse as Purse) : 'personal';
  const method = METHODS.includes(raw.method as Method) ? (raw.method as Method) : 'credit';
  const holder = HOLDERS.includes(raw.holder as Holder) ? (raw.holder as Holder) : 'me';
  const category = CATEGORIES.includes(raw.category as Category)
    ? (raw.category as Category)
    : 'general';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    date,
    amount: Math.round(amount),
    purse,
    method,
    holder,
    category,
    ...(SPEND_CATEGORIES.includes(raw.spend as SpendCategory)
      ? { spend: raw.spend as SpendCategory }
      : {}),
    ...(typeof raw.memo === 'string' && raw.memo ? { memo: raw.memo.slice(0, 120) } : {}),
    ...(typeof raw.source === 'string' && raw.source ? { source: raw.source.slice(0, 40) } : {}),
  };
}

export function sanitizeEntries(input: unknown): Entry[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(sanitizeEntry)
    .filter((e): e is Entry => e !== null)
    .sort(byDateDesc);
}

export function byDateDesc(a: Entry, b: Entry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

/**
 * crypto.randomUUID는 안전한 맥락(https)에서만 있다. 카카오톡 인앱 브라우저처럼
 * 없는 데가 있어서, 없으면 시간 + 난수로 만든다. 이 아이디는 합칠 때 같은 줄을
 * 두 번 넣지 않으려고 쓰는 것이라 전역 유일하기만 하면 된다.
 */
export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // 아래로 떨어진다
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
