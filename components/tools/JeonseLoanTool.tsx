'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  checkNewlywedJeonseLoan,
  type JeonseLoanInput,
  type Region,
} from '@/lib/calculators/newlywed-jeonse-loan';
import { formatKRW, formatManwon, formatPercent } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { buildShareQuery, pickDefined, qBool, qNum, qStr, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import {
  FieldGroup,
  MoneyField,
  NumberField,
  PercentField,
  SegmentedField,
  ToggleField,
} from '@/components/ui/fields';
import { ConsultBox } from '@/components/ui/PhoneCopy';
import { Icon } from '@/components/ui/Icon';

export function JeonseLoanTool({ tool }: { tool: Tool }) {
  const { profile, hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<JeonseLoanInput>>({});

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    const region = qStr(sp, 'rg');
    return pickDefined({
      deposit: qNum(sp, 'dep'),
      householdIncome: qNum(sp, 'inc'),
      netAsset: qNum(sp, 'asset'),
      marriedYears: qNum(sp, 'yrs'),
      marryingSoon: qBool(sp, 'soon'),
      noHome: qBool(sp, 'nh'),
      region: region === 'capital' || region === 'other' ? (region as Region) : undefined,
      children: qNum(sp, 'kids'),
      eContract: qBool(sp, 'ec'),
      rateOverride: qNum(sp, 'rate'),
    });
  }, [hydrated]);

  const seeded = useMemo<JeonseLoanInput>(() => {
    const base: JeonseLoanInput = {
      deposit: 300_000_000,
      householdIncome: 60_000_000,
      netAsset: 50_000_000,
      marriedYears: 2,
      noHome: true,
      region: 'capital',
      children: 0,
    };
    if (!hydrated) return base;
    return {
      ...base,
      ...(profile.income?.annualSalary
        ? {
            householdIncome:
              profile.income.annualSalary + (profile.spouse?.monthlyWage ?? 0) * 12,
          }
        : {}),
      ...(profile.children?.length ? { children: profile.children.length } : {}),
      ...(profile.housing?.ownedHomes !== undefined
        ? { noHome: profile.housing.ownedHomes === 0 }
        : {}),
    };
  }, [hydrated, profile]);

  const input = useMemo(
    () => ({ ...seeded, ...fromLink, ...edits }),
    [seeded, fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<JeonseLoanInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => checkNewlywedJeonseLoan(input), [input]);
  const shareQuery = buildShareQuery({
    dep: input.deposit,
    inc: input.householdIncome,
    asset: input.netAsset,
    yrs: input.marriedYears,
    soon: input.marryingSoon,
    nh: input.noHome,
    rg: input.region,
    kids: input.children,
    ec: input.eContract,
    rate: input.rateOverride,
  });

  const shareText = outcome.ok
    ? outcome.result.value.eligible
      ? `버팀목 전세자금대출로 ${formatManwon(outcome.result.value.maxLoan)}까지 빌릴 수 있어요. 내 돈은 ${formatManwon(outcome.result.value.ownFunds)}만 있으면 됩니다.`
      : '신혼부부 전세자금대출, 어떤 요건에서 걸리는지 한 화면으로 봐요.'
    : undefined;

  const headline = outcome.ok ? (
    outcome.result.value.eligible ? (
      <ResultHeadline
        label="빌릴 수 있는 금액"
        value={outcome.result.value.maxLoan}
        sub={
          <>
            내가 따로 마련할 돈은{' '}
            <strong className="tnum font-bold text-ink">
              {formatKRW(outcome.result.value.ownFunds)}
            </strong>
            이에요.
          </>
        }
      >
        <ResultAside>
          금리는 연 {formatPercent(outcome.result.value.rateMin)} ~{' '}
          {formatPercent(outcome.result.value.rateMax)} 사이이고, 매달 내는 이자는{' '}
          <span className="tnum font-semibold text-ink">
            {formatKRW(outcome.result.value.monthlyInterestMin)} ~{' '}
            {formatKRW(outcome.result.value.monthlyInterestMax)}
          </span>{' '}
          정도입니다.
        </ResultAside>
      </ResultHeadline>
    ) : (
      <ResultHeadline
        label="이 조건으로는 받을 수 없어요"
        valueText="자격 미달"
        sub={<>아래에서 어떤 요건이 걸렸는지 확인하시고, 값을 바꿔보세요.</>}
      />
    )
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
          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <h2 className="text-[14px] font-semibold text-ink">요건 다섯 가지</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
              하나라도 못 채우면 이 상품은 받을 수 없습니다.
            </p>
            <ul className="mt-3 flex flex-col">
              {outcome.result.value.checks.map((check) => (
                <li
                  key={check.label}
                  className="flex items-start gap-2.5 border-b border-line py-2.5 last:border-b-0"
                >
                  <span
                    className={
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ' +
                      (check.passed ? 'bg-good-soft text-good' : 'bg-danger-soft text-danger')
                    }
                  >
                    <Icon name={check.passed ? 'check' : 'close'} size={11} strokeWidth={2.5} />
                  </span>
                  <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[13.5px] font-medium text-ink">{check.label}</span>
                    <span className="tnum text-[12.5px] text-ink-soft">{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null
      }
      extra={
        <ConsultBox
          title="금리는 은행에서 확정됩니다"
          lead="부부합산 소득과 보증금 구간에 따라 정해지는 표가 따로 있어, 여기서는 범위로만 보여드립니다. 상담에서 안내받은 금리가 있으면 아래에 넣어 다시 계산해 보세요."
          phones={[
            {
              label: '주택도시보증공사 콜센터',
              number: '1566-9009',
              note: '자산 심사와 대출 조건 상담은 여기가 가장 정확합니다.',
            },
          ]}
        />
      }
      form={
        <FieldGroup>
          <MoneyField
            label="전세 보증금"
            value={input.deposit}
            placeholder="300,000,000"
            onChange={(deposit) => set({ deposit })}
          />
          <SegmentedField<Region>
            label="어디인가요"
            hint="수도권은 서울·경기·인천입니다. 한도와 보증금 상한이 달라져요."
            value={input.region}
            onChange={(region) => set({ region })}
            options={[
              { value: 'capital', label: '수도권' },
              { value: 'other', label: '그 밖의 지역' },
            ]}
          />
          <MoneyField
            label="부부합산 연소득 (세전)"
            hint="두 사람 연봉을 더한 금액이에요. 75,000,000원을 넘으면 이 상품은 받을 수 없습니다."
            value={input.householdIncome}
            placeholder="60,000,000"
            onChange={(householdIncome) => set({ householdIncome })}
          />
          <MoneyField
            label="부부합산 순자산"
            hint="예금, 주식, 자동차 등을 더하고 빚을 뺀 금액이에요. 345,000,000원 이하여야 합니다."
            value={input.netAsset}
            placeholder="50,000,000"
            onChange={(netAsset) => set({ netAsset })}
          />
          <NumberField
            label="혼인 기간"
            unit="년"
            min={0}
            max={20}
            hint="7년 이내여야 합니다. 아직 결혼 전이면 0으로 두고 아래를 켜주세요."
            value={input.marriedYears}
            onChange={(marriedYears) => set({ marriedYears })}
          />
          <ToggleField
            label="3개월 이내에 결혼할 예정이에요"
            checked={input.marryingSoon ?? false}
            onChange={(marryingSoon) => set({ marryingSoon })}
          />
          <ToggleField
            label="부부 둘 다 집이 없어요"
            hint="무주택 세대주여야 받을 수 있습니다."
            checked={input.noHome ?? true}
            onChange={(noHome) => set({ noHome })}
          />
          <NumberField
            label="자녀 수"
            unit="명"
            min={0}
            max={5}
            hint="자녀가 있으면 금리가 내려갑니다."
            value={input.children}
            onChange={(children) => set({ children })}
          />
          <ToggleField
            label="부동산 전자계약으로 할 거예요"
            hint="금리가 0.1%p 내려갑니다."
            checked={input.eContract ?? false}
            onChange={(eContract) => set({ eContract })}
          />
          <PercentField
            label="은행에서 안내받은 금리 (연)"
            hint="상담 전이면 비워두세요. 비워두면 연 1.9~3.3% 범위로 보여드립니다."
            value={input.rateOverride}
            placeholder="상담 전이면 비워두세요"
            onChange={(rateOverride) => set({ rateOverride })}
          />
        </FieldGroup>
      }
    />
  );
}
