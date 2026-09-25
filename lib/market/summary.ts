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

