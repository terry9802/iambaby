import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/content/index';
import { EVENTS, TOOLS } from '@/lib/tools';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nanaegi.kr';

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
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    ...TOOLS.map((t) => ({
      url: `${SITE_URL}/${t.event}/${t.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
