import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/content/index';
import { EVENTS, TOOLS } from '@/lib/tools';
import { SITE_URL } from '@/lib/site';
import { listDeadlines, statusOf } from '@/lib/calculators/deadlines';



export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    ...EVENTS.filter((e) => e.status === 'live').map((e) => ({
      url: `${SITE_URL}/${e.key}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    {
      url: `${SITE_URL}/guide`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    ...ARTICLES.map((a) => ({
      url: `${SITE_URL}/guide/${a.slug}`,
      lastModified: new Date(a.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // 소개·문의는 사이트가 뭐하는 곳인지 판단하는 데 쓰이므로 약관류보다 우선순위를 둔다
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    /*
      마감 캠페인은 날짜가 지나면 뺀다. 끝난 지원을 검색 결과에 남겨두면
      들어온 사람이 헛걸음한다. 살아 있는 동안은 우선순위를 높게 둔다.
    */
    ...listDeadlines()
      .map((d) => statusOf(d))
      .filter((s2) => !s2.passed)
      .map((s2) => ({
        url: `${SITE_URL}/deadline/${s2.deadline.slug}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.9,
      })),
    ...TOOLS.map((t) => ({
      url: `${SITE_URL}/${t.event}/${t.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
