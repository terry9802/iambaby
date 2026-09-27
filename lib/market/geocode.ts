import 'server-only';
import type { ComplexSummary } from './summary';

/**
 * 단지 주소를 좌표로 바꾼다.
 *
 * 실거래가 API는 좌표를 주지 않는다. 아파트 이름과 법정동, 지번만 준다.
 * 지도에 점을 찍으려면 그걸 위도·경도로 바꿔야 하고, 그 일을 카카오 로컬 API가 한다.
 *
 * 건물 좌표는 바뀌지 않으므로 오래 캐시한다. 한 번 구한 단지는 다시 묻지 않는다.
 */

const KAKAO = 'https://dapi.kakao.com/v2/local/search';
/** 건물은 움직이지 않는다. 30일쯤 쥐고 있어도 틀릴 일이 없다. */
const CACHE_SECONDS = 60 * 60 * 24 * 30;
/** 한 번에 너무 많이 부르면 카카오가 막는다. 열 개씩 끊어 보낸다. */
const CONCURRENCY = 10;

export type Geo = { lat: number; lng: number; matchedBy: 'address' | 'keyword' };

async function ask(path: string, query: string): Promise<unknown | null> {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${KAKAO}/${path}.json?query=${encodeURIComponent(query)}&size=1`, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: CACHE_SECONDS },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function firstPoint(body: unknown): { lat: number; lng: number } | null {
  const docs = (body as { documents?: { x?: string; y?: string }[] } | null)?.documents;
  const d = docs?.[0];
  if (!d?.x || !d?.y) return null;
  const lng = Number(d.x);
  const lat = Number(d.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * 지번 주소를 먼저 물어보고, 못 찾으면 단지 이름으로 다시 묻는다.
 *
 * 지번은 정확하지만 재개발로 번지가 바뀌거나 신축이라 아직 안 올라온 경우가 있다.
 * 그럴 때 "송파구 헬리오시티" 같은 이름 검색이 더 잘 듣는다.
 */
export async function geocodeComplex(
  sigunguName: string,
  complex: Pick<ComplexSummary, 'name' | 'dong' | 'jibun'>,
): Promise<Geo | null> {
  const city = sigunguName.split(' ')[0];

  if (complex.jibun) {
    const point = firstPoint(await ask('address', `${city} ${complex.dong} ${complex.jibun}`));
    if (point) return { ...point, matchedBy: 'address' };
  }

  const point = firstPoint(await ask('keyword', `${complex.dong} ${complex.name}`));
  if (point) return { ...point, matchedBy: 'keyword' };

  return null;
}

/** 여러 단지를 한꺼번에. 열 개씩 끊어 보내 카카오 쪽 부담을 줄인다. */
export async function geocodeAll<T extends Pick<ComplexSummary, 'id' | 'name' | 'dong' | 'jibun'>>(
  sigunguName: string,
  complexes: T[],
): Promise<Map<string, Geo>> {
  const found = new Map<string, Geo>();
  for (let i = 0; i < complexes.length; i += CONCURRENCY) {
    const slice = complexes.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((c) => geocodeComplex(sigunguName, c)));
    results.forEach((geo, j) => {
      if (geo) found.set(slice[j].id, geo);
    });
  }
  return found;
}
