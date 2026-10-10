'use client';

import Link from 'next/link';
import { formatKRW } from '@/lib/format';
import { Money } from '@/components/ui/Money';
import type { summarizeLedger } from '@/lib/calculators/ledger-summary';
import type { Totals } from '@/lib/ledger/monthly';

/**
 * 맨 위 요약 한 장.
 *
 * 들어오자마자 보셔야 할 것은 셋이다. 다 해서 얼마 썼나, 세금이 얼마나 줄었나,
 * 지금 어떤 카드를 꺼내야 하나. 전에는 이 셋이 카드 두 장에 흩어져 있어서
 * 아래 탭까지 한참 내려가야 했다.
 *
 * 이 카드는 탭을 타지 않는다. 늘 전체를 센다. 탭은 이 아래에 있고, 거기부터
 * 갈라진다. 맨 위에서까지 숫자가 바뀌면 "지금 보고 있는 게 전체인가 개인인가"를
 * 늘 되짚어야 한다.
 */
export function TopSummary({
  totals,
  summary,
  year,
  hasSalary,
}: {
  totals: Totals;
  summary: ReturnType<typeof summarizeLedger> | null;
  year: string;
  hasSalary: boolean;
}) {
  /*
    두 숫자를 같은 크기로 맞춘다. 나란히 앉아 있는데 한쪽만 크면 그쪽이 더
    중요한 숫자처럼 읽힌다. 둘 중 긴 쪽에 맞춰 둘 다 줄인다.
  */
  const taxSaved = summary ? Math.round(summary.totalTaxSaved) : 0;
  const pair = [totals.all, taxSaved];

  /* 많이 쓰는 사람을 앞에 둔다. 적게 쓰는 사람 얘기가 먼저 나오면 헷갈린다. */
  const people = summary ? [...summary.holders].sort((a, b) => b.spent - a.spent) : [];

  return (
    <section className="flex flex-col gap-4 rounded-[12px] border border-line-strong bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(20,22,26,0.04)]">
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[12px] font-medium text-ink-soft">전체 사용 금액</p>
          <div className="mt-0.5">
            <Money value={totals.all} size="hero" fitTo={pair} />
          </div>
          <p className="tnum mt-0.5 text-[11.5px] text-ink-faint">{totals.count}건</p>
        </div>
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[12px] font-medium text-ink-soft">
            {year}년 돌려받을 세금
          </p>
          {summary && hasSalary ? (
            <>
              <div className="mt-0.5">
                <Money value={taxSaved} size="hero" tone="brand" fitTo={pair} />
              </div>
              <p className="tnum mt-0.5 text-[11.5px] text-ink-faint">
                올해 {summary.entryCount}건으로 셈
              </p>
            </>
          ) : (
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
              <Link href="/me" className="font-semibold text-brand-strong underline underline-offset-2">
                연봉을 적어주시면
              </Link>{' '}
              세어 드려요
            </p>
          )}
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-soft">
        개인 지출 <strong className="tnum font-semibold text-ink">{formatKRW(totals.personal)}</strong>{' '}
        · 그룹 지출{' '}
        <strong className="tnum font-semibold text-ink">{formatKRW(totals.couple)}</strong>
      </p>

      {/*
        지금 꺼낼 카드가 이 화면에서 제일 중요하다. 사장님이 그렇게 말씀하셨고,
        실제로 매일 바뀌는 건 이것뿐이다. 그래서 요약 카드 안에서도 제일 크다.
      */}
      {people.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-line pt-3.5">
          <p className="text-[13px] font-medium text-ink-soft">지금 쓰면 좋은 카드</p>
          {people.map((h) => (
            <div key={h.holder} className="rounded-[10px] bg-brand-soft px-4 py-3">
              {people.length > 1 && (
                <p className="text-[12px] font-semibold text-ink-soft">{h.label}</p>
              )}
              <p className="text-[20px] font-bold leading-tight tracking-[-0.02em] text-brand">
                {h.nowUse === 'credit' ? '신용카드' : '체크카드 · 현금영수증'}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink">{h.nowWhy}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
