'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  optimizeCoupleLeave,
  type Combination,
  type CoupleLeaveInput,
} from '@/lib/calculators/parental-leave-optimizer';
import { formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { Seeder, pendingExamples, resolveToday } from '@/lib/profile/seed';
import { buildShareQuery, pickDefined, qBool, qNum, qStr, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import { DateField, FieldGroup, MoneyField, NumberField, ToggleField } from '@/components/ui/fields';
import { CoupleGantt } from '@/components/timeline/CoupleGantt';

function ComboCard({
  combination,
  rank,
  selected,
  best,
  onSelect,
}: {
  combination: Combination;
  rank: number;
  selected: boolean;
  best: number;
  onSelect: () => void;
}) {
  const diff = combination.total - best;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={
        'flex w-full flex-col gap-1.5 rounded-[10px] border px-3.5 py-3 text-left transition-colors ' +
        (selected ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong')
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-ink-soft">
          {rank === 1 ? '가장 많이 받는 조합' : `${rank}순위`}
        </span>
        <span className="tnum text-[15px] font-bold text-ink">{formatKRW(combination.total)}</span>
      </div>
      <p className="text-[13px] text-ink">
        본인 <strong className="tnum font-semibold">{combination.me.months}개월</strong> · 배우자{' '}
        <strong className="tnum font-semibold">{combination.spouse.months}개월</strong>
        <span className="text-ink-soft"> · 특례 {combination.specialMonths}개월 적용</span>
      </p>
      {rank > 1 && <p className="tnum text-[12px] text-ink-faint">1순위보다 {formatManwon(diff)}</p>}
    </button>
  );
}

export function CoupleLeaveTool({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { profile, hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<CoupleLeaveInput>>({});
  // 각자 최대치까지 쓰는 조합을 1위로 내밀면 "둘 다 12개월"이 답이 되어 버린다.
  // 실제 고민은 "합쳐서 쓸 수 있는 기간을 어떻게 나눌까"이므로 이쪽을 기본으로 둔다.
  const [useBudget, setUseBudget] = useState(true);
  const [selected, setSelected] = useState(0);

  const seeded = useMemo(() => {
    const seeder = new Seeder<CoupleLeaveInput>();
    seeder.pick('myWage', hydrated ? profile.income?.monthlyWage : undefined, {
      value: 3_500_000,
      label: '본인 통상임금 350만원',
    });
    seeder.pick('spouseWage', hydrated ? profile.spouse?.monthlyWage : undefined, {
      value: 3_000_000,
      label: '배우자 통상임금 300만원',
    });
    const children = hydrated ? (profile.children ?? []) : [];
    seeder.pick('childBirthDate', children[children.length - 1]?.birthDate, {
      value: resolveToday(hydrated, fallbackToday),
      label: '오늘 태어난 아이',
    });
    return {
      input: seeder.build({
        myMaxMonths: 12,
        spouseMaxMonths: 12,
        totalMonthsBudget: 12,
        allowOverlap: true,
      }),
      autofilled: seeder.autofilled,
      examples: seeder.examples,
    };
  }, [profile, hydrated, fallbackToday]);

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      myWage: qNum(sp, 'my'),
      spouseWage: qNum(sp, 'spouse'),
      childBirthDate: qStr(sp, 'birth'),
      myMaxMonths: qNum(sp, 'myMax'),
      spouseMaxMonths: qNum(sp, 'spouseMax'),
      totalMonthsBudget: qNum(sp, 'budget'),
      allowOverlap: qBool(sp, 'overlap'),
    });
  }, [hydrated]);

  const input = useMemo(
    () => ({ ...seeded.input, ...fromLink, ...edits }),
    [seeded, fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<CoupleLeaveInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(
    () =>
      optimizeCoupleLeave({
        ...input,
        totalMonthsBudget: useBudget ? (input.totalMonthsBudget ?? 12) : undefined,
      }),
    [input, useBudget],
  );

  const combos = outcome.ok ? [outcome.result.value.best, ...outcome.result.value.alternatives] : [];
  const shown = combos[Math.min(selected, combos.length - 1)];
  const examples = pendingExamples(seeded.examples, { ...fromLink, ...edits });
  const autofilled = new Set(
    [...seeded.autofilled].filter((field) => !(field in fromLink) && !(field in edits)),
  );
  const shareQuery = buildShareQuery({
    my: input.myWage,
    spouse: input.spouseWage,
    birth: input.childBirthDate,
    myMax: input.myMaxMonths,
    spouseMax: input.spouseMaxMonths,
    budget: useBudget ? (input.totalMonthsBudget ?? 12) : undefined,
    overlap: input.allowOverlap,
  });

  const headline = outcome.ok ? (
    <ResultHeadline
      label="부부가 함께 받을 수 있는 최대 금액"
      value={outcome.result.value.best.total}
      sub={
        <>
          본인 {outcome.result.value.best.me.months}개월, 배우자{' '}
          {outcome.result.value.best.spouse.months}개월로 나눠 쓸 때예요. (합쳐서{' '}
          {outcome.result.value.best.me.months + outcome.result.value.best.spouse.months}개월)
        </>
      }
    >
      <ResultAside>
        같은 기간을 한 사람이{' '}
        {outcome.result.value.soloBaseline.me.months +
          outcome.result.value.soloBaseline.spouse.months}
        개월 몰아 쓰면{' '}
        <span className="tnum font-semibold text-ink">
          {formatKRW(outcome.result.value.soloBaseline.total)}
        </span>
        이라, 나눠 쓰는 쪽이{' '}
        <strong className="tnum font-bold text-brand-strong">
          {formatKRW(outcome.result.value.gainVsSolo)}
        </strong>{' '}
        더 많아요.
        <span className="mt-1 block text-[12px] text-ink-faint">
          가능한 조합 {outcome.result.value.evaluated.toLocaleString('ko-KR')}가지를 모두 계산했어요.
        </span>
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
        outcome.ok && shown ? (
          <>
            <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
              <h2 className="text-[14px] font-semibold text-ink">조합 비교</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                눌러서 아래 타임라인을 바꿔 볼 수 있어요.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {combos.map((combo, i) => (
                  <ComboCard
                    key={combo.id}
                    combination={combo}
                    rank={i + 1}
                    selected={i === Math.min(selected, combos.length - 1)}
                    best={outcome.result.value.best.total}
                    onSelect={() => setSelected(i)}
                  />
                ))}
              </div>
            </section>
            <CoupleGantt combination={shown} />
          </>
        ) : null
      }
      form={
        <FieldGroup>
          <MoneyField
            label="본인 월 통상임금"
            value={input.myWage}
            autofilled={autofilled.has('myWage')}
            placeholder="3,500,000"
            onChange={(myWage) => set({ myWage })}
          />
          <MoneyField
            label="배우자 월 통상임금"
            value={input.spouseWage}
            autofilled={autofilled.has('spouseWage')}
            placeholder="3,000,000"
            onChange={(spouseWage) => set({ spouseWage })}
          />
          <DateField
            label="자녀 생년월일 (출산 예정일도 괜찮아요)"
            hint="특례는 생후 18개월 안에 쓴 기간에만 붙어서 이 날짜가 기준이 돼요."
            value={input.childBirthDate}
            autofilled={autofilled.has('childBirthDate')}
            onChange={(childBirthDate) => set({ childBirthDate })}
          />
          <NumberField
            label="본인이 쓸 수 있는 최대 개월 수"
            unit="개월"
            min={0}
            max={18}
            value={input.myMaxMonths}
            onChange={(myMaxMonths) => set({ myMaxMonths })}
          />
          <NumberField
            label="배우자가 쓸 수 있는 최대 개월 수"
            unit="개월"
            min={0}
            max={18}
            value={input.spouseMaxMonths}
            onChange={(spouseMaxMonths) => set({ spouseMaxMonths })}
          />
          <ToggleField
            label="부부가 합쳐서 쓸 개월 수를 정해뒀어요"
            hint="끄면 각자 쓸 수 있는 최대치까지 쓰는 조합을 찾습니다. 다만 그건 '둘 다 최대한 쉬기'가 답이 되기 쉬워서, 실제 고민인 '정해진 기간을 어떻게 나눌까'는 켜둔 채로 보시는 편이 좋아요."
            checked={useBudget}
            onChange={setUseBudget}
          />
          {useBudget && (
            <NumberField
              label="부부 합산 개월 수"
              unit="개월"
              min={1}
              max={36}
              value={input.totalMonthsBudget ?? 12}
              onChange={(totalMonthsBudget) => set({ totalMonthsBudget })}
            />
          )}
          <ToggleField
            label="두 사람이 같은 달에 함께 쉬어도 괜찮아요"
            hint="끄면 한 사람씩 순서대로 쉬는 조합만 찾습니다. 회사 사정이나 생활비 때문에 동시에 쉬기 어렵다면 꺼두세요."
            checked={input.allowOverlap ?? true}
            onChange={(allowOverlap) => set({ allowOverlap })}
          />
        </FieldGroup>
      }
    />
  );
}
