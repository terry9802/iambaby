import Link from 'next/link';
import { EVENTS, TOOLS, TOOL_TYPE_LABEL } from '@/lib/tools';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { AdSlot } from '@/components/analytics/AdSense';

export default function HomePage() {
  const live = EVENTS.filter((e) => e.status === 'live');
  const soon = EVENTS.filter((e) => e.status === 'soon');

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 pb-16 pt-6">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[26px] font-bold leading-snug tracking-[-0.015em] text-ink">
          몰라도 괜찮아요.
          <br />
          뭘 모르는지 몰라도 괜찮아요.
        </h1>
        <p className="text-[14.5px] leading-relaxed text-ink-soft">
          결혼, 출산, 내 집 마련처럼 처음 겪는 일 앞에서 필요한 계산과 정보를 한곳에 모읍니다.
          숫자만 던지지 않고 어떻게 나온 숫자인지, 어느 조문에 근거한 건지 함께 보여드려요.
        </p>
      </header>

      <ProfileBanner />

      {live.map((event) => (
        <section key={event.key} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-bold text-ink">
              <span aria-hidden className="mr-1.5">
                {event.emoji}
              </span>
              {event.title}
            </h2>
            <Link
              href={`/${event.key}`}
              className="shrink-0 text-[12.5px] font-medium text-brand hover:underline"
            >
              전체 일정 보기
            </Link>
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">{event.lead}</p>

          <ul className="flex flex-col gap-2">
            {TOOLS.filter((t) => t.event === event.key).map((tool) => (
              <li key={tool.slug}>
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
                          ? 'bg-brand text-white'
                          : 'border border-line bg-surface text-ink-faint')
                      }
                    >
                      {TOOL_TYPE_LABEL[tool.type]}
                    </span>
                    {tool.featured && (
                      <span className="text-[11px] font-semibold text-brand">
                        여기에만 있는 기능
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] font-semibold leading-snug text-ink">{tool.question}</p>
                  <p className="text-[12.5px] leading-relaxed text-ink-soft">{tool.lead}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-bold text-ink">준비 중인 이벤트</h2>
        <ul className="grid grid-cols-2 gap-2">
          {soon.map((event) => (
            <li
              key={event.key}
              className="flex flex-col gap-1 rounded-[12px] border border-dashed border-line bg-surface px-3.5 py-3"
            >
              <span className="text-[13.5px] font-semibold text-ink-soft">
                <span aria-hidden className="mr-1.5">
                  {event.emoji}
                </span>
                {event.title}
              </span>
              <span className="text-[11.5px] leading-relaxed text-ink-faint">{event.lead}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12.5px] leading-relaxed text-ink-faint">
          하나를 제대로 만드는 편이 여섯 개를 어중간하게 만드는 것보다 낫다고 생각해서, 출산·육아부터
          끝까지 파고 있습니다.
        </p>
      </section>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} />
    </div>
  );
}
