import { SITE_NAME, SITE_URL } from '@/lib/site';

/**
 * 검색엔진이 읽는 구조화 데이터.
 *
 * 화면에는 보이지 않지만, 이 사이트가 무엇이고 글이 언제 쓰였는지를 기계가 읽을 수 있게 한다.
 * 색인이 잘 되면 검색에서 찾아지고, 내용이 있는 사이트라는 신호도 된다.
 */
function Ld({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // 여기 들어가는 값은 전부 우리가 만든 문자열이라 사용자 입력이 섞이지 않는다.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export function SiteJsonLd() {
  return (
    <Ld
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        alternateName: '난아직애기',
        url: SITE_URL,
        inLanguage: 'ko-KR',
        description:
          '출산·육아, 결혼, 이직, 퇴직처럼 처음 겪는 일에 필요한 계산을 모았습니다. 계산 과정과 근거 조문, 확인한 날짜까지 함께 보여드립니다.',
      }}
    />
  );
}

export function ArticleJsonLd({
  slug,
  headline,
  description,
  publishedAt,
  updatedAt,
  image,
}: {
  slug: string;
  headline: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  image: string;
}) {
  return (
    <Ld
      data={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline,
        description,
        datePublished: publishedAt,
        dateModified: updatedAt,
        inLanguage: 'ko-KR',
        image: `${SITE_URL}${image}`,
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/guide/${slug}` },
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      }}
    />
  );
}
