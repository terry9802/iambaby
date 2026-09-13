import { formatManwon } from '@/lib/format';
import { InlineText } from '@/components/ui/InlineText';
import type { PendingReformNotice } from '@/lib/calculators/pending-reforms';

/**
 * 예고된 제도 변화 안내.
 *
 * 계산 결과와 같은 무게로 보이면 안 된다. 확정된 숫자와 아직 아닌 숫자가 한 화면에
 * 섞이는 순간 이 사이트의 쓸모가 사라지기 때문이다. 그래서 결과 카드와 떨어진 자리에,
 * "아직 정해지지 않았다"를 맨 앞에 두고 보여준다.
 */
export function PendingReform({ notice }: { notice: PendingReformNotice | null }) {
  if (!notice) return null;

  return (
    <section className="rounded-[12px] border border-alert/25 bg-alert-soft px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-alert px-2 py-0.5 text-[11px] font-semibold text-white">
          아직 확정 아님
        </span>
        <h2 className="text-[13.5px] font-semibold text-alert">곧 이렇게 바뀔 수 있어요</h2>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
        {notice.decideNote} 그래서 위 계산에는 <strong className="font-semibold">넣지 않았습니다.</strong>{' '}
        지금 확정된 기준으로만 계산한 결과예요.
      </p>

      <ul className="mt-3.5 flex flex-col gap-3.5">
        {notice.items.map((item) => (
          <li key={item.id} className="rounded-[10px] border border-alert/20 bg-surface px-3.5 py-3.5">
            <p className="text-[13.5px] font-bold text-ink">{item.name}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{item.headline}</p>

            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {item.amounts.map((amount) => (
                <li
                  key={amount.label}
                  className="rounded-[6px] border border-line bg-sunk px-2 py-1 text-[12px] text-ink-soft"
                >
                  {amount.label}{' '}
                  <span className="tnum font-semibold text-ink">{formatManwon(amount.value)}</span>
                </li>
              ))}
            </ul>

            <p className="mt-2.5 border-t border-line pt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">적용 시점(정부안)</span> {item.appliesFromNote}
            </p>

            <ul className="mt-2 flex flex-col gap-1.5">
              {item.facts.map((fact, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                  <span
                    aria-hidden
                    className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-ink-faint"
                  />
                  <span>
                    <InlineText text={fact} />
                  </span>
                </li>
              ))}
            </ul>

            {item.watchOut && (
              <p className="mt-2.5 rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink">
                <InlineText text={item.watchOut} />
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
        출처: {notice.basis.source} · {notice.basis.verifiedAt} 확인.{' '}
        <a
          href={notice.basis.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-ink-soft"
        >
          원문 보기
        </a>
      </p>
    </section>
  );
}
