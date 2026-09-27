/**
 * 받아온 거래를 모으는 계산. 네트워크도 인증키도 여기 없다.
 *
 * rtms.ts는 서버에서만 돌아야 해서 server-only가 걸려 있는데, 그러면 테스트에서
 * 불러올 수가 없다. 검증할 값어치가 있는 건 이쪽 계산이라 파일을 갈랐다.
 */

export type Deal = {
  name: string;
  /** 전용면적 (제곱미터) */
  area: number;
  floor: number | null;
  buildYear: number | null;
  dong: string;
  /** 지번. 주소를 좌표로 바꿀 때 쓴다. */
  jibun?: string;
  /** 매매가 또는 보증금 (원) */
  amount: number;
  /** 월세 (원). 전세나 매매면 0 */
  monthlyRent: number;
  date: string;
  /** ㎡당 단가 (원) */
  unitPrice: number;
};

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * 전용면적대. 같은 동네여도 59㎡와 84㎡는 ㎡당 단가가 다르다.
 * 묶지 않고 평균을 내면 작은 평수가 많은 달에 단가가 튀어 보인다.
 */
export const AREA_BANDS = [
  { key: 'under60', label: '60㎡ 미만', min: 0, max: 60 },
  { key: '60to85', label: '60~85㎡', min: 60, max: 85 },
  { key: '85to135', label: '85~135㎡', min: 85, max: 135 },
  { key: 'over135', label: '135㎡ 이상', min: 135, max: Infinity },
] as const;

export function bandOf(area: number) {
  return AREA_BANDS.find((b) => area >= b.min && area < b.max) ?? AREA_BANDS[AREA_BANDS.length - 1];
}

export type BandSummary = {
  key: string;
  label: string;
  count: number;
  medianUnitPrice: number;
  medianAmount: number;
  minAmount: number;
  maxAmount: number;
};

export function summarizeByBand(deals: Deal[]): BandSummary[] {
  return AREA_BANDS.map((band) => {
    const inBand = deals.filter((d) => bandOf(d.area).key === band.key);
    const amounts = inBand.map((d) => d.amount);
    return {
      key: band.key,
      label: band.label,
      count: inBand.length,
      medianUnitPrice: median(inBand.map((d) => d.unitPrice)),
      medianAmount: median(amounts),
      minAmount: amounts.length ? Math.min(...amounts) : 0,
      maxAmount: amounts.length ? Math.max(...amounts) : 0,
    };
  }).filter((b) => b.count > 0);
}


export type ComplexSummary = {
  /** 단지 식별자. 같은 이름의 다른 단지를 가르기 위해 실거래가 API가 주는 값을 그대로 쓴다. */
  id: string;
  name: string;
  dong: string;
  jibun: string;
  buildYear: number | null;
  count: number;
  medianAmount: number;
  medianUnitPrice: number;
  minAmount: number;
  maxAmount: number;
  /** 거래된 전용면적들. 지도에서 평형 필터를 걸 때 쓴다. */
  areas: number[];
  latestDate: string;
};

/**
 * 거래를 단지 단위로 묶는다. 지도의 마커 하나가 이 덩어리 하나다.
 *
 * 거래 하나하나를 점으로 찍으면 같은 자리에 수십 개가 겹쳐 아무것도 안 보인다.
 * 그렇다고 평균을 쓰면 가족 간 거래 한 건이 단지 전체를 끌어올리므로 중앙값을 쓴다.
 */
export function summarizeByComplex(deals: Deal[]): ComplexSummary[] {
  const groups = new Map<string, Deal[]>();
  for (const d of deals) {
    // 같은 이름이라도 동네가 다르면 다른 단지다. 이름만으로 묶으면 엉뚱한 곳이 섞인다.
    const id = `${d.dong}|${d.name}`;
    const list = groups.get(id);
    if (list) list.push(d);
    else groups.set(id, [d]);
  }

  return [...groups.entries()]
    .map(([id, list]) => {
      const amounts = list.map((d) => d.amount);
      return {
        id,
        name: list[0].name,
        dong: list[0].dong,
        jibun: list[0].jibun ?? '',
        buildYear: list[0].buildYear,
        count: list.length,
        medianAmount: median(amounts),
        medianUnitPrice: median(list.map((d) => d.unitPrice)),
        minAmount: Math.min(...amounts),
        maxAmount: Math.max(...amounts),
        areas: [...new Set(list.map((d) => Math.round(d.area)))].sort((a, b) => a - b),
        latestDate: list.reduce((a, b) => (a > b.date ? a : b.date), ''),
      };
    })
    .sort((a, b) => b.count - a.count);
}

/** 전용면적대로 거래를 거른다. 지도 숫자가 견줄 수 있는 값이 되려면 평형을 맞춰야 한다. */
export function filterByBand(deals: Deal[], bandKey: string | null): Deal[] {
  if (!bandKey || bandKey === 'all') return deals;
  return deals.filter((d) => bandOf(d.area).key === bandKey);
}
