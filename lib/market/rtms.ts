import 'server-only';

/**
 * 국토교통부 실거래가 공개시스템에서 거래를 받아 모은다.
 *
 * 이 파일이 답하지 않는 것이 하나 있다. **얼마가 적정가인가.**
 * 그건 조문도 고시도 없는 판단이라 이 사이트가 다룰 수 있는 문제가 아니다.
 * 여기서 만드는 것은 "실제로 이 가격들에 거래됐다"는 사실뿐이고, 비교도
 * 사실끼리만 한다. 싸다·비싸다는 말은 쓰지 않는다.
 *
 * 키는 서버에서만 쓴다. 'server-only'를 붙여 클라이언트 번들에 딸려
 * 들어가면 빌드가 실패하게 해 두었다.
 */

const BASE = 'https://apis.data.go.kr/1613000';

const ENDPOINTS = {
  aptTrade: { path: 'RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev', label: '아파트 매매' },
  aptRent: { path: 'RTMSDataSvcAptRent/getRTMSDataSvcAptRent', label: '아파트 전월세' },
  offiTrade: { path: 'RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade', label: '오피스텔 매매' },
} as const;

export type Dataset = keyof typeof ENDPOINTS;

import type { Deal } from './summary';

/** XML에서 같은 이름의 태그를 모두 꺼낸다. 의존성을 더하지 않으려고 정규식으로 읽는다. */
function tagsOf(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
function tagOf(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : '';
}
/** "627,000" → 6,270,000,000. 실거래가 API는 금액을 만원 단위로 준다. */
function manwonToWon(text: string): number {
  const n = Number(text.replace(/[^0-9-]/g, ''));
  return Number.isFinite(n) ? n * 10000 : 0;
}

async function fetchMonth(dataset: Dataset, lawdCd: string, ym: string): Promise<string | null> {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) return null;
  const url =
    `${BASE}/${ENDPOINTS[dataset].path}` +
    `?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}` +
    `&numOfRows=1000&pageNo=1`;

  // 공공데이터포털은 가끔 연결을 끊는다. 두어 번 더 해 보고 그래도 안 되면 그 달은 비운다.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        // 실거래가는 하루에 한 번꼴로 갱신된다. 매번 새로 받을 이유가 없다.
        next: { revalidate: 60 * 60 * 12 },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      if (tagOf(xml, 'resultCode') !== '000') continue;
      return xml;
    } catch {
      /* 다음 차례에 다시 해 본다 */
    }
  }
  return null;
}

function parseDeals(dataset: Dataset, xml: string): Deal[] {
  const out: Deal[] = [];
  for (const item of tagsOf(xml, 'item')) {
    // 계약이 해제된 거래는 실제로 일어나지 않은 거래다. 평균을 흐린다.
    if (tagOf(item, 'cdealType') === '해제') continue;

    const area = Number(tagOf(item, 'excluUseAr'));
    if (!Number.isFinite(area) || area <= 0) continue;

    const amount =
      dataset === 'aptRent'
        ? manwonToWon(tagOf(item, 'deposit'))
        : manwonToWon(tagOf(item, 'dealAmount'));
    if (amount <= 0) continue;

    const y = tagOf(item, 'dealYear');
    const mo = tagOf(item, 'dealMonth').padStart(2, '0');
    const d = tagOf(item, 'dealDay').padStart(2, '0');

    out.push({
      name: tagOf(item, 'aptNm') || tagOf(item, 'offiNm') || '이름 없음',
      area,
      floor: Number(tagOf(item, 'floor')) || null,
      buildYear: Number(tagOf(item, 'buildYear')) || null,
      dong: tagOf(item, 'umdNm'),
      amount,
      monthlyRent: dataset === 'aptRent' ? manwonToWon(tagOf(item, 'monthlyRent')) : 0,
      date: `${y}-${mo}-${d}`,
      unitPrice: Math.round(amount / area),
    });
  }
  return out;
}

/** 최근 몇 달치를 한꺼번에 받는다. 한 달만 보면 거래가 적은 동네는 표본이 너무 작다. */
export async function fetchDeals(
  dataset: Dataset,
  lawdCd: string,
  months: number,
  today = new Date(),
): Promise<{ deals: Deal[]; monthsCovered: string[]; missingMonths: string[] }> {
  const yms: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    yms.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const results = await Promise.all(yms.map((ym) => fetchMonth(dataset, lawdCd, ym)));
  const deals: Deal[] = [];
  const covered: string[] = [];
  const missing: string[] = [];
  results.forEach((xml, i) => {
    if (xml === null) {
      missing.push(yms[i]);
      return;
    }
    covered.push(yms[i]);
    deals.push(...parseDeals(dataset, xml));
  });

  deals.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { deals, monthsCovered: covered, missingMonths: missing };
}

export { median, summarizeByBand, bandOf, AREA_BANDS, type BandSummary } from './summary';
export type { Deal } from './summary';
export { ENDPOINTS };
