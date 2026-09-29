/**
 * 사용자 프로필. 전부 optional — 아는 것만 채운다.
 *
 * 이 데이터는 절대 서버로 보내지 않는다. localStorage에만 남고 모든 계산은 브라우저에서 끝난다.
 * 이 약속이 이 사이트의 신뢰 근거이므로, 프로필을 fetch/axios/서버액션에 싣는 코드를 추가하지 말 것.
 */

export type EmploymentType =
  | 'regular' // 정규직
  | 'contract' // 계약직
  | 'freelance' // 프리랜서·개인사업자
  | 'unemployed' // 비취업
  | 'unknown';

export type Tenure = 'jeonse' | 'monthly' | 'owned' | 'family';

export type ChildPlan =
  | 'none' // 아이가 없고 계획도 아직
  | 'expecting' // 임신 중 — 출산 예정일을 적는다
  | 'has'; // 이미 태어난 아이가 있다

export const CHILD_PLAN_LABEL: Record<ChildPlan, string> = {
  none: '없어요',
  expecting: '기다리는 중',
  has: '있어요',
};

export type Profile = {
  birthYear?: number;
  maritalStatus?: 'single' | 'married';
  /**
   * 혼인신고일 (YYYY-MM-DD).
   * 결혼세액공제도, 혼인 증여재산공제도 예식 날이 아니라 이 날로 따진다.
   */
  marriageDate?: string;
  spouse?: {
    monthlyWage?: number; // 배우자 통상임금(월)
    /**
     * 배우자 연간 총급여(세전).
     * 통상임금 × 12로 갈음하지 않는다. 통상임금은 상여금·성과급을 빼고 센 금액이라
     * 총급여보다 작고, 카드 공제의 문턱(총급여의 25%)과 기본공제 판정(총급여 500만원)은
     * 총급여로 정해진다. 둘을 섞으면 답이 어긋난다.
     */
    annualSalary?: number;
    employmentType?: EmploymentType;
  };
  /**
   * 아이가 없는지, 기다리는 중인지, 있는지.
   *
   * children이 빈 것만으로는 "아이가 없다"와 "아직 안 적었다"를 가를 수 없다.
   * 그 둘을 못 가르면 아이 없는 사람에게 생년월일을 필수라고 조르게 된다.
   */
  childPlan?: ChildPlan;
  children?: { birthDate: string }[]; // YYYY-MM-DD. 출산 예정일도 여기에 넣는다.
  income?: {
    annualSalary?: number;
    monthlyWage?: number; // 통상임금(월)
  };
  employment?: {
    joinDate?: string; // YYYY-MM-DD
    employmentType?: EmploymentType;
  };
  housing?: {
    ownedHomes?: number;
    tenure?: Tenure;
  };
  assets?: {
    property?: number;
    financial?: number;
  };
  /** 지자체 지원금 조회에 쓰는 거주지. 시/도 + 시군구 코드 */
  residence?: {
    sido?: string; // 'seoul'
    sigungu?: string; // 'gangnam'
  };
  /** 한부모 여부 — 육아휴직 급여 특례에 쓰인다 */
  singleParent?: boolean;
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  regular: '정규직',
  contract: '계약직·기간제',
  freelance: '프리랜서·개인사업자',
  unemployed: '일하고 있지 않음',
  unknown: '잘 모르겠어요',
};

export const EMPTY_PROFILE: Profile = {};

export const PROFILE_STORAGE_KEY = 'nanaegi.profile.v1';
export const PROFILE_SCHEMA_VERSION = 1;

export type StoredProfile = {
  version: number;
  updatedAt: string;
  profile: Profile;
};

/**
 * localStorage에서 읽은 값은 사용자가 직접 고쳤을 수도, 이전 버전일 수도 있다.
 * 타입이 맞는 필드만 골라 담고 나머지는 조용히 버린다.
 */
export function sanitizeProfile(input: unknown): Profile {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const out: Profile = {};

  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

  /*
    네 자리를 다 치기 전에 화면이 저장하면 "199년생"이 남는다. 그 값으로
    나이를 세면 청년 혜택이 엉뚱하게 갈린다. 있을 수 없는 해는 아예 안 받는다.
  */
  const birthYear = num(raw.birthYear);
  if (birthYear !== undefined && birthYear >= 1900 && birthYear <= new Date().getFullYear()) {
    out.birthYear = birthYear;
  }
  if (raw.maritalStatus === 'single' || raw.maritalStatus === 'married') {
    out.maritalStatus = raw.maritalStatus;
  }
  if (typeof raw.singleParent === 'boolean') out.singleParent = raw.singleParent;
  const marriageDate = str(raw.marriageDate);
  if (marriageDate && /^\d{4}-\d{2}-\d{2}$/.test(marriageDate)) out.marriageDate = marriageDate;

  const spouse = obj(raw.spouse);
  const spouseWage = num(spouse.monthlyWage);
  const spouseAnnual = num(spouse.annualSalary);
  const spouseType = str(spouse.employmentType);
  if (spouseWage !== undefined || spouseAnnual !== undefined || spouseType) {
    out.spouse = {
      ...(spouseWage !== undefined ? { monthlyWage: spouseWage } : {}),
      ...(spouseAnnual !== undefined ? { annualSalary: spouseAnnual } : {}),
      ...(spouseType ? { employmentType: spouseType as EmploymentType } : {}),
    };
  }

  if (raw.childPlan === 'none' || raw.childPlan === 'expecting' || raw.childPlan === 'has') {
    out.childPlan = raw.childPlan;
  }

  if (Array.isArray(raw.children)) {
    const children = raw.children
      .map((c) => str(obj(c).birthDate))
      .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d))
      .map((birthDate) => ({ birthDate }));
    if (children.length) out.children = children;
  }

  const income = obj(raw.income);
  const annual = num(income.annualSalary);
  const monthly = num(income.monthlyWage);
  if (annual !== undefined || monthly !== undefined) {
    out.income = {
      ...(annual !== undefined ? { annualSalary: annual } : {}),
      ...(monthly !== undefined ? { monthlyWage: monthly } : {}),
    };
  }

  const employment = obj(raw.employment);
  const joinDate = str(employment.joinDate);
  const empType = str(employment.employmentType);
  if (joinDate || empType) {
    out.employment = {
      ...(joinDate ? { joinDate } : {}),
      ...(empType ? { employmentType: empType as EmploymentType } : {}),
    };
  }

  const housing = obj(raw.housing);
  const ownedHomes = num(housing.ownedHomes);
  const tenure = str(housing.tenure);
  if (ownedHomes !== undefined || tenure) {
    out.housing = {
      ...(ownedHomes !== undefined ? { ownedHomes } : {}),
      ...(tenure ? { tenure: tenure as Tenure } : {}),
    };
  }

  const assets = obj(raw.assets);
  const property = num(assets.property);
  const financial = num(assets.financial);
  if (property !== undefined || financial !== undefined) {
    out.assets = {
      ...(property !== undefined ? { property } : {}),
      ...(financial !== undefined ? { financial } : {}),
    };
  }

  const residence = obj(raw.residence);
  const sido = str(residence.sido);
  const sigungu = str(residence.sigungu);
  if (sido || sigungu) {
    out.residence = { ...(sido ? { sido } : {}), ...(sigungu ? { sigungu } : {}) };
  }

  return out;
}

/**
 * 프로필이 얼마나 채워졌는지. 홈에서 "3개만 더 채우면" 같은 안내에 쓴다.
 *
 * 세는 항목이 사람마다 다르다. 미혼인 사람에게 배우자 임금을 세면 아무리 채워도
 * 100%가 안 되고, 아이가 없는 사람에게 아이 생일을 세면 영영 못 채운다.
 * 채울 수 없는 칸을 세는 진척도는 독촉일 뿐이라, 그 사람에게 해당하는 것만 센다.
 */
export function profileCompletion(profile: Profile): { filled: number; total: number } {
  const checks: boolean[] = [
    profile.birthYear !== undefined,
    profile.maritalStatus !== undefined,
    profile.childPlan !== undefined,
    profile.income?.monthlyWage !== undefined,
    profile.income?.annualSalary !== undefined,
    profile.employment?.joinDate !== undefined,
    // 시·도를 고르는 것까지가 누구나 할 수 있는 일이다. 시·군·구 목록은
    // 룰이 있는 지역에만 뜨므로, '그 밖의 지역'을 고른 사람은 고를 칸이 없다.
    profile.residence?.sido !== undefined,
  ];

  if (profile.childPlan === 'expecting' || profile.childPlan === 'has') {
    checks.push((profile.children?.length ?? 0) > 0);
  }

  if (profile.maritalStatus === 'married') {
    checks.push(profile.marriageDate !== undefined);
    checks.push(profile.spouse?.monthlyWage !== undefined);
    checks.push(profile.spouse?.annualSalary !== undefined);
  }

  return { filled: checks.filter(Boolean).length, total: checks.length };
}
