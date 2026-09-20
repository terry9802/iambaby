'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  calcLeaveTimeline,
  type CompanySize,
  type LeaveTimelineInput,
} from '@/lib/calculators/leave-timeline';
import { addDays, formatDate, formatKRW, formatManwon, parseDate, toISODate } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { Seeder, pendingExamples, resolveToday } from '@/lib/profile/seed';
import { buildShareQuery, pickDefined, qBool, qNum, qStr, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import {
  DateField,
  FieldGroup,
  MoneyField,
  NumberField,
  SegmentedField,
  ToggleField,
} from '@/components/ui/fields';
import { LeaveGantt } from '@/components/timeline/LeaveGantt';

export function LeaveTimelineTool({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { profile, hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<LeaveTimelineInput>>({});

  const seeded = useMemo(() => {
    const seeder = new Seeder<LeaveTimelineInput>();
    seeder.pick('monthlyWage', hydrated ? profile.income?.monthlyWage : undefined, {
      value: 3_000_000,
      label: '통상임금 3,000,000원',
    });
    const children = hydrated ? (profile.children ?? []) : [];
    seeder.pick('dueDate', children[children.length - 1]?.birthDate, {
      value: toISODate(addDays(parseDate(resolveToday(hydrated, fallbackToday)), 90)),
      label: '90일 뒤 출산 예정',
    });
    return {
      input: seeder.build({ parentalLeaveMonths: 12, companySize: 'priority' }),
      autofilled: seeder.autofilled,
      examples: seeder.examples,
    };
  }, [profile, hydrated, fallbackToday]);

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    const size = qStr(sp, 'size');
    return pickDefined({
      dueDate: qStr(sp, 'due'),
      monthlyWage: qNum(sp, 'wage'),
      companySize: size === 'priority' || size === 'large' ? (size as CompanySize) : undefined,
      parentalLeaveMonths: qNum(sp, 'months'),
      isMultiple: qBool(sp, 'multi'),
    });
  }, [hydrated]);

  const input = useMemo(
    () => ({ ...seeded.input, ...fromLink, ...edits }),
    [seeded, fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<LeaveTimelineInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );
  const examples = pendingExamples(seeded.examples, { ...fromLink, ...edits });
  const autofilled = new Set(
    [...seeded.autofilled].filter((field) => !(field in fromLink) && !(field in edits)),
  );
  const shareQuery = buildShareQuery({
    due: input.dueDate,
    wage: input.monthlyWage,
    size: input.companySize,
    months: input.parentalLeaveMonths,
    multi: input.isMultiple,
  });

  const outcome = useMemo(() => calcLeaveTimeline(input), [input]);

  const shareText = outcome.ok
    ? `출산전후휴가부터 복직까지 ${outcome.result.value.totalDaysOff.toLocaleString('ko-KR')}일을 쉬고, 그동안 ${formatManwon(outcome.result.value.grandTotal)}을 받아요.`
    : undefined;

  const headline = outcome.ok ? (
    <ResultHeadline
      label="복직하는 날"
      valueText={formatDate(outcome.result.value.returnDate)}
      sub={
        <>
          {outcome.result.value.totalDaysOff.toLocaleString('ko-KR')}일을 쉬고, 그동안 모두{' '}
          <strong className="tnum font-bold text-ink">
            {formatKRW(outcome.result.value.grandTotal)}
          </strong>
          을 받아요.
        </>
      }
    >
      <ResultAside>
        가장 가까운 마감은{' '}
        {(() => {
          const next = outcome.result.value.deadlines
            .filter((d) => d.status !== 'passed')
            .sort((a, b) => a.dDay - b.dDay)[0];
          if (!next) return '남아 있지 않아요.';
          return (
            <>
              <span className="font-semibold text-ink">{next.label}</span>이고{' '}
              <span className="tnum font-semibold text-alert">D-{next.dDay}</span>예요.
            </>
          );
        })()}
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
      shareText={shareText}
      fromSharedLink={Object.keys(fromLink).length > 0}
      detail={
        outcome.ok ? (
          <>
            <LeaveGantt
              segments={outcome.result.value.segments}
              returnDate={outcome.result.value.returnDate}
            />
            <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
              <h2 className="text-[14px] font-semibold text-ink">언제 뭘 신청하나요</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                기한을 놓쳐서 못 받는 경우가 가장 많아요. 달력에 옮겨 적어 두세요.
              </p>
              <ul className="mt-3 flex flex-col">
                {outcome.result.value.deadlines.map((d) => {
                  const tone =
                    d.status === 'passed'
                      ? 'bg-danger-soft text-danger'
                      : d.dDay <= 30
                        ? 'bg-alert-soft text-alert'
                        : 'bg-brand-soft text-brand-strong';
                  return (
                    <li
                      key={d.id}
                      className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-ink">{d.label}</span>
                        <span className={`tnum rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${tone}`}>
                          {d.status === 'passed' ? `${Math.abs(d.dDay)}일 지남` : `D-${d.dDay}`}
                        </span>
                      </div>
                      <p className="tnum text-[12.5px] text-ink-soft">
                        {d.opensAt ? `${d.opensAt} ~ ` : ''}
                        {d.dueAt}까지 · {d.applyAt}
                      </p>
                      <p className="text-[12px] leading-relaxed text-ink-faint">{d.note}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        ) : null
      }
      form={
        <FieldGroup>
          <DateField
            label="출산 예정일"
            value={input.dueDate}
            autofilled={autofilled.has('dueDate')}
            onChange={(dueDate) => set({ dueDate })}
          />
          <MoneyField
            label="월 통상임금"
            value={input.monthlyWage}
            autofilled={autofilled.has('monthlyWage')}
            placeholder="3,000,000"
            onChange={(monthlyWage) => set({ monthlyWage })}
          />
          <SegmentedField<CompanySize>
            label="회사 규모"
            hint="우선지원 대상기업이면 90일 전부를 고용보험에서 받고, 대규모기업이면 최초 60일은 회사가 줍니다. 대부분의 중소기업은 우선지원 대상기업이에요."
            value={input.companySize}
            onChange={(companySize) => set({ companySize })}
            options={[
              { value: 'priority', label: '우선지원 대상기업 (중소기업)' },
              { value: 'large', label: '대규모기업' },
            ]}
          />
          <NumberField
            label="이어서 쓸 육아휴직"
            unit="개월"
            min={0}
            max={18}
            value={input.parentalLeaveMonths}
            onChange={(parentalLeaveMonths) => set({ parentalLeaveMonths })}
          />
          <ToggleField
            label="쌍둥이 이상이에요"
            hint="다태아는 출산전후휴가가 90일이 아니라 120일이고, 출산 후에 최소 60일을 남겨야 해요."
            checked={input.isMultiple ?? false}
            onChange={(isMultiple) => set({ isMultiple })}
          />
        </FieldGroup>
      }
    />
  );
}
