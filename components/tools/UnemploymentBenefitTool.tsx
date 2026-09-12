'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  calcUnemploymentBenefit,
  type AgeGroup,
  type UnemploymentInput,
} from '@/lib/calculators/unemployment-benefit';
import { formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { buildShareQuery, pickDefined, qBool, qNum, qStr, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import { FieldGroup, MoneyField, NumberField, SegmentedField, ToggleField } from '@/components/ui/fields';
import { ConsultBox } from '@/components/ui/PhoneCopy';

export function UnemploymentBenefitTool({ tool }: { tool: Tool }) {
  const { profile, hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<UnemploymentInput>>({});

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    const age = qStr(sp, 'age');
    return pickDefined({
      monthlyWage: qNum(sp, 'wage'),
      ageGroup: age === 'under50' || age === 'over50' ? (age as AgeGroup) : undefined,
      insuredYears: qNum(sp, 'yrs'),
      voluntary: qBool(sp, 'vol'),
      dailyCapOverride: qNum(sp, 'cap'),
    });
  }, [hydrated]);

  const seeded = useMemo<UnemploymentInput>(
    () => ({
      monthlyWage: hydrated && profile.income?.monthlyWage ? profile.income.monthlyWage : 3_000_000,
      ageGroup: 'under50',
      insuredYears: 3,
      voluntary: false,
    }),
    [hydrated, profile],
  );

  const input = useMemo(() => ({ ...seeded, ...fromLink, ...edits }), [seeded, fromLink, edits]);
  const set = useCallback(
    (patch: Partial<UnemploymentInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => calcUnemploymentBenefit(input), [input]);
  const shareQuery = buildShareQuery({
    wage: input.monthlyWage,
    age: input.ageGroup,
    yrs: input.insuredYears,
    vol: input.voluntary,
    cap: input.dailyCapOverride,
  });

  const shareText = outcome.ok
    ? `실업급여를 하루 ${formatKRW(outcome.result.value.dailyBenefit)}씩 ${outcome.result.value.benefitDays}일 받아요. 다 합치면 ${formatManwon(outcome.result.value.total)}입니다.`
    : undefined;

  const headline = outcome.ok ? (
    <ResultHeadline
      label="전부 받으면 이만큼"
      value={outcome.result.value.total}
      sub={
        <>
          하루 <strong className="tnum font-bold text-ink">{formatKRW(outcome.result.value.dailyBenefit)}</strong>
          씩 <strong className="tnum font-bold text-ink">{outcome.result.value.benefitDays}일</strong> 받습니다.
          한 달로 치면 약 {formatManwon(outcome.result.value.dailyBenefit * 30)}이에요.
        </>
      }
    >
      <ResultAside>
        {outcome.result.value.mayNotQualify
          ? '스스로 그만두신 경우라 받지 못할 수 있습니다. 아래 경고를 꼭 읽어주세요.'
          : outcome.result.value.dailyBenefit === outcome.result.value.dailyFloor
            ? '월급이 얼마든 하한액 아래로는 내려가지 않아요. 지금은 하한액이 적용됐습니다.'
            : '평균임금의 60%가 그대로 적용됐습니다.'}
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
        <ConsultBox
          title="이건 전화로 확인하는 게 정확합니다"
          lead="상한액은 해마다 고시로 바뀌고, 내가 받을 수 있는지는 퇴사 사유를 봐야 정해집니다. 화면의 숫자는 참고용으로만 보세요."
          phones={[
            {
              label: '고용노동부 고객상담센터',
              number: '1350',
              note: '수급 자격, 상한액, 신청 절차 전부 여기서 안내합니다.',
            },
          ]}
        />
      }
      form={
        <FieldGroup>
          <MoneyField
            label="퇴직 전 3개월 월 평균 급여 (세전)"
            hint="세금 떼기 전 금액이에요. 이 금액의 60%가 기준이 됩니다."
            value={input.monthlyWage}
            placeholder="3,000,000"
            onChange={(monthlyWage) => set({ monthlyWage })}
          />
          <SegmentedField<AgeGroup>
            label="퇴사할 때 나이"
            hint="만 50세를 기준으로 받는 일수가 달라집니다. 장애인은 50세 이상과 같습니다."
            value={input.ageGroup}
            onChange={(ageGroup) => set({ ageGroup })}
            options={[
              { value: 'under50', label: '만 50세 미만' },
              { value: 'over50', label: '만 50세 이상 · 장애인' },
            ]}
          />
          <NumberField
            label="고용보험 가입기간"
            unit="년"
            min={0}
            max={40}
            hint="이전 직장 기간도 합칩니다. 길수록 받는 일수가 늘어나요."
            value={input.insuredYears}
            onChange={(insuredYears) => set({ insuredYears })}
          />
          <ToggleField
            label="스스로 그만두는 거예요"
            hint="자발적 퇴사는 원칙적으로 대상이 아닙니다. 다만 정당한 사유가 인정되면 받을 수 있어요."
            checked={input.voluntary ?? false}
            onChange={(voluntary) => set({ voluntary })}
          />
          <MoneyField
            label="1일 상한액 (확인 필요)"
            hint="2019년 고시 기준 66,000원을 기본값으로 넣어뒀어요. 올해 값이 다르면 여기서 고쳐 계산하시면 됩니다."
            value={input.dailyCapOverride ?? (outcome.ok ? outcome.result.value.dailyCap : undefined)}
            placeholder="66,000"
            onChange={(dailyCapOverride) => set({ dailyCapOverride })}
          />
        </FieldGroup>
      }
    />
  );
}
