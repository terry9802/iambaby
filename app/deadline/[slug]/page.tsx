import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, formatKRW } from '@/lib/format';
import { ogMeta } from '@/lib/site';
import { findDeadline, listDeadlines, shareTextFor, statusOf } from '@/lib/calculators/deadlines';
import { ShareButton } from '@/components/calculator/ShareButton';
import { BackButton } from '@/components/ui/BackButton';
import { PhoneCopy } from '@/components/ui/PhoneCopy';

export function generateStaticParams() {
  return listDeadlines().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = findDeadline(slug);
  if (!d) return {};
  const path = `/deadline/${d.slug}`;
  /*
    공유 카드에는 남은 날이 아니라 마감 날짜를 적는다. "D-7"은 하루만 지나도
    틀린 말이 되는데, 카카오톡·슬랙은 미리보기를 한참 캐시해 두기 때문이다.
  */
  const description = `${d.summary} ${formatDate(d.dueAt)}까지 신청하셔야 합니다.`;
  return {
    title: d.hook,
    description,
    alternates: { canonical: path },
    ...ogMeta({ path, title: d.hook, description, card: `deadline-${d.slug}` }),
  };
}

export default async function DeadlinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = findDeadline(slug);
  if (!found) notFound();

  const { deadline: d, dDay, passed } = statusOf(found);
  const shareText = shareTextFor(statusOf(found));

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-5 px-4 pb-16 pt-4">
      <BackButton fallbackHref={`/${d.event}`} label="출산 · 육아" />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand px-2.5 py-1 text-[11.5px] font-semibold text-white">
            {d.region}
          </span>
          {passed ? (
            <span className="rounded-full bg-danger-soft px-2.5 py-1 text-[11.5px] font-semibold text-danger">
              마감됐어요
            </span>
          ) : (
            <span className="tnum rounded-full bg-alert-soft px-2.5 py-1 text-[11.5px] font-semibold text-alert">
              {dDay === 0 ? '오늘 마감' : `${dDay}일 남음`}
            </span>
          )}
        </div>
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">{d.hook}</h1>
      </header>

      {/* 금액과 날짜. 이 페이지에 들어온 사람이 3초 안에 알아야 할 두 가지다. */}
      <section className="rounded-[12px] border border-line bg-surface px-4 py-5">
        <p className="text-[13px] font-semibold text-ink-soft">{d.name}</p>
        <p className="tnum mt-1.5 text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-brand">
          {formatKRW(d.amount)}
        </p>
        <p className="mt-1 text-[13.5px] text-ink-soft">{d.amountLabel}</p>
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[14.5px] leading-relaxed text-ink">
            신청 마감{' '}
            <strong className="font-bold text-ink">{formatDate(d.dueAt)}</strong>
            {!passed && (
              <>
                {' '}· 오늘부터 <span className="tnum font-bold text-alert">{dDay}일</span>
              </>
            )}
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{d.summary}</p>
        </div>
      </section>

      <section className="rounded-[12px] border border-alert/25 bg-alert-soft px-4 py-4">
        <h2 className="text-[13.5px] font-semibold text-alert">왜 지금이어야 하나</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{d.whyUrgent}</p>
      </section>

      {!passed && (
        <ShareButton
          query=""
          title={d.hook}
          text={shareText}
          heading="받을 사람에게 보내주세요"
          blurb="아래 문구와 이 페이지 주소가 함께 갑니다. 아는 분 중에 해당되는 사람이 있을 거예요."
          privacyNote={false}
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-[16px] font-bold text-ink">이런 분이 받습니다</h2>
        <ul className="flex flex-col gap-2">
          {d.who.map((line) => (
            <li key={line} className="flex gap-2 text-[14px] leading-relaxed text-ink">
              <span aria-hidden className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-ink-faint" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[16px] font-bold text-ink">어떻게 신청하나</h2>
        <ol className="flex flex-col gap-2">
          {d.howTo.map((line, i) => (
            <li key={line} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
              <span className="tnum mt-[1px] shrink-0 text-[13px] font-bold text-brand">{i + 1}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
        {!passed && (
          <a
            href={d.applyUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 rounded-[8px] bg-brand px-4 py-3 text-center text-[14.5px] font-bold text-white"
          >
            신청하러 가기
          </a>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[16px] font-bold text-ink">놓치기 쉬운 것</h2>
        <ul className="flex flex-col gap-2">
          {d.watchOut.map((line) => (
            <li key={line} className="flex gap-2 text-[13.5px] leading-relaxed text-ink-soft">
              <span aria-hidden className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-ink-faint" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <PhoneCopy
        label={d.consult.label}
        number={d.consult.number}
        note="예산 사정으로 마감일이 바뀌는 경우가 있습니다. 신청 전에 전화 한 통이면 확실해집니다."
      />

      <Link
        href={d.toolPath}
        className="rounded-[12px] border border-line bg-surface px-4 py-4 text-[14px] leading-relaxed text-ink"
      >
        <strong className="block text-[15px] font-bold text-ink">
          이것 말고 더 받을 건 없는지 보기
        </strong>
        <span className="mt-1 block text-[13.5px] text-ink-soft">
          정부 지원까지 모아 첫 1년에 얼마가 들어오는지, 각각 언제까지 신청해야 하는지 한 장으로
          보여드려요.
        </span>
      </Link>

      <p className="text-[12px] leading-relaxed text-ink-faint">
        {d.verifiedAt} 확인 · {d.verifiedBy}
      </p>
    </div>
  );
}
