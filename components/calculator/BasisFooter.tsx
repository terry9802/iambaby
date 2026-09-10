import { isStale } from '@/lib/rules/loader';
import type { RuleMeta } from '@/lib/rules/types';

export function StaleBadge() {
  return (
    <span className="rounded-full bg-alert-soft px-2 py-0.5 text-[11px] font-semibold text-alert">
      기준값 확인 필요
    </span>
  );
}

export function hasStaleBasis(basis: RuleMeta[], now: Date = new Date()): boolean {
  return basis.some((meta) => isStale(meta, now));
}

/**
 * 근거 · 기준일 · 면책.
 * 숫자를 보여준 화면에는 예외 없이 이게 붙는다. 출처 없는 숫자는 이 사이트에서 값이 없다.
 */
export function BasisFooter({ basis }: { basis: RuleMeta[] }) {
  const now = new Date();
  return (
    <footer className="rounded-[12px] border border-line bg-sunk px-4 py-4">
      <h2 className="text-[13px] font-semibold text-ink">이 계산의 근거</h2>
      <ul className="mt-2.5 flex flex-col gap-3">
        {basis.map((meta) => (
          <li key={meta.ruleId} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium text-ink">{meta.title}</span>
              {isStale(meta, now) && <StaleBadge />}
            </div>
            <a
              href={meta.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[12.5px] leading-relaxed text-brand underline underline-offset-2"
            >
              {meta.source}
            </a>
            <p className="tnum text-[12px] text-ink-faint">
              적용 기준일 {meta.effectiveFrom}
              {meta.effectiveTo ? ` ~ ${meta.effectiveTo}` : ' 부터'} · 마지막 확인 {meta.verifiedAt}
              {meta.verifiedBy ? ` (${meta.verifiedBy})` : ''}
            </p>
            {meta.note && (
              <p className="text-[12.5px] leading-relaxed text-ink-soft">{meta.note}</p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-faint">
        이 결과는 참고용이며 실제 금액은 관할 기관의 산정에 따릅니다. 개별 사정에 따라 달라질 수
        있으니 신청 전에 고용센터·주민센터에 한 번 더 확인해 주세요.
      </p>
    </footer>
  );
}
