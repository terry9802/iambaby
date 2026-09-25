import regionCodes from '@/rules/2026/region-codes.json';

/**
 * 실거래가 조회에 쓰는 시·군·구 목록.
 *
 * 코드는 전부 API에 직접 물어 확인한 것이다(룰 파일 meta 참조). 추측한 코드를
 * 넣으면 엉뚱한 동네가 나오거나 한 건도 안 나온다. 실제로 화성시는 2026년
 * 2월에 네 개 구로 나뉘어 예전 코드로는 아무것도 나오지 않았다.
 */

export type Sigungu = { code: string; name: string; sidoCode: string; sidoName: string };

const ALL: Sigungu[] = regionCodes.values.sido.flatMap((s) =>
  s.sigungu.map((g) => ({
    code: g.code,
    name: g.name,
    sidoCode: s.code,
    sidoName: s.name,
  })),
);

export function listSido() {
  return regionCodes.values.sido.map((s) => ({ code: s.code, name: s.name }));
}

export function listSigunguOf(sidoCode: string): Sigungu[] {
  return ALL.filter((g) => g.sidoCode === sidoCode);
}

export function findSigungu(code: string): Sigungu | undefined {
  return ALL.find((g) => g.code === code);
}

export const COVERAGE_NOTE = regionCodes.values.coverageNote;
export const REGION_META = regionCodes.meta;
