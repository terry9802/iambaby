import type { ReactNode } from 'react';
import { formatKRW } from '@/lib/format';

/**
 * 결과 첫 화면. 큰 숫자 하나와 그 숫자를 읽는 법.
 * 스크롤하지 않아도 이 영역만으로 답이 되어야 한다.
 */
export function ResultHeadline({
  label,
  value,
  valueText,
  sub,
  children,
}: {
  label: string;
  value?: number;
  /** 금액이 아닌 결과(날짜 등) */
  valueText?: string;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      {/* 한 화면에서 가장 큰 글씨. 숫자가 혼자 튀지 않게 26px로 잡는다. */}
      <p className="tnum text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-brand">
        {valueText ?? formatKRW(value ?? 0)}
      </p>
      {sub && <div className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{sub}</div>}
      {children}
    </div>
  );
}

export function ResultAside({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3.5 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-soft">
      {children}
    </div>
  );
}
