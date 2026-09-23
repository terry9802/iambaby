'use client';

import { useCallback, useMemo, useState } from 'react';
import { calcHomePurchase, type HomePurchaseInput } from '@/lib/calculators/home-purchase';
import { formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { buildShareQuery, pickDefined, qBool, qNum, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import {
  FieldGroup,
  MoneyField,
  NumberField,
  SegmentedField,
  ToggleField,
} from '@/components/ui/fields';

export function HomePurchaseTool({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<HomePurchaseInput>>({});

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      price: qNum(sp, 'p'),
      housesAfter: qNum(sp, 'h'),
      regulated: qBool(sp, 'reg'),
      areaSqm: qNum(sp, 'a'),
      firstHome: qBool(sp, 'first'),
      brokerFeeOverride: qNum(sp, 'bf'),
    });
  }, [hydrated]);

  const input = useMemo<HomePurchaseInput>(
    () => ({
      price: 500000000,
      housesAfter: 1,
      regulated: false,
      areaSqm: 84,
      asOf: fallbackToday,
      ...fromLink,
      ...edits,
    }),
    [fallbackToday, fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<HomePurchaseInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => calcHomePurchase(input), [input]);

  const shareQuery = buildShareQuery({
    p: input.price,
    h: input.housesAfter,
    reg: input.regulated,
    a: input.areaSqm,
    first: input.firstHome,
    bf: input.brokerFeeOverride,
  });

  const shareText = outcome.ok
    ? `${formatManwon(input.price ?? 0)}짜리 집을 사면 세금이랑 수수료로 ${formatManwon(outcome.result.value.extraTotal)}이 더 들어요. 집값만 보고 예산 짜면 잔금 날 모자랍니다.`
    : undefined;

  const headline = outcome.ok ? (
    <ResultHeadline
      label="집값 말고 더 있어야 하는 돈"
      value={outcome.result.value.extraTotal}
      sub={
        <>
          집값의{' '}
          <strong className="tnum font-bold text-ink">
            {(outcome.result.value.extraRate * 100).toFixed(1)}%
          </strong>
          예요. 다 합치면{' '}
          <strong className="tnum font-bold text-ink">
            {formatKRW(outcome.result.value.grandTotal)}
          </strong>
          가 있어야 합니다.
        </>
      }
    >
      <ResultAside>
        세금 <strong className="tnum font-semibold text-ink">{formatKRW(outcome.result.value.taxTotal)}</strong>
        , 중개보수{' '}
        <strong className="tnum font-semibold text-ink">
          {formatKRW(outcome.result.value.brokerFee + outcome.result.value.brokerFeeVat)}
        </strong>
        {outcome.result.value.reliefApplied > 0 && (
          <>
            . 생애최초 감면으로{' '}
            <strong className="tnum font-semibold text-good">
              {formatKRW(outcome.result.value.reliefApplied)}
            </strong>
            을 뺐어요
          </>
        )}
        .
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
      form={
        <FieldGroup>
          <MoneyField
            label="사려는 집값"
            hint="계약서에 적는 매매가예요."
            value={input.price}
            placeholder="500000000"
            onChange={(price) => set({ price })}
          />
          <NumberField
            label="사고 나면 우리 세대가 갖게 되는 집 수"
            hint="지금 사려는 이 집까지 포함해서 세어주세요. 부부는 한 세대로 봅니다."
            value={input.housesAfter}
            min={1}
            max={9}
            unit="채"
            onChange={(housesAfter) => set({ housesAfter })}
          />
          <NumberField
            label="전용면적"
            hint="85㎡ 이하면 농어촌특별세가 안 붙어요. 흔한 '국민평형' 84㎡가 딱 면제 대상입니다."
            value={input.areaSqm}
            min={10}
            max={300}
            unit="㎡"
            onChange={(areaSqm) => set({ areaSqm })}
          />
          <SegmentedField<string>
            label="조정대상지역인가요"
            hint="정부가 수시로 지정하고 풀어요. 계약 전에 관할 구청에 꼭 확인하세요."
            value={input.regulated ? 'yes' : 'no'}
            onChange={(v) => set({ regulated: v === 'yes' })}
            options={[
              { value: 'no', label: '아니요' },
              { value: 'yes', label: '조정대상지역' },
            ]}
          />
          <ToggleField
            label="태어나서 처음 사는 집이에요"
            hint="본인과 배우자 모두 집을 가진 적이 없어야 합니다. 취득세를 2,000,000원까지 깎아줘요."
            checked={input.firstHome ?? false}
            onChange={(firstHome) => set({ firstHome })}
          />
          {outcome.ok && (
            <MoneyField
              label="중개보수 (협의해서 정한 금액)"
              hint={`조례상 상한은 ${formatKRW(outcome.result.value.brokerFeeCeiling)}이에요. 이건 상한일 뿐이라 깎아달라고 하셔도 됩니다. 정해진 금액이 있으면 여기 넣어주세요.`}
              value={input.brokerFeeOverride ?? outcome.result.value.brokerFeeCeiling}
              placeholder={String(outcome.result.value.brokerFeeCeiling)}
              onChange={(brokerFeeOverride) => set({ brokerFeeOverride })}
            />
          )}
        </FieldGroup>
      }
    />
  );
}
