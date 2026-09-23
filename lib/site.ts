/**
 * 사이트의 정식 주소.
 *
 * 이 값이 틀리면 sitemap과 canonical이 통째로 엉뚱한 곳을 가리켜서 검색에 안 잡힌다.
 * 그래서 환경변수를 깜빡해도 맞도록 진짜 도메인을 기본값으로 박아 둔다.
 * (배포 주소를 자동으로 따라가게 뒀더니 도메인을 산 뒤에도 옛 주소를 가리켰다.)
 *
 * www는 쓰지 않는다. 같은 내용이 두 주소로 잡히면 검색에서 손해라 하나만 정식으로 둔다.
 */
const CANONICAL_ORIGIN = 'https://iamstillbaby.com';

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  // 내 컴퓨터에서 띄웠을 때만 localhost. Vercel 위에서는 늘 정식 주소를 쓴다.
  if (!process.env.VERCEL) return 'http://localhost:3000';

  return CANONICAL_ORIGIN;
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = '난아직애긴데세상이너무어려워요';

/**
 * 공유 링크에 붙는 대표 이미지.
 * 카카오톡·슬랙 같은 데서 미리보기로 보이는 그 그림이다.
 * scripts/make-og.mjs 로 미리 구워 public/og 에 둔다 — 수집기는 느린 응답을 기다려 주지 않는다.
 */
const OG_CARDS: Record<string, string> = {
  childcare: '출산 · 육아 계산기',
  marriage: '내 결혼 계산기',
  jobchange: '이직 계산기',
  retirement: '퇴직 계산기',
  socialdues: '남의 경조사 계산기',
  rest: '잘 쉬는 법 — 쉼 지원 조회',
  inheritance: '상속 · 증여 계산기',
  guide: '읽을거리',
};

/**
 * 공유 미리보기에 필요한 한 벌.
 *
 * 카카오톡은 og:title, og:description, og:image, **og:url** 네 개를 모두 봐야 카드를 만든다.
 * 페이지마다 openGraph를 따로 쓰면 루트에 적어둔 url·type·siteName이 통째로 덮여 사라지므로,
 * 여기서 한 번에 만들어 쓴다. 새 페이지를 추가할 때도 이 함수만 부르면 빠지는 게 없다.
 */
export function ogMeta({
  path,
  title,
  description,
  card,
  type = 'website',
  extra,
}: {
  /** '/childcare/leave-timeline' 처럼 앞에 슬래시가 붙은 경로 */
  path: string;
  title: string;
  description: string;
  /** 대표 이미지 종류. 이벤트 키나 'guide' */
  card?: string;
  type?: 'website' | 'article';
  extra?: Record<string, unknown>;
}) {
  const image = ogImage(card);
  return {
    openGraph: {
      type,
      locale: 'ko_KR',
      siteName: SITE_NAME,
      url: `${SITE_URL}${path}`,
      title,
      description,
      images: [image],
      ...extra,
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [image.url],
    },
  };
}

export function ogImage(key?: string) {
  /*
    마감 캠페인 카드는 사업이 생길 때마다 늘어난다. 여기 목록에 하나씩 적어두면
    빼먹기 쉬우므로 접두사로 알아본다. 그림 파일 이름과 키가 같다.
  */
  if (key?.startsWith('deadline-')) {
    return {
      url: `/og/${key}.png`,
      width: 1200,
      height: 630,
      alt: `${SITE_NAME} — 곧 마감되는 지원금 안내`,
    };
  }
  const name = key && key in OG_CARDS ? key : 'default';
  // 이 글은 화면을 못 보는 사람이 읽는 자리다. 내부에서 쓰는 키를 그대로 내보내지 않는다.
  const what = OG_CARDS[name] ?? '처음 겪는 일 앞에서 필요한 계산';
  return {
    url: `/og/${name}.png`,
    width: 1200,
    height: 630,
    alt: `${SITE_NAME} — ${what}`,
  };
}
