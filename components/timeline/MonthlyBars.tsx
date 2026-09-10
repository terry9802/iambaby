import { formatKRW, formatManwon } from '@/lib/format';

export type BarRow = {
  label: string;
  amount: number;
  note?: string;
  emphasis?: boolean;
};

/** 월별 금액 막대. 색 대비가 아니라 길이로 차이를 읽게 한다. */
export function MonthlyBars({ rows, caption }: { rows: BarRow[]; caption?: string }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.amount), 1);

  return (
    <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
      <h2 className="text-[14px] font-semibold text-ink">달마다 받는 금액</h2>
      {caption && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{caption}</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((row, i) => (
          <li key={`${row.label}-${i}`} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] text-ink-soft">{row.label}</span>
              <span
                className={
                  'tnum text-[13px] ' +
                  (row.emphasis ? 'font-bold text-brand' : 'font-semibold text-ink')
                }
              >
                {formatKRW(row.amount)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-sunk">
              <div
                className={'h-full rounded-full ' + (row.emphasis ? 'bg-brand' : 'bg-line-strong')}
                style={{ width: `${Math.max(2, (row.amount / max) * 100)}%` }}
              />
            </div>
            {row.note && <p className="text-[11.5px] text-ink-faint">{row.note}</p>}
          </li>
        ))}
      </ul>
      <p className="tnum mt-3 border-t border-line pt-2.5 text-right text-[12.5px] text-ink-soft">
        합계 {formatManwon(rows.reduce((acc, r) => acc + r.amount, 0))}
      </p>
    </section>
  );
}
