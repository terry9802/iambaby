'use client';

import { useMemo } from 'react';
import { formatKRW } from '@/lib/format';
import {
  averagePerActiveMonth,
  monthBuckets,
  monthLabel,
  monthSeries,
  totalsOf,
  type Bucket,
} from '@/lib/ledger/monthly';
import type { Entry } from '@/lib/ledger/schema';

/**
 * 얼마나 썼나를 한눈에 보는 자리.
 *
 * 코칭 카드(Coach)와 역할이 다르다. 저쪽은 "세금을 어떻게 줄이나"를 말하고,
 * 여기는 "내가 얼마 썼나"를 말한다. 숫자가 서로 다른 이유가 바로 그것이라,
 * 두 카드를 섞지 않고 이름도 다르게 붙인다. 한 카드에 담으면 같은 '쓴 돈'인데
 * 숫자가 둘이라 반드시 헷갈린다.
 *
 * 그림은 한 가지 색만 쓴다. 달은 서로 다른 '종류'가 아니라 같은 것의 시간 순
 * 나열이라, 달마다 색을 달리할 이유가 없다. 색을 쓰는 자리는 하나 — 고른 달이다.
 */

/** 막대가 실처럼 얇아지지 않는 한도. 폰 너비에서 12칸이 적당하다. */
const SPAN = 12;

/** 적은 금액도 눈에 보이게 하는 최소 높이(%). 0인 달은 아예 안 그린다. */
const MIN_BAR = 3;

export function SpendOverview({
  entries,
  today,
  selected,
  onSelect,
}: {
  entries: Entry[];
  today: string;
  /** 고른 달 (YYYY-MM). null이면 전체 */
  selected: string | null;
  onSelect: (month: string | null) => void;
}) {
  const series = useMemo(() => monthSeries(entries, today, SPAN), [entries, today]);
  const all = useMemo(() => totalsOf(entries), [entries]);
  const year = today.slice(0, 4);
  const thisMonth = today.slice(0, 7);

  const yearTotal = useMemo(
    () => totalsOf(entries.filter((e) => e.date.startsWith(year))).all,
    [entries, year],
  );
  const average = useMemo(() => averagePerActiveMonth(entries), [entries]);

  const now = series.find((b) => b.month === thisMonth);
  const prevIndex = series.findIndex((b) => b.month === thisMonth) - 1;
  const prev = prevIndex >= 0 ? series[prevIndex] : undefined;

  /*
    고른 달의 속내.

    그림에 보이는 열두 칸에서만 찾으면 안 된다. 목록 위 탭은 적어 두신 모든 달을
    늘어놓으므로, 재작년 달을 탭에서 고르면 그림 밖이라 설명이 안 바뀐다.
    그래서 전체 집계에서 찾고, 거기도 없으면(=한 줄도 없는 달) 0으로 만든다.
  */
  const picked = useMemo(() => {
    if (!selected) return undefined;
    const withYear = new Set(entries.map((e) => e.date.slice(0, 4))).size > 1;
    const found = monthBuckets(entries).find((b) => b.month === selected);
    return (
      found ?? {
        month: selected,
        label: monthLabel(selected, withYear),
        short: monthLabel(selected, false),
        all: 0,
        personal: 0,
        couple: 0,
        count: 0,
      }
    );
  }, [entries, selected]);
  const top = Math.max(...series.map((b) => b.all), 1);

  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 rounded-[12px] border border-line bg-surface px-5 py-5">
      <div>
        <h2 className="text-[15px] font-bold text-ink">얼마나 썼나</h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">
          적어 두신 모든 줄의 합이에요. 세금 계산에 들어가는 금액과는 다릅니다.
        </p>
      </div>

      {/* 맨 앞에 전체. 이 화면에 들어오는 첫 질문이 "다 해서 얼마야"다. */}
      <div className="rounded-[10px] bg-sunk px-4 py-3.5">
        <p className="text-[12.5px] font-medium text-ink-soft">전체 사용 금액</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <p className="tnum text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {formatKRW(all.all)}
          </p>
          <p className="tnum text-[12.5px] text-ink-faint">{all.count}건</p>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
          개인 생활비 <strong className="tnum font-semibold">{formatKRW(all.personal)}</strong> · 커플
          데이트비 <strong className="tnum font-semibold">{formatKRW(all.couple)}</strong>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Tile label={`${year}년`} value={yearTotal} note="올해 쓴 돈" />
        <Tile
          label="이번 달"
          value={now?.all ?? 0}
          note={monthNote(now, prev)}
          tone={deltaTone(now, prev)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-medium text-ink-soft">달마다 얼마 썼나</p>
          <p className="tnum text-[11px] text-ink-faint">최대 {formatKRW(top)}</p>
        </div>

        {/*
          맨 위 가는 선이 눈금이고, 바닥 선이 0이다. 선을 흐리게 두는 이유는
          읽어야 할 것이 막대 길이지 선이 아니기 때문이다.
        */}
        <div className="border-t border-line pt-1.5">
          <div className="flex items-end gap-[6px]" style={{ height: 92 }}>
            {series.map((b) => {
              const on = selected === b.month;
              const ratio = b.all / top;
              const height = b.all > 0 ? Math.max(MIN_BAR, ratio * 100) : 0;
              return (
                <button
                  key={b.month}
                  type="button"
                  onClick={() => onSelect(on ? null : b.month)}
                  aria-pressed={on}
                  aria-label={`${b.label} ${formatKRW(b.all)}, ${b.count}건`}
                  title={`${b.label} · ${formatKRW(b.all)} · ${b.count}건`}
                  className="flex h-full flex-1 items-end rounded-t-[4px] focus-visible:outline-2"
                >
                  {/*
                    안 쓴 달도 바닥에 얇은 자국을 남긴다. 아무것도 안 그리면
                    '0원인 달'과 '그림에 없는 달'이 똑같이 보이고, 누를 자리가
                    있다는 것도 알 수 없다.
                  */}
                  <span
                    className={
                      'block w-full rounded-t-[4px] transition-colors ' +
                      (b.all === 0
                        ? on
                          ? 'bg-brand'
                          : 'bg-line'
                        : on || !selected
                          ? 'bg-brand'
                          : 'bg-line-strong')
                    }
                    style={b.all === 0 ? { height: 2 } : { height: `${height}%` }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex gap-[6px] border-t border-line pt-1">
            {series.map((b) => (
              <span
                key={b.month}
                className={
                  'tnum flex-1 text-center text-[10.5px] ' +
                  (selected === b.month ? 'font-bold text-brand' : 'text-ink-faint')
                }
              >
                {b.short}
              </span>
            ))}
          </div>
        </div>

        {/*
          고른 달의 속내는 떠 있는 말풍선 대신 여기 적는다. 폰에서는 손가락이
          막대를 가려서 말풍선이 안 보인다.
        */}
        <p className="rounded-[8px] bg-sunk px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-soft">
          {picked ? (
            picked.count === 0 ? (
              <>
                <strong className="font-semibold text-ink">{picked.label}</strong>에는 적어 두신 게
                없어요. 다른 막대를 누르거나, 한 번 더 누르면 전체로 돌아갑니다.
              </>
            ) : (
              <>
                <strong className="font-semibold text-ink">{picked.label}</strong>에{' '}
                <strong className="tnum font-semibold text-ink">{formatKRW(picked.all)}</strong>{' '}
                쓰셨어요. 개인 <span className="tnum">{formatKRW(picked.personal)}</span> · 커플{' '}
                <span className="tnum">{formatKRW(picked.couple)}</span> · {picked.count}건. 아래
                목록도 이 달만 보여 줍니다.
              </>
            )
          ) : (
            <>
              막대를 누르면 그 달만 볼 수 있어요. 돈 쓰신 달로만 따지면 한 달에 평균{' '}
              <strong className="tnum font-semibold text-ink">{formatKRW(average)}</strong> 쓰셨습니다.
            </>
          )}
        </p>
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div className="rounded-[10px] border border-line px-3.5 py-3">
      <p className="text-[12px] font-medium text-ink-soft">{label}</p>
      <p className="tnum mt-0.5 text-[17px] font-bold leading-tight tracking-[-0.01em] text-ink">
        {formatKRW(value)}
      </p>
      <p
        className={
          'mt-0.5 text-[11.5px] leading-snug ' +
          (tone === 'up' ? 'text-alert' : tone === 'down' ? 'text-good' : 'text-ink-faint')
        }
      >
        {note}
      </p>
    </div>
  );
}

/**
 * 지난달과 견준 말.
 *
 * 지난달이 0이면 비율을 못 낸다. 0으로 나누면 무한대가 나오고, 화면에는
 * "∞% 늘었어요"가 찍힌다. 그래서 그 경우는 비율을 말하지 않는다.
 */
function monthNote(now?: Bucket, prev?: Bucket): string {
  if (!now || now.all === 0) {
    return prev && prev.all > 0 ? '이번 달은 아직 적은 게 없어요' : '아직 적은 게 없어요';
  }
  if (!prev || prev.all === 0) return '지난달엔 적은 게 없어요';
  const diff = now.all - prev.all;
  if (diff === 0) return '지난달과 같아요';
  const pct = Math.round((Math.abs(diff) / prev.all) * 100);
  return `지난달보다 ${pct}% ${diff > 0 ? '더' : '덜'} 쓰셨어요`;
}

function deltaTone(now?: Bucket, prev?: Bucket): 'up' | 'down' | undefined {
  if (!now || !prev || now.all === 0 || prev.all === 0) return undefined;
  if (now.all === prev.all) return undefined;
  return now.all > prev.all ? 'up' : 'down';
}
