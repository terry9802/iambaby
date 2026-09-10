import type { CalcStep } from '@/lib/rules/types';
import { formatKRW, formatManwon } from '@/lib/format';

function renderValue(step: CalcStep): string {
  switch (step.unit) {
    case 'MONTH':
      return `${step.result}개월`;
    case 'DAY':
      return `${step.result.toLocaleString('ko-KR')}일`;
    case 'COUNT':
      return `${step.result.toLocaleString('ko-KR')}가지`;
    case 'RATIO':
      return `${Math.round(step.result * 100)}%`;
    default:
      return formatKRW(step.result);
  }
}

function StepRow({ step, depth = 0 }: { step: CalcStep; depth?: number }) {
  const isMoney = step.unit === undefined || step.unit === 'KRW';
  return (
    <li className={depth === 0 ? 'border-b border-line last:border-b-0' : ''}>
      <div className={depth === 0 ? 'flex flex-col gap-1 py-3' : 'flex flex-col gap-0.5 py-1.5'}>
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={
              depth === 0
                ? 'text-[14px] font-semibold text-ink'
                : 'text-[13px] text-ink-soft'
            }
          >
            {step.label}
          </span>
          <span
            className={
              depth === 0
                ? 'tnum shrink-0 text-[15px] font-semibold text-ink'
                : 'tnum shrink-0 text-[13px] text-ink-soft'
            }
          >
            {renderValue(step)}
          </span>
        </div>
        {step.formula && (
          <p className="tnum text-[12.5px] leading-relaxed text-ink-faint">{step.formula}</p>
        )}
        {step.note && (
          <p className="text-[12.5px] leading-relaxed text-ink-soft">{step.note}</p>
        )}
        {isMoney && depth === 0 && step.result >= 10000 && (
          <p className="tnum text-[12px] text-ink-faint">= {formatManwon(step.result)}</p>
        )}
      </div>

      {step.children && step.children.length > 0 && (
        <details className="mb-3 rounded-[8px] border border-line bg-sunk px-3">
          <summary className="py-2 text-[12.5px] font-medium text-brand-strong">
            달마다 얼마인지 보기 ({step.children.length}개월)
          </summary>
          <ul className="border-t border-line pb-2 pt-1">
            {step.children.map((child, i) => (
              <StepRow key={`${child.label}-${i}`} step={child} depth={depth + 1} />
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/**
 * 계산 과정 렌더러.
 * 결과만 보고 싶은 사람에게는 접혀 있고, "왜 이 숫자인가"를 물을 사람에게는 전부 펼쳐진다.
 */
export function StepBreakdown({ steps }: { steps: CalcStep[] }) {
  if (steps.length === 0) return null;
  return (
    <details className="rounded-[12px] border border-line bg-surface">
      <summary className="flex items-center justify-between px-4 py-3.5 text-[14px] font-semibold text-ink">
        이 숫자가 나온 과정
        <span className="text-[12.5px] font-normal text-brand-strong">펼쳐 보기</span>
      </summary>
      <ul className="border-t border-line px-4">
        {steps.map((step, i) => (
          <StepRow key={`${step.label}-${i}`} step={step} />
        ))}
      </ul>
    </details>
  );
}
