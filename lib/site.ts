/**
 * 사이트의 정식 주소.
 *
 * 이 값이 틀리면 sitemap과 canonical이 통째로 엉뚱한 곳을 가리켜서 검색에 안 잡힌다.
 * 도메인을 사기 전에도 최소한 실제로 열리는 주소를 가리켜야 하므로,
 * 환경변수가 없으면 Vercel이 알려주는 배포 주소로 대신한다.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = '난아직애긴데세상이너무어려워요';

/**
 * 공유 링크에 붙는 대표 이미지.
 * 카카오톡·슬랙 같은 데서 미리보기로 보이는 그 그림이다.
 * scripts/make-og.mjs 로 미리 구워 public/og 에 둔다 — 수집기는 느린 응답을 기다려 주지 않는다.
 */
const OG_CARDS = new Set(['childcare', 'marriage', 'jobchange', 'retirement', 'socialdues', 'guide']);

export function ogImage(key?: string) {
  const name = key && OG_CARDS.has(key) ? key : 'default';
  return {
    url: `/og/${name}.png`,
    width: 1200,
    height: 630,
    alt: `${SITE_NAME} — ${name === 'default' ? '처음 겪는 일 앞에서 필요한 계산' : name}`,
  };
}
