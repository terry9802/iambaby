'use client';

import { useCallback, useMemo, useState } from 'react';
import { calcSeverancePay, type SeverancePayInput } from '@/lib/calculators/severance-pay';
import { formatKRW, formatManwon, toISODate } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { resolveToday } from '@/lib/profile/seed';
import { buildShareQuery, pickDefined, qNum, qStr, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import { DateField, FieldGroup, MoneyField } from '@/components/ui/fields';

export function SeverancePayTool({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { profile, hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<SeverancePayInput>>({});

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      joinDate: qStr(sp, 'in'),
      leaveDate: qStr(sp, 'out'),
      monthlyWage: qNum(sp, 'wage'),
      annualBonus: qNum(sp, 'bonus'),
      annualLeaveAllowance: qNum(sp, 'leave'),
      ordinaryMonthlyWage: qNum(sp, 'ord'),
    });
  }, [hydrated]);

  const seeded = useMemo<SeverancePayInput>(() => {
    const today = resolveToday(hydrated, fallbackToday);
    return {
      joinDate: hydrated && profile.employment?.joinDate ? profile.employment.joinDate : '2021-01-01',
      leaveDate: today,
      monthlyWage:
        hydrated && profile.income?.monthlyWage ? profile.income.monthlyWage : 3_000_000,
    };
  }, [hydrated, fallbackToday, profile]);

  const input = useMemo(() => ({ ...seeded, ...fromLink, ...edits }), [seeded, fromLink, edits]);
  const set = useCallback(
    (patch: Partial<SeverancePayInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => calcSeverancePay(input), [input]);
  const shareQuery = buildShareQuery({
    in: input.joinDate,
    out: input.leaveDate,
    wage: input.monthlyWage,
    bonus: input.annualBonus,
    leave: input.annualLeaveAllowance,
    ord: input.ordinaryMonthlyWage,
  });

  const headline = outcome.ok ? (
    <ResultHeadline
      label={outcome.result.value.eligible ? '받는 퇴직금' : '아직 받을 수 없어요'}
      value={outcome.result.value.severance}
      sub={
        outcome.result.value.eligible ? (
          <>
            {Math.floor(outcome.result.value.servedYears)}년{' '}
            {Math.round((outcome.result.value.servedYears % 1) * 12)}개월 일하고 1일 평균임금{' '}
            {formatKRW(outcome.result.value.appliedDailyWage)} 기준이에요.
          </>
        ) : (
          <>1년을 채워야 퇴직금이 나옵니다. 퇴사일을 조금만 미뤄도 달라져요.</>
        )
      }
    >
      {outcome.result.value.eligible && (
        <ResultAside>
          {outcome.result.value.usedOrdinary
            ? '통상임금이 평균임금보다 높아 통상임금으로 계산했어요. 법이 더 유리한 쪽을 쓰도록 정하고 있습니다.'
            : `상여금이나 연차수당이 있으면 아래에 넣어보세요. 평균임금이 올라가 퇴직금도 늘어납니다.`}
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
      fromSharedLink={Object.keys(fromLink).length > 0}
      form={
        <FieldGroup>
          <DateField label="입사일" value={input.joinDate} onChange={(joinDate) => set({ joinDate })} />
          <DateField
            label="퇴사일"
            hint="마지막 근무일 다음 날이에요. 아직 안 정하셨으면 예정일을 넣어보세요."
            value={input.leaveDate}
            onChange={(leaveDate) => set({ leaveDate })}
          />
          <MoneyField
            label="퇴직 전 3개월 월 평균 급여 (세전)"
            hint="세금 떼기 전 금액입니다. 매달 다르면 세 달 평균을 넣어주세요."
            value={input.monthlyWage}
            placeholder="3,000,000"
            onChange={(monthlyWage) => set({ monthlyWage })}
          />
          <MoneyField
            label="최근 1년 상여금 총액"
            hint="정기 상여금이 있으면 넣어주세요. 1년치의 3개월분만 평균임금에 들어갑니다."
            value={input.annualBonus}
            placeholder="없으면 비워두세요"
            onChange={(annualBonus) => set({ annualBonus })}
          />
          <MoneyField
            label="전년도 연차수당"
            hint="못 쓴 연차를 돈으로 받았다면 넣어주세요. 이것도 평균임금에 들어갑니다."
            value={input.annualLeaveAllowance}
            placeholder="없으면 비워두세요"
            onChange={(annualLeaveAllowance) => set({ annualLeaveAllowance })}
          />
          <MoneyField
            label="월 통상임금"
            hint="평균임금보다 통상임금이 높으면 통상임금으로 계산합니다. 모르시면 비워두셔도 됩니다."
            value={input.ordinaryMonthlyWage}
            placeholder="모르면 비워두세요"
            onChange={(ordinaryMonthlyWage) => set({ ordinaryMonthlyWage })}
          />
        </FieldGroup>
      }
      detail={
        outcome.ok && !outcome.result.value.eligible ? (
          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <h2 className="text-[14px] font-semibold text-ink">1년만 채우면</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
              지금 조건으로 1년을 채우면 약{' '}
              <strong className="tnum font-semibold text-ink">
                {formatManwon(
                  Math.round(outcome.result.value.appliedDailyWage * 30),
                )}
              </strong>
              을 받습니다. 퇴사일을{' '}
              {input.joinDate ? toISODate(new Date(new Date(input.joinDate).getTime() + 365 * 86400000)) : ''} 이후로
              잡을 수 있는지 회사와 이야기해 보세요.
            </p>
          </section>
        ) : null
      }
    />
  );
}
