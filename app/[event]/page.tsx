import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 pb-16 pt-6">
      <nav className="text-[12.5px] text-ink-faint">
        <Link href="/" className="hover:text-ink-soft">
          홈
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-[24px] font-bold leading-snug tracking-[-0.015em] text-ink">
          <Icon name={found.icon} size={26} className="shrink-0 text-brand" />
          {found.title}
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">
          {found.lead} 순서대로 하나씩 짚어드릴게요. 지금 해당하는 시점부터 보시면 됩니다.
        </p>
      </header>

      <ProfileBanner />

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-bold text-ink">시점별로 필요한 것</h2>
        <ol className="relative flex flex-col gap-3 border-l border-line pl-5">
          {tools.map((tool) => (
            <li key={tool.slug} className="relative">
              <span
                aria-hidden
                className={
                  'absolute -left-[26px] top-4 h-2.5 w-2.5 rounded-full border-2 border-ground ' +
                  (tool.featured ? 'bg-brand' : 'bg-line-strong')
                }
              />
              <p className="mb-1.5 text-[12px] font-semibold text-ink-faint">{tool.timing}</p>
              <Link
                href={`/${tool.event}/${tool.slug}`}
                className={
                  'flex flex-col gap-1.5 rounded-[12px] border px-4 py-3.5 transition-colors ' +
                  (tool.featured
                    ? 'border-brand bg-brand-soft hover:border-brand-strong'
                    : 'border-line bg-surface hover:border-line-strong')
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                      (tool.featured
                        ? 'bg-brand-strong text-white'
                        : 'border border-line bg-surface text-ink-faint')
                    }
                  >
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

      <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
        <h2 className="text-[14px] font-semibold text-ink">알아두면 덜 억울한 것</h2>
        <ul className="mt-2.5 flex flex-col gap-2.5 text-[13px] leading-relaxed text-ink-soft">
          <li>
            <strong className="font-semibold text-ink">사후지급금은 폐지됐어요.</strong> 예전에는
            급여의 25%를 복직 6개월 뒤에 줬지만, 지금은 휴직 중에 전액을 받습니다. 오래된 블로그 글에
            속지 마세요.
          </li>
          <li>
            <strong className="font-semibold text-ink">부모급여·아동수당은 60일이 전부예요.</strong>{' '}
            출생일 포함 60일 안에 신청해야 태어난 달까지 소급됩니다. 하루만 늦어도 그 전 달치는
            사라져요.
          </li>
          <li>
            <strong className="font-semibold text-ink">육아휴직은 30일 전에 신청해야 해요.</strong>{' '}
            시작 예정일 30일 전까지 회사에 알려야 합니다. 급여 신청과는 별개예요.
          </li>
          <li>
            <strong className="font-semibold text-ink">
              부부가 나눠 쓰면 상한액이 올라갑니다.
            </strong>{' '}
            생후 18개월 안에 둘 다 육아휴직을 쓰면 첫 6개월 상한이 매달 올라가요. 한 사람만 쓰면
            해당되지 않습니다.
          </li>
        </ul>
      </section>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB} />
    </div>
  );
}
