import { NextResponse } from 'next/server';
import {
  fetchDeals,
  median,
  summarizeByBand,
  type Dataset,
  type Deal,
} from '@/lib/market/rtms';
import { findSigungu } from '@/lib/market/regions';

/**
 * 실거래가 조회 창구.
 *
 * 브라우저가 국토교통부에 직접 묻지 않고 여기를 거친다. 인증키가 화면에
 * 드러나지 않아야 하고, 여러 달치를 모아 계산하는 일도 서버가 한 번 해서
 * 캐시해 두는 편이 낫기 때문이다.
 *
 * 사용자의 현재 위치는 받지 않는다. 지역은 목록에서 고른 코드로만 온다.
 * 개인위치정보를 다루지 않으므로 위치기반서비스사업 신고 대상이 아니다.
 */

const DATASETS: Dataset[] = ['aptTrade', 'aptRent', 'offiTrade'];
const MAX_MONTHS = 12;

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const lawd = sp.get('lawd') ?? '';
  const dataset = (sp.get('dataset') ?? 'aptTrade') as Dataset;
  const months = Math.min(MAX_MONTHS, Math.max(1, Number(sp.get('months') ?? 6)));
  const complex = (sp.get('complex') ?? '').trim();

  const region = findSigungu(lawd);
  if (!region) {
    return NextResponse.json({ error: '아직 정리되지 않은 지역이에요.' }, { status: 400 });
  }
  if (!DATASETS.includes(dataset)) {
    return NextResponse.json({ error: '없는 조회 종류예요.' }, { status: 400 });
  }
  if (!process.env.DATA_GO_KR_KEY) {
    return NextResponse.json(
      { error: '실거래가 조회 준비가 아직 안 됐어요. 잠시 뒤에 다시 시도해 주세요.' },
      { status: 503 },
    );
  }

  const { deals: raw, monthsCovered, missingMonths } = await fetchDeals(dataset, lawd, months);

  /*
    전월세는 전세와 월세를 갈라야 한다. 월세 계약은 보증금이 작아서, 섞어서
    중앙값을 내면 "강남 아파트 보증금 중앙값 2억 5천"처럼 어느 쪽도 아닌 숫자가
    나온다. 면적대별 집계는 전세만으로 낸다.
  */
  const isRent = dataset === 'aptRent';
  const jeonse = raw.filter((d) => d.monthlyRent === 0);
  const wolse = raw.filter((d) => d.monthlyRent > 0);
  const deals = isRent ? jeonse : raw;

  // 단지 이름은 띄어쓰기가 제각각이라 공백을 지우고 견준다.
  const norm = (s: string) => s.replace(/\s+/g, '');
  const picked: Deal[] = complex
    ? deals.filter((d) => norm(d.name).includes(norm(complex)))
    : [];

  const body = {
    region: { code: region.code, name: region.name, sido: region.sidoName },
    dataset,
    months,
    monthsCovered,
    missingMonths,
    total: raw.length,
    byBand: summarizeByBand(deals),
    medianUnitPrice: median(deals.map((d) => d.unitPrice)),
    rent: isRent
      ? {
          jeonse: {
            count: jeonse.length,
            medianDeposit: median(jeonse.map((d) => d.amount)),
            medianUnitPrice: median(jeonse.map((d) => d.unitPrice)),
          },
          wolse: {
            count: wolse.length,
            medianDeposit: median(wolse.map((d) => d.amount)),
            medianMonthlyRent: median(wolse.map((d) => d.monthlyRent)),
          },
        }
      : null,
    // 이름을 찾았을 때만 단지별 내역을 보낸다. 통째로 내보낼 자료가 아니다.
    complex: complex
      ? {
          query: complex,
          count: picked.length,
          names: [...new Set(picked.map((d) => d.name))].slice(0, 10),
          medianUnitPrice: median(picked.map((d) => d.unitPrice)),
          recent: picked.slice(0, 20),
        }
      : null,
  };

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' },
  });
}
