import { formatKRW } from '@/lib/format';
import type { Combination } from '@/lib/calculators/parental-leave-optimizer';

/**
 * 6+6 조합의 월별 타임라인.
 * 누가 언제 쉬는지(띠)와 그 달에 얼마 받는지(표)를 같은 화면에서 본다.
 * 총액만 크게 보여주면 부부가 동시에 무급에 가까워지는 구간을 놓치기 때문이다.
 */
export function CoupleGantt({ combination }: { combination: Combination }) {
  const { me, spouse, cashflow } = combination;
  if (cashflow.length === 0) return null;

  const from = cashflow[0].childMonthAge;
  const to = cashflow[cashflow.length - 1].childMonthAge;
  const span = to - from + 1;

  const band = (start: number, months: number, tone: 'me' | 'partner') => {
    if (months === 0) {
      return <div className="h-7 rounded-[6px] border border-dashed border-line bg-sunk" />;
    }
    const left = ((start - from) / span) * 100;
    const width = (months / span) * 100;
    return (
      <div className="relative h-7 rounded-[6px] bg-sunk">
        <div
          className={
            'absolute top-0 flex h-7 items-center justify-center rounded-[6px] text-[11px] font-semibold text-white ' +
            (tone === 'me' ? 'bg-brand-strong' : 'bg-partner')
          }
          style={{ left: `${left}%`, width: `${width}%` }}
        >
          {months}개월
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
      <h2 className="text-[14px] font-semibold text-ink">누가 언제 쉬나요</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
        가로축은 아이의 월령이에요. 생후 {from}개월부터 {to}개월까지를 보여줍니다.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="flex w-14 shrink-0 items-center gap-1.5 text-[12px] font-medium text-ink-soft">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-brand-strong" />
            본인
          </span>
          <div className="flex-1">{band(me.startMonthAge, me.months, 'me')}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex w-14 shrink-0 items-center gap-1.5 text-[12px] font-medium text-ink-soft">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-partner" />
            배우자
          </span>
          <div className="flex-1">{band(spouse.startMonthAge, spouse.months, 'partner')}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0" />
          <div className="tnum flex flex-1 justify-between text-[10.5px] text-ink-faint">
            <span>생후 {from}개월</span>
            <span>{to}개월</span>
          </div>
        </div>
      </div>

      <div className="mt-4 -mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[380px] border-collapse text-[12.5px]">
          <caption className="sr-only">월별 수령액</caption>
          <thead>
            <tr className="border-b border-line text-left text-[11.5px] text-ink-faint">
              <th scope="col" className="py-1.5 font-medium">아이 월령</th>
              <th scope="col" className="py-1.5 text-right font-medium">본인</th>
              <th scope="col" className="py-1.5 text-right font-medium">배우자</th>
              <th scope="col" className="py-1.5 text-right font-medium">그 달 합계</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {cashflow.map((row) => (
              <tr
                key={row.childMonthAge}
                className={
                  'border-b border-line last:border-b-0 ' + (row.bothOnLeave ? 'bg-alert-soft' : '')
                }
              >
                <th scope="row" className="py-1.5 text-left font-normal text-ink-soft">
                  {row.childMonthAge}개월
                </th>
                <td className="py-1.5 text-right text-ink">
                  {row.me > 0 ? formatKRW(row.me) : '—'}
                </td>
                <td className="py-1.5 text-right text-ink">
                  {row.spouse > 0 ? formatKRW(row.spouse) : '—'}
                </td>
                <td className="py-1.5 text-right font-semibold text-ink">
                  {formatKRW(row.household)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {combination.leanestMonth && (
        <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">
          가장 얇은 달은 생후 {combination.leanestMonth.childMonthAge}개월로, 부부 합쳐{' '}
          <span className="tnum font-semibold text-ink">
            {formatKRW(combination.leanestMonth.household)}
          </span>
          이 들어옵니다.
          {combination.leanestMonth.bothOnLeave && ' 이 달은 두 사람 모두 휴직 중이라 급여 외 수입이 없어요.'}
        </p>
      )}
    </section>
  );
}
