'use client';

import { useCallback, useMemo, useState } from 'react';
import { compareJobChange, type JobChangeInput } from '@/lib/calculators/job-change';
import { formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { buildShareQuery, pickDefined, qNum, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import { FieldGroup, MoneyField, NumberField } from '@/components/ui/fields';
import { ConsultBox } from '@/components/ui/PhoneCopy';

export function JobChangeTool({ tool }: { tool: Tool }) {
  const { profile, hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<JobChangeInput>>({});

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      currentSalary: qNum(sp, 'now'),
      offeredSalary: qNum(sp, 'new'),
      currentTaxFree: qNum(sp, 'nowFree'),
      offeredTaxFree: qNum(sp, 'newFree'),
      dependents: qNum(sp, 'dep'),
    });
  }, [hydrated]);

  const seeded = useMemo<JobChangeInput>(() => {
    const current =
      hydrated && profile.income?.annualSalary ? profile.income.annualSalary : 50_000_000;
    return {
      currentSalary: current,
      offeredSalary: Math.round((current * 1.15) / 1_000_000) * 1_000_000,
      currentTaxFree: 200_000,
      offeredTaxFree: 200_000,
      dependents: 1,
    };
  }, [hydrated, profile]);

  const input = useMemo(() => ({ ...seeded, ...fromLink, ...edits }), [seeded, fromLink, edits]);
  const set = useCallback(
    (patch: Partial<JobChangeInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => compareJobChange(input), [input]);
  const shareQuery = buildShareQuery({
    now: input.currentSalary,
    new: input.offeredSalary,
    nowFree: input.currentTaxFree,
    newFree: input.offeredTaxFree,
    dep: input.dependents,
  });

  const shareText = outcome.ok
    ? outcome.result.value.better
      ? `옮기면 실수령액이 매달 ${formatManwon(outcome.result.value.monthlyDiff)} 늘어요. 1년이면 ${formatManwon(outcome.result.value.annualDiff)} 차이입니다.`
      : `옮기면 실수령액이 매달 ${formatManwon(Math.abs(outcome.result.value.monthlyDiff))} 줄어요. 지금과 같아지려면 연봉 ${formatManwon(outcome.result.value.breakEvenSalary)}은 받아야 합니다.`
    : undefined;

  const headline = outcome.ok ? (
    <ResultHeadline
      label={outcome.result.value.better ? '매달 이만큼 더 받아요' : '매달 이만큼 줄어요'}
      value={Math.abs(outcome.result.value.monthlyDiff)}
      sub={
        <>
          1년이면{' '}
          <strong className="tnum font-bold text-ink">
            {formatKRW(Math.abs(outcome.result.value.annualDiff))}
          </strong>{' '}
          차이입니다.
        </>
      }
    >
      <ResultAside>
        지금과 실수령액이 같아지는 연봉은{' '}
        <strong className="tnum font-bold text-brand-strong">
          {formatManwon(outcome.result.value.breakEvenSalary)}
        </strong>
        이에요. 이보다 낮게 부르면 손해입니다.
      </ResultAside>
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
      detail={
        outcome.ok ? (
          <>
            <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
              <h2 className="text-[14px] font-semibold text-ink">월 실수령액 비교</h2>
              <div className="-mx-4 mt-3 overflow-x-auto px-4">
                <table className="w-full min-w-[340px] border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-line-strong text-left text-[12px] text-ink-faint">
                      <th scope="col" className="py-2 font-medium">항목</th>
                      <th scope="col" className="py-2 text-right font-medium">지금</th>
                      <th scope="col" className="py-2 text-right font-medium">옮기면</th>
                    </tr>
                  </thead>
                  <tbody className="tnum">
                    {[
                      ['세전 월급', 'grossMonthly'],
                      ['국민연금', 'pension'],
                      ['건강보험', 'health'],
                      ['장기요양', 'longTermCare'],
                      ['고용보험', 'employment'],
                      ['소득세', 'incomeTax'],
                      ['지방소득세', 'localTax'],
                    ].map(([label, key]) => (
                      <tr key={key} className="border-b border-line">
                        <th scope="row" className="py-2 text-left font-normal text-ink-soft">
                          {label}
                        </th>
                        <td className="py-2 text-right text-ink-soft">
                          {formatKRW(
                            outcome.result.value.current[
                              key as keyof typeof outcome.result.value.current
                            ] as number,
                          )}
                        </td>
                        <td className="py-2 text-right text-ink-soft">
                          {formatKRW(
                            outcome.result.value.offered[
                              key as keyof typeof outcome.result.value.offered
                            ] as number,
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <th scope="row" className="py-2.5 text-left font-semibold text-ink">
                        실수령액
                      </th>
                      <td className="py-2.5 text-right font-bold text-ink">
                        {formatKRW(outcome.result.value.current.netMonthly)}
                      </td>
                      <td className="py-2.5 text-right font-bold text-brand-strong">
                        {formatKRW(outcome.result.value.offered.netMonthly)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            <ConsultBox
              title="세금은 사람마다 다릅니다"
              lead="여기 소득세는 연간 기준 근사치예요. 실제로는 부양가족, 의료비, 기부금 같은 공제가 사람마다 달라 연말정산에서 정해집니다."
              phones={[
                {
                  label: '국세청 세미래 콜센터',
                  number: '126',
                  note: '연말정산과 공제 항목은 여기나 회사 인사팀이 정확합니다.',
                },
              ]}
            />
          </>
        ) : null
      }
      form={
        <FieldGroup>
          <MoneyField
            label="지금 연봉 (세전)"
            value={input.currentSalary}
            placeholder="50,000,000"
            onChange={(currentSalary) => set({ currentSalary })}
          />
          <MoneyField
            label="제안받은 연봉 (세전)"
            hint="아직 제안 전이면 부르고 싶은 금액을 넣어보세요."
            value={input.offeredSalary}
            placeholder="60,000,000"
            onChange={(offeredSalary) => set({ offeredSalary })}
          />
          <MoneyField
            label="지금 회사 월 비과세 수당"
            hint="식대 등 세금이 안 붙는 수당이에요. 월 20만원까지 인정됩니다."
            value={input.currentTaxFree}
            placeholder="200,000"
            onChange={(currentTaxFree) => set({ currentTaxFree })}
          />
          <MoneyField
            label="옮길 회사 월 비과세 수당"
            hint="같은 연봉이라도 이게 다르면 실수령액이 달라집니다."
            value={input.offeredTaxFree}
            placeholder="200,000"
            onChange={(offeredTaxFree) => set({ offeredTaxFree })}
          />
          <NumberField
            label="부양가족 수 (본인 포함)"
            unit="명"
            min={1}
            max={10}
            hint="배우자와 부양하는 가족을 포함한 인원이에요. 많을수록 세금이 줄어듭니다."
            value={input.dependents}
            onChange={(dependents) => set({ dependents })}
          />
        </FieldGroup>
      }
    />
  );
}
