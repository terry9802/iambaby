'use client';

import Link from 'next/link';
import { useCallback, useSyncExternalStore } from 'react';
import { EVENTS, TOOLS, TOOL_TYPE_LABEL } from '@/lib/tools';
import type { IconName } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';
import { getServerTab, getTab, setTab, subscribeTab } from '@/lib/ui/tab-store';

export type ArticleLink = {
  slug: string;
  event: string;
  question: string;
  title: string;
};

const SOON_KEY = 'soon';

type Tab = { key: string; title: string; icon?: IconName };

export function HomeTabs({ articles }: { articles: ArticleLink[] }) {
  const live = EVENTS.filter((e) => e.status === 'live');
  const soon = EVENTS.filter((e) => e.status === 'soon');

  const stored = useSyncExternalStore(subscribeTab, getTab, getServerTab);
  const tabs: Tab[] = [
    ...live.map((e) => ({ key: e.key as string, title: e.title, icon: e.icon })),
    { key: SOON_KEY, title: '준비 중' },
  ];
  const active = tabs.some((t) => t.key === stored) ? stored : live[0].key;

  /*
    스크롤바를 감췄으니, 고른 탭이 화면 밖에 있으면 아무것도 안 골라진 것처럼 보인다.
    고른 탭이 보이는 자리로만 살짝 밀어준다. block:'nearest'라서 페이지가 위아래로 튀지 않는다.
  */
  const revealSelected = useCallback((el: HTMLButtonElement | null) => {
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);

  const event = live.find((e) => e.key === active);
  const tools = TOOLS.filter((t) => t.event === active);
  const eventArticles = articles.filter((a) => a.event === active);

  return (
    <>
      <div
        role="tablist"
        aria-label="관심 있는 주제"
        /* 탭이 화면보다 길면 옆으로 밀어서 본다. 다만 스크롤바 줄은 보이지 않게 한다 —
           알약 모양 탭이 잘려 보이는 것 자체가 "옆에 더 있다"는 신호라 막대는 군더더기다. */
        className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5"
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              ref={selected ? revealSelected : undefined}
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(tab.key)}
              className={
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] transition-colors ' +
                (selected
                  ? 'border-brand-strong bg-brand-strong font-semibold text-white'
                  : 'border-line bg-surface text-ink-soft hover:border-line-strong')
              }
            >
              {tab.icon && <Icon name={tab.icon} size={16} />}
              {tab.title}
            </button>
          );
        })}
      </div>

      {event ? (
        <section role="tabpanel" className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-ink-soft">{event.lead}</p>

          <ul className="flex flex-col gap-2">
            {tools.map((tool) => (
              <li key={tool.slug}>
                <Link
                  href={`/${tool.event}/${tool.slug}`}
                  className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong"
                >
                  <span className="w-fit rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-ink-faint">
                    {TOOL_TYPE_LABEL[tool.type]}
                  </span>
                  <span className="text-[15px] font-semibold leading-snug text-ink">
                    {tool.question}
                  </span>
                  <span className="text-[12.5px] leading-relaxed text-ink-soft">{tool.lead}</span>
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href={`/${event.key}`}
            className="self-start text-[13px] font-medium text-brand-strong hover:underline"
          >
            {event.title} 전체 일정 보기
          </Link>

          {eventArticles.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[14px] font-bold text-ink">읽을거리</h2>
                <Link
                  href="/guide"
                  className="shrink-0 text-[12.5px] font-medium text-brand-strong hover:underline"
                >
                  전체 보기
                </Link>
              </div>
              <ul className="flex flex-col gap-2">
                {eventArticles.slice(0, 4).map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={`/guide/${article.slug}`}
                      className="flex flex-col gap-1 rounded-[12px] border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
                    >
                      <span className="text-[14px] font-semibold leading-snug text-ink">
                        {article.question}
                      </span>
                      <span className="text-[12px] leading-relaxed text-ink-faint">
                        {article.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section role="tabpanel" className="flex flex-col gap-3">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            하나를 제대로 만드는 편이 여러 개를 어중간하게 만드는 것보다 낫다고 생각해서, 순서대로
            하나씩 채우고 있습니다.
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {soon.map((item) => (
              <li
                key={item.key}
                className="flex flex-col gap-1 rounded-[12px] border border-dashed border-line bg-surface px-3.5 py-3"
              >
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft">
                  <Icon name={item.icon} size={17} className="shrink-0 text-ink-faint" />
                  {item.title}
                </span>
                <span className="text-[11.5px] leading-relaxed text-ink-faint">{item.lead}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
