import type { Metadata } from 'next';
import Link from 'next/link';
import { BackButton } from '@/components/ui/BackButton';
import { notFound } from 'next/navigation';
import { articlesOf } from '@/content/index';
import { EVENTS, TOOL_TYPE_LABEL, findEvent, toolsOf } from '@/lib/tools';
import { Icon } from '@/components/ui/Icon';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { AdSlot } from '@/components/analytics/AdSense';

export function generateStaticParams() {
  return EVENTS.filter((e) => e.status === 'live').map((e) => ({ event: e.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ event: string }>;
}): Promise<Metadata> {
  const { event } = await params;
  const found = findEvent(event);
  if (!found) return {};
  return {
    title: `${found.title} — 언제 뭘 해야 하는지 순서대로`,
    description: found.lead,
    alternates: { canonical: `/${found.key}` },
  };
}

export default async function EventHubPage({ params }: { params: Promise<{ event: string }> }) {
  const { event } = await params;
  const found = findEvent(event);
  if (!found || found.status !== 'live') notFound();

  const tools = toolsOf(found.key);
  const articles = articlesOf(found.key);

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 pb-16 pt-6">
      <BackButton fallbackHref="/" label="홈" />

      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-[24px] font-bold leading-snug tracking-[-0.015em] text-ink">
          <Icon name={found.icon} size={26} className="shrink-0 text-brand" />
          {found.title}
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">{found.lead}</p>
      </header>

      <ProfileBanner />

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-bold text-ink">시점별로 필요한 것</h2>
        <ol className="relative flex flex-col gap-3 border-l border-line pl-5">
          {tools.map((tool) => (
            <li key={tool.slug} className="relative">
              <span
                aria-hidden
                className="absolute -left-[26px] top-4 h-2.5 w-2.5 rounded-full border-2 border-ground bg-line-strong"
              />
              <p className="mb-1.5 text-[12px] font-semibold text-ink-faint">{tool.timing}</p>
              <Link
                href={`/${tool.event}/${tool.slug}`}
                className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-faint">
                    {TOOL_TYPE_LABEL[tool.type]}
                  </span>
                  <span className="text-[12px] text-ink-faint">{tool.title}</span>
                </div>
                <p className="text-[15px] font-semibold leading-snug text-ink">{tool.question}</p>
                <p className="text-[12.5px] leading-relaxed text-ink-soft">{tool.lead}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {articles.length > 0 && (
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-bold text-ink">읽을거리</h2>
          <Link href="/guide" className="shrink-0 text-[12.5px] font-medium text-brand-strong hover:underline">
            전체 보기
          </Link>
        </div>
        <ul className="flex flex-col gap-2">
          {articles.slice(0, 5).map((article) => (
            <li key={article.slug}>
              <Link
                href={`/guide/${article.slug}`}
                className="flex flex-col gap-1 rounded-[12px] border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
              >
                <span className="text-[14px] font-semibold leading-snug text-ink">
                  {article.question}
                </span>
                <span className="text-[12px] leading-relaxed text-ink-faint">{article.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      )}

      {found.tips && found.tips.length > 0 && (
        <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
          <h2 className="text-[14px] font-semibold text-ink">알아두면 덜 억울한 것</h2>
          <ul className="mt-2.5 flex flex-col gap-2.5 text-[13px] leading-relaxed text-ink-soft">
            {found.tips.map((tip) => (
              <li key={tip.title}>
                <strong className="font-semibold text-ink">{tip.title}</strong> {tip.body}
              </li>
            ))}
          </ul>
        </section>
      )}

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB} />
    </div>
  );
}
