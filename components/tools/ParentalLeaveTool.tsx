'use client';

import { useCallback, useMemo, useState } from 'react';
import { calcParentalLeave, type ParentalLeaveInput } from '@/lib/calculators/parental-leave';
import { formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { Seeder, pendingExamples, resolveToday } from '@/lib/profile/seed';
import { buildShareQuery, pickDefined, qBool, qNum, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import { FieldGroup, MoneyField, NumberField, ToggleField } from '@/components/ui/fields';
import { MonthlyBars } from '@/components/timeline/MonthlyBars';

export function ParentalLeaveTool({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { profile, hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<ParentalLeaveInput>>({});

  const seeded = useMemo(() => {
    const seeder = new Seeder<ParentalLeaveInput>();
    seeder.pick('monthlyWage', hydrated ? profile.income?.monthlyWage : undefined, {
      value: 3_000_000,
      label: '통상임금 300만원',
    });
    seeder.set('singleParent', hydrated ? profile.singleParent : undefined);
    return {
      input: seeder.build({ months: 12, startDate: resolveToday(hydrated, fallbackToday) }),
      autofilled: seeder.autofilled,
      examples: seeder.examples,
    };
  }, [profile, hydrated, fallbackToday]);

  // 공유받은 링크의 값 > 프로필 > 예시값 순으로 이기고, 사용자가 직접 고친 값이 가장 세다.
  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      monthlyWage: qNum(sp, 'wage'),
      months: qNum(sp, 'months'),
      singleParent: qBool(sp, 'single'),
    });
  }, [hydrated]);

  const input = useMemo(
    () => ({ ...seeded.input, ...fromLink, ...edits }),
    [seeded, fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<ParentalLeaveInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => calcParentalLeave(input), [input]);
  const examples = pendingExamples(seeded.examples, { ...fromLink, ...edits });
  const autofilled = new Set(
    [...seeded.autofilled].filter((field) => !(field in fromLink) && !(field in edits)),
  );
  const shareQuery = buildShareQuery({
    wage: input.monthlyWage,
    months: input.months,
    single: input.singleParent,
  });

  const headline = outcome.ok ? (
    <ResultHeadline
      label={`첫 달에 받는 금액${input.singleParent ? ' (한부모 기준)' : ''}`}
      value={outcome.result.value.firstMonthAmount}
      sub={
        <>
          {outcome.result.value.months}개월 동안 모두 합치면{' '}
          <strong className="tnum font-bold text-ink">
            {formatKRW(outcome.result.value.total)}
          </strong>
          을 받아요.
        </>
      }
    >
      <ResultAside>
        달마다 같은 금액이 아니에요. 1~3개월차가 가장 많고 7개월차부터 확 줄어듭니다. 평균은 월{' '}
        <span className="tnum font-semibold text-ink">
          {formatManwon(outcome.result.value.averageMonthly)}
        </span>
        예요.
      </ResultAside>
    </ResultHeadline>
  ) : null;

  return (
    <CalcShell
      tool={tool}
      outcome={outcome}
      headline={headline}
      exampleFields={examples}
      shareQuery={shareQuery}
      fromSharedLink={Object.keys(fromLink).length > 0}
      detail={
        outcome.ok ? (
          <MonthlyBars
            caption="막대 길이가 그 달에 실제로 들어오는 금액이에요."
            rows={outcome.result.value.monthly.map((m) => ({
              label: `${m.month}개월차`,
              amount: m.amount,
              emphasis: m.month <= 3,
              note: m.capped
                ? `상한 ${formatManwon(m.cap)}에 걸렸어요`
                : m.floored
                  ? `하한 ${formatManwon(m.floor)}이 적용됐어요`
                  : `통상임금의 ${Math.round(m.rate * 100)}%`,
            }))}
          />
        ) : null
      }
      form={
        <FieldGroup>
          <MoneyField
            label="월 통상임금"
            hint="기본급에 매달 고정으로 나오는 수당을 더한 금액이에요. 성과급처럼 들쭉날쭉한 항목은 뺍니다."
            value={input.monthlyWage}
            autofilled={autofilled.has('monthlyWage')}
            placeholder="3,000,000"
            onChange={(monthlyWage) => set({ monthlyWage })}
          />
          <NumberField
            label="사용할 개월 수"
            hint="최대 12개월이고, 부부가 각각 3개월 이상 쓰면 18개월까지 늘어나요."
            unit="개월"
            min={1}
            max={18}
            value={input.months}
            onChange={(months) => set({ months })}
          />
          <ToggleField
            label="한부모예요"
            hint="한부모는 첫 3개월 상한액이 250만원이 아니라 300만원입니다."
            checked={input.singleParent ?? false}
            onChange={(singleParent) => set({ singleParent })}
          />
        </FieldGroup>
      }
    />
  );
}
