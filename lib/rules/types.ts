/**
 * 룰 파일과 계산 결과의 공통 타입.
 * 기준값(상한액·요율·공제표)은 이 파일이 아니라 /rules/<연도>/*.json 에만 존재한다.
 */

/** 룰 파일 하나의 출처와 유효기간. 모든 룰 파일이 반드시 갖는다. */
export type RuleMeta = {
  /** 룰 식별자. 같은 ruleId를 가진 파일이 연도별로 여러 개 존재한다. */
  ruleId: string;
  /** 사람이 읽는 이름. 근거 푸터에 그대로 노출된다. */
  title: string;
  /** 이 기준값이 적용되기 시작하는 날짜 (YYYY-MM-DD) */
  effectiveFrom: string;
  /** 적용 종료일. 아직 유효하면 null */
  effectiveTo: string | null;
  /** 근거 조문/고시 */
  source: string;
  sourceUrl: string;
  /** 마지막으로 사람이 원문과 대조한 날짜 */
  verifiedAt: string;
  /** 무엇과 대조했는지 */
  verifiedBy: string;
  /** 이 룰을 읽을 때 알아야 할 단서 */
  note?: string;
};

export type RuleFile<V> = {
  meta: RuleMeta;
  values: V;
};

/** 계산 과정 한 줄. UI에 그대로 렌더링된다. */
export type CalcStep = {
  /** "근속연수공제 차감" */
  label: string;
  /** "1억원 − 4,000만원" */
  formula: string;
  result: number;
  /** result의 단위. 금액이 아닌 단계(개월 수 등)를 구분하기 위해 쓴다. */
  unit?: 'KRW' | 'MONTH' | 'DAY' | 'COUNT' | 'RATIO';
  /** 이 단계에 대한 쉬운 설명 */
  note?: string;
  /** 하위 단계. 월별 내역처럼 접어둘 항목에 쓴다. */
  children?: CalcStep[];
};

export type CalcResult<T> = {
  /** 최종 결과 */
  value: T;
  /** 계산 과정 */
  steps: CalcStep[];
  /** 이 계산이 전제한 것 */
  assumptions: string[];
  /** 사용자가 놓치기 쉬운 함정 */
  warnings: string[];
  /**
   * 근거 조문 + 기준일.
   * 명세는 단수였으나 한 화면에서 둘 이상의 룰을 쓰는 도구(휴가 타임라인 = 출산전후휴가 + 육아휴직)가
   * 있어 배열로 둔다. BasisFooter가 전부 나열한다.
   */
  basis: RuleMeta[];
};

/** 계산에 필요한 값이 비었을 때, 에러 대신 무엇이 부족한지 돌려준다. */
export type MissingInput = {
  field: string;
  label: string;
  hint: string;
};

export type CalcOutcome<T> =
  | { ok: true; result: CalcResult<T> }
  | { ok: false; missing: MissingInput[] };

export function missing<T>(...items: MissingInput[]): CalcOutcome<T> {
  return { ok: false, missing: items };
}

export function ok<T>(result: CalcResult<T>): CalcOutcome<T> {
  return { ok: true, result };
}
