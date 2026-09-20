import type { Metadata } from 'next';
import Link from 'next/link';
import { BackButton } from '@/components/ui/BackButton';
import { ARTICLES } from '@/content/index';
import { readingMinutes } from '@/lib/content/types';
import { ogMeta } from '@/lib/site';
import { AdSlot } from '@/components/analytics/AdSense';

export const metadata: Metadata = {
  title: '읽을거리 — 출산·육아 제도, 용어부터 차근차근',
  description:
    '육아휴직 급여, 6+6 부모육아휴직제, 출산전후휴가, 지원금 신청 기한까지. 용어를 모르는 상태에서 읽어도 되도록 쓴 설명 글 모음입니다.',
  alternates: { canonical: '/guide' },
  ...ogMeta({
    path: '/guide',
    title: '읽을거리 — 숫자만 던지지 않고, 왜 그 숫자인지까지',
    description: '숫자만 던지지 않고, 왜 그 숫자인지까지 적었습니다.',
    card: 'guide',
  }),
};

export default function GuideIndexPage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-5 px-4 pb-16 pt-6">
      <BackButton fallbackHref="/" label="홈" />

      <header className="flex flex-col gap-2">
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
          읽을거리
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">
          계산기가 &lsquo;얼마&rsquo;를 답한다면, 이 글들은 &lsquo;왜&rsquo;와 &lsquo;언제&rsquo;를
          답합니다. 용어를 하나도 모르는 상태에서 읽어도 되도록 썼어요.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {ARTICLES.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/guide/${article.slug}`}
              className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong"
            >
              <span className="text-[15px] font-semibold leading-snug text-ink">
                {article.question}
              </span>
              <span className="text-[12.5px] leading-relaxed text-ink-soft">
                {article.description}
              </span>
              <span className="tnum text-[11.5px] text-ink-faint">
                {readingMinutes(article)}분 읽기 · {article.updatedAt} 확인
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDE} />
    </div>
  );
}
