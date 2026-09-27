'use client';

import { useEffect, useState } from 'react';
import type { CardSplitValue } from '@/lib/calculators/card-split';
import { cardSplitVerdict } from '@/lib/calculators/card-split';
import { formatKRW, formatManwon } from '@/lib/format';

/**
 * 카드 배분 대시보드.
 *
 * 이 계산기의 답은 숫자 하나가 아니라 "누가, 어떤 카드로, 얼마를"이라는 배분표다.
 * 그걸 문장으로 늘어놓으면 네 줄이 되고 네 줄은 안 읽힌다. 그래서 한 해 생활비를
 * 막대 하나로 눕히고 네 조각으로 나눴다. 조각의 길이가 곧 금액이라 비율이 먼저
 * 눈에 들어오고, 정확한 금액은 바로 아래 범례에서 읽는다.
 *
 * 막대 안에는 글씨를 넣지 않는다. 조각이 좁아지면 글씨가 잘리는데, 잘린 금액은
 * 없느니만 못하다.
 */

type Segment = {
  key: string;
  label: string;
  amount: number;
  /** 막대 조각 색 */
  fill: string;
};

function segmentsOf(v: CardSplitValue): Segment[] {
  return [
    {
      key: 'ac',
      label: `${v.a.label} 신용카드`,
      amount: v.a.credit,
      fill: 'var(--color-split-credit-a)',
    },
    {
      key: 'ak',
      label: `${v.a.label} 체크카드`,
      amount: v.a.check,
      fill: 'var(--color-split-check-a)',
    },
    {
      key: 'bc',
      label: `${v.b.label} 신용카드`,
      amount: v.b.credit,
      fill: 'var(--color-split-credit-b)',
    },
    {
      key: 'bk',
      label: `${v.b.label} 체크카드`,
      amount: v.b.check,
      fill: 'var(--color-split-check-b)',
    },
  ].filter((s) => s.amount > 0);
}

/**
 * 조각 사이는 선이 아니라 2px 틈으로 가른다. 테두리를 두르면 조각마다 색이
 * 하나씩 더 늘어나서 막대가 시끄러워진다.
 */
function SplitBar({
  segments,
  total,
  height,
}: {
  segments: Segment[];
  total: number;
  height: number;
}) {
  if (total <= 0 || segments.length === 0) return null;
  return (
    <div
      className="flex w-full gap-[2px] overflow-hidden rounded-[4px]"
      style={{ height }}
      role="img"
      aria-label={segments.map((s) => `${s.label} ${formatManwon(s.amount)}`).join(', ')}
    >
      {segments.map((s) => (
        <div
          key={s.key}
          className="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
          style={{ width: `${(s.amount / total) * 100}%`, background: s.fill }}
        />
      ))}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex-1 rounded-[8px] bg-sunk px-3 py-2.5">
      <p className="text-[11.5px] font-medium text-ink-soft">{label}</p>
      <p className="tnum mt-0.5 text-[14.5px] font-bold leading-snug text-ink">{value}</p>
      {note && <p className="text-[11px] text-ink-faint">{note}</p>}
    </div>
  );
}

export function CardSplitDashboard({ v }: { v: CardSplitValue }) {
  const segments = segmentsOf(v);
  const total = v.a.spend + v.b.spend;
  const verdict = cardSplitVerdict(v);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[13px] font-medium text-ink-soft">이대로 쓰면 한 해에</p>
        <p className="tnum text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-brand">
          {formatKRW(Math.round(v.netBenefit))}
        </p>
      </div>

      <div className="rounded-[8px] bg-brand-soft px-3.5 py-3">
        <p className="text-[15px] font-bold leading-snug text-ink">{verdict.action}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{verdict.why}</p>
      </div>

      <div>
        <p className="text-[12.5px] text-ink-soft">
          한 해 카드 생활비{' '}
          <strong className="tnum font-semibold text-ink">{formatManwon(total)}</strong>을 이렇게
          나눕니다
        </p>
        <div className="mt-2">
          <SplitBar segments={segments} total={total} height={12} />
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: s.fill }}
              />
              <span className="shrink-0 text-[13px] text-ink">{s.label}</span>
              <span className="tnum ml-auto whitespace-nowrap text-[13px] font-semibold text-ink">
                {formatManwon(s.amount)}
                <span className="font-normal text-ink-faint">
                  {' '}
                  · 월 {formatManwon(s.amount / 12)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        <Tile label="줄어드는 세금" value={formatKRW(Math.round(v.taxSavedTotal))} />
        {v.mileValue > 0 && (
          <Tile
            label="마일리지"
            value={`${Math.round(v.miles).toLocaleString('ko-KR')}마일`}
            note={`${formatKRW(Math.round(v.mileValue))}어치`}
          />
        )}
        {v.annualFee > 0 && <Tile label="연회비" value={`−${formatKRW(v.annualFee)}`} />}
      </div>

      {/* 이미 그 방법을 쓰고 있으면 "0원 더 남습니다"가 되어 아무 말도 아니다. */}
      {Math.abs(v.vsAllOnOne) >= 10000 && (
        <p className="border-t border-line pt-3 text-[13px] leading-relaxed text-ink-soft">
          한 사람 신용카드로만 썼을 때보다{' '}
          <strong className="tnum font-semibold text-ink">
            {formatKRW(Math.abs(Math.round(v.vsAllOnOne)))}
          </strong>{' '}
          {v.vsAllOnOne >= 0 ? '더 남습니다' : '적습니다'}.
        </p>
      )}
    </div>
  );
}

/**
 * 대시보드가 화면 위로 사라지면 그때부터 상단에 붙는 요약 줄.
 *
 * 입력칸을 만지는 동안에도 "그래서 얼마를 어떤 카드로"가 계속 보여야 해서 둔다.
 * 처음부터 붙어 있으면 바로 위 대시보드와 같은 말을 두 번 하는 꼴이라,
 * 대시보드 끝에 표식을 하나 심어 두고 그게 헤더 밑으로 넘어갈 때만 띄운다.
 */
export function CardSplitStickyBar({
  v,
  sentinelRef,
}: {
  v: CardSplitValue;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [pinned, setPinned] = useState(false);
  const [headerH, setHeaderH] = useState(0);

  /* 헤더 높이는 글자 크기 설정에 따라 달라진다. 숫자로 박지 않고 재서 쓴다. */
  useEffect(() => {
    const measure = () => {
      const h = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
      setHeaderH(Math.round(h));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || headerH === 0) return;
    const io = new IntersectionObserver(([entry]) => setPinned(!entry.isIntersecting), {
      rootMargin: `-${headerH}px 0px 0px 0px`,
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelRef, headerH]);

  const segments = segmentsOf(v);
  const total = v.a.spend + v.b.spend;
  const people = [v.a, v.b].filter((p) => p.spend > 0);

  return (
    <div
      aria-hidden={!pinned}
      className={`fixed inset-x-0 z-[9] border-b border-line bg-surface transition-[opacity,transform] duration-150 ${
        pinned ? 'opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
      }`}
      style={{ top: headerH }}
    >
      <div className="mx-auto flex max-w-[680px] flex-col gap-1.5 px-4 pb-2 pt-2.5">
        <SplitBar segments={segments} total={total} height={4} />
        {people.map((p) => (
          <p key={p.label} className="flex items-baseline gap-2 text-[12.5px] leading-snug">
            <span className="w-[3.2em] shrink-0 font-semibold text-ink">{p.label}</span>
            <span className="tnum text-ink-soft">
              {p.credit > 0 && `신용 ${formatManwon(p.credit)}`}
              {p.credit > 0 && p.check > 0 && ' · '}
              {p.check > 0 && `체크 ${formatManwon(p.check)}`}
            </span>
            {p === people[0] && (
              <span className="tnum ml-auto shrink-0 font-bold text-brand">
                한 해 {formatManwon(v.netBenefit)}
              </span>
            )}
          </p>
        ))}
      </div>
    </div>
  );
}
