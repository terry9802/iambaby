import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTICLES, findArticle } from '@/content/index';
import { readingMinutes } from '@/lib/content/types';
import { ruleMetaOf } from '@/lib/rules/loader';
import { ogMeta } from '@/lib/site';
import { toISODate } from '@/lib/format';
import { ArticleBody } from '@/components/content/ArticleBody';
import { BasisFooter } from '@/components/calculator/BasisFooter';
import { AdSlot } from '@/components/analytics/AdSense';
import { BackButton } from '@/components/ui/BackButton';
import { SITE_NAME, SITE_URL } from '@/lib/site';



export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    alternates: { canonical: `/guide/${article.slug}` },
    ...ogMeta({
      path: `/guide/${article.slug}`,
      title: article.question,
      description: article.description,
      card: article.event,
      type: 'article',
      extra: { publishedTime: article.publishedAt, modifiedTime: article.updatedAt },
    }),
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) notFound();

  const today = toISODate(new Date());
  const basis = article.basisRuleIds.map((id) => ruleMetaOf(id, today));
  const others = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: 'ko-KR',
    mainEntityOfPage: `${SITE_URL}/guide/${article.slug}`,
    publisher: { '@type': 'Organization', name: SITE_NAME },
  };

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-5 px-4 pb-16 pt-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <BackButton fallbackHref="/guide" label="읽을거리" />

      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-bold leading-snug tracking-[-0.015em] text-ink">
          {article.question}
        </h1>
        <p className="tnum text-[12px] text-ink-faint">
          {readingMinutes(article)}분 읽기 · 기준값 {article.updatedAt} 확인
        </p>
      </header>

      <article>
        <ArticleBody blocks={article.blocks} />
      </article>

      <BasisFooter basis={basis} />

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-bold text-ink">이런 것도 궁금하실 거예요</h2>
        <ul className="flex flex-col gap-2">
          {others.map((other) => (
            <li key={other.slug}>
              <Link
                href={`/guide/${other.slug}`}
                className="flex flex-col gap-1 rounded-[12px] border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
              >
                <span className="text-[14px] font-semibold leading-snug text-ink">
                  {other.question}
                </span>
                <span className="text-[12px] leading-relaxed text-ink-faint">{other.title}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/guide" className="text-[13px] font-medium text-brand-strong hover:underline">
          읽을거리 전체 보기
        </Link>
      </section>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE} />
    </div>
  );
}
