'use client';

import type { ReactNode } from 'react';
import type { CalcOutcome } from '@/lib/rules/types';
import { TOOL_TYPE_LABEL, findEvent, type Tool } from '@/lib/tools';
import { BackButton } from '@/components/ui/BackButton';
import { BasisFooter, StaleBadge, hasStaleBasis } from './BasisFooter';
import { Callout } from './Callout';
import { ShareButton } from './ShareButton';
import { StepBreakdown } from './StepBreakdown';

/**
 * 계산기 공통 껍데기.
 * 결과가 맨 위에 있고 과정은 접혀 있다. 값이 모자라면 에러 대신 무엇이 모자란지 그 자리에 적는다.
 */
export function CalcShell<T>({
  tool,
  outcome,
  form,
  headline,
  detail,
  exampleFields,
  shareQuery,
  shareText,
  fromSharedLink,
  extra,
}: {
  tool: Tool;
  outcome: CalcOutcome<T>;
  /** 입력 폼 */
  form: ReactNode;
  /** 결과 첫 화면 — 큰 숫자 하나와 그것을 읽는 법 */
  headline: ReactNode;
  /** 결과 아래 상세 (타임라인, 항목 목록 등) */
  detail?: ReactNode;
  /** 프로필이 비어 예시값으로 채운 항목들. 있으면 결과가 내 값이 아님을 밝힌다. */
  exampleFields?: string[];
  /** 지금 입력값을 담은 공유용 주소 조각 */
  shareQuery?: string;
  /** 공유할 때 주소 앞에 붙는 한 문장. 방금 계산된 금액·기간이 들어간다. */
  shareText?: string;
  /** 공유받은 링크의 값으로 계산 중인가 */
  fromSharedLink?: boolean;
  /** 사이트가 답할 수 없는 것을 어디에 물어야 하는지 안내하는 자리 */
  extra?: ReactNode;
}) {
  const stale = outcome.ok && hasStaleBasis(outcome.result.basis);

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-4 px-4 pb-16 pt-4">
      <BackButton
        fallbackHref={`/${tool.event}`}
        label={findEvent(tool.event)?.title ?? '뒤로'}
      />

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft">
            {TOOL_TYPE_LABEL[tool.type]}
          </span>
          {stale && <StaleBadge />}
        </div>
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
          {tool.question}
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">{tool.lead}</p>
      </header>

      <section
        aria-label="계산 결과"
        className="rounded-[12px] border border-line-strong bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(20,22,26,0.04)]"
      >
        {outcome.ok ? (
          <>
            {headline}
            {fromSharedLink && (
              <p className="mt-3.5 rounded-[8px] bg-brand-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
                공유받은 링크에 담긴 값으로 계산했어요. 아래에서 내 값으로 바꾸면 바로 다시
                계산됩니다.
              </p>
            )}
            {exampleFields && exampleFields.length > 0 && (
              <p className="mt-3.5 rounded-[8px] bg-sunk px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
                아직 프로필이 비어 있어서 {exampleFields.join(', ')} 항목을 예시값으로 채워 계산했어요.
                아래에서 내 값으로 바꾸면 바로 다시 계산됩니다.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="text-[16px] font-bold text-ink">아직 계산할 수 없어요</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              아래 값만 알려주시면 바로 계산해 드릴게요.
            </p>
            <ul className="flex flex-col gap-3">
              {outcome.missing.map((m) => (
                <li key={m.field} className="rounded-[8px] bg-sunk px-3 py-2.5">
                  <p className="text-[13.5px] font-semibold text-ink">{m.label}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{m.hint}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {outcome.ok && shareQuery && (
        <ShareButton query={shareQuery} title={tool.question} text={shareText} />
      )}

      <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
        <h2 className="mb-3.5 text-[14px] font-semibold text-ink">입력한 값</h2>
        {form}
        <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-faint">
          입력한 값은 이 브라우저 밖으로 나가지 않아요. 서버로 보내지 않고 여기서 계산합니다.
        </p>
      </section>

      {extra}

      {detail}

      {outcome.ok && (
        <>
          <Callout tone="warning" title="놓치기 쉬운 것" items={outcome.result.warnings} />
          <StepBreakdown steps={outcome.result.steps} />
          <Callout tone="note" title="이렇게 가정했어요" items={outcome.result.assumptions} />
          <BasisFooter basis={outcome.result.basis} />
        </>
      )}
    </div>
  );
}
