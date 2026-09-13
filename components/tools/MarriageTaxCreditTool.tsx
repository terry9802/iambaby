'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  calcMarriageTaxCredit,
  type MarriageTaxCreditInput,
} from '@/lib/calculators/marriage-tax-credit';
import { formatDate, formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { resolveToday } from '@/lib/profile/seed';
import { buildShareQuery, pickDefined, qBool, qStr, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { PendingReform } from '@/components/calculator/PendingReform';
import { pendingReformsFor } from '@/lib/calculators/pending-reforms';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import { DateField, FieldGroup, ToggleField } from '@/components/ui/fields';

export function MarriageTaxCreditTool({
  tool,
  fallbackToday,
}: {
  tool: Tool;
  fallbackToday: string;
}) {
  const { hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<MarriageTaxCreditInput>>({});

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      registrationDate: qStr(sp, 'd'),
      myIncome: qBool(sp, 'mi'),
      spouseIncome: qBool(sp, 'si'),
      myAlreadyClaimed: qBool(sp, 'mc'),
      spouseAlreadyClaimed: qBool(sp, 'sc'),
    });
  }, [hydrated]);

  const input = useMemo<MarriageTaxCreditInput>(
    () => ({
      registrationDate: resolveToday(hydrated, fallbackToday),
      myIncome: true,
      spouseIncome: true,
      ...fromLink,
      ...edits,
    }),
    [hydrated, fallbackToday, fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<MarriageTaxCreditInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => calcMarriageTaxCredit(input), [input]);
  const shareQuery = buildShareQuery({
    d: input.registrationDate,
    mi: input.myIncome,
    si: input.spouseIncome,
    mc: input.myAlreadyClaimed,
    sc: input.spouseAlreadyClaimed,
  });

  const shareText = outcome.ok
    ? outcome.result.value.eligible
      ? `혼인신고만 하면 부부가 ${formatManwon(outcome.result.value.total)}을 돌려받아요. 이 제도는 ${outcome.result.value.daysLeft}일 뒤에 끝납니다.`
      : '결혼세액공제, 내가 받을 수 있는지 30초면 확인돼요.'
    : undefined;

  const headline = outcome.ok ? (
    <ResultHeadline
      label={outcome.result.value.eligible ? '부부가 함께 돌려받는 세금' : '이 조건으로는 해당되지 않아요'}
      value={outcome.result.value.total}
      sub={
        outcome.result.value.eligible ? (
          <>
            본인 {formatKRW(outcome.result.value.mine)} + 배우자{' '}
            {formatKRW(outcome.result.value.spouse)}. {outcome.result.value.claimYear}년 귀속{' '}
            {outcome.result.value.claimAt} 때 받습니다.
          </>
        ) : (
          <>혼인신고 날짜나 소득 조건을 바꿔서 다시 확인해 보세요.</>
        )
      }
    >
      {outcome.result.value.daysLeft >= 0 && (
        <ResultAside>
          이 제도는 <strong className="font-semibold text-ink">{formatDate(outcome.result.value.deadline)}</strong>에
          끝납니다. 오늘부터{' '}
          <span className="tnum font-bold text-alert">{outcome.result.value.daysLeft}일</span> 남았어요.
        </ResultAside>
      )}
    </ResultHeadline>
  ) : null;

  return (
    <CalcShell
      tool={tool}
      outcome={outcome}
      headline={headline}
      shareQuery={shareQuery}
      shareText={shareText}
      fromSharedLink={Object.keys(fromLink).length > 0}
      extra={<PendingReform notice={pendingReformsFor('marriage')} />}
      form={
        <FieldGroup>
          <DateField
            label="혼인신고 날짜"
            hint="결혼식 날이 아니라 구청·주민센터에 혼인신고서를 낸 날이에요. 아직 안 하셨으면 하려는 날짜를 넣어보세요."
            value={input.registrationDate}
            onChange={(registrationDate) => set({ registrationDate })}
          />
          <ToggleField
            label="혼인신고한 해에 나는 소득이 있어요"
            hint="근로소득이나 사업소득이 있어야 공제받을 세금이 생깁니다."
            checked={input.myIncome ?? true}
            onChange={(myIncome) => set({ myIncome })}
          />
          <ToggleField
            label="혼인신고한 해에 배우자도 소득이 있어요"
            checked={input.spouseIncome ?? true}
            onChange={(spouseIncome) => set({ spouseIncome })}
          />
          <ToggleField
            label="나는 예전 결혼에서 이미 이 공제를 받았어요"
            hint="생애 한 번만 받을 수 있습니다. 처음이시면 꺼두세요."
            checked={input.myAlreadyClaimed ?? false}
            onChange={(myAlreadyClaimed) => set({ myAlreadyClaimed })}
          />
          <ToggleField
            label="배우자가 예전 결혼에서 이미 이 공제를 받았어요"
            checked={input.spouseAlreadyClaimed ?? false}
            onChange={(spouseAlreadyClaimed) => set({ spouseAlreadyClaimed })}
          />
        </FieldGroup>
      }
    />
  );
}
