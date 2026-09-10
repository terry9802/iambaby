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
