'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  calcGiftTax,
  listGiftRelationships,
  type GiftTaxInput,
} from '@/lib/calculators/gift-tax';
import { formatDate, formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { resolveToday } from '@/lib/profile/seed';
import { buildShareQuery, pickDefined, qBool, qNum, qStr, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import { DateField, FieldGroup, MoneyField, SelectField, ToggleField } from '@/components/ui/fields';

export function GiftTaxTool({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<GiftTaxInput>>({});

  const relationships = useMemo(() => listGiftRelationships(fallbackToday), [fallbackToday]);

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      amount: qNum(sp, 'amt'),
      relationship: qStr(sp, 'rel'),
      minor: qBool(sp, 'minor'),
      priorGifts: qNum(sp, 'prior'),
      marriageBirth: qBool(sp, 'mb'),
      marriageBirthUsed: qNum(sp, 'mbu'),
      giftDate: qStr(sp, 'd'),
    });
  }, [hydrated]);

  const input = useMemo<GiftTaxInput>(
    () => ({
      amount: 100000000,
      relationship: 'linealAscendant',
      giftDate: resolveToday(hydrated, fallbackToday),
      ...fromLink,
      ...edits,
    }),
    [hydrated, fallbackToday, fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<GiftTaxInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => calcGiftTax(input), [input]);

  const shareQuery = buildShareQuery({
    amt: input.amount,
    rel: input.relationship,
    minor: input.minor,
    prior: input.priorGifts,
    mb: input.marriageBirth,
    mbu: input.marriageBirthUsed,
    d: input.giftDate,
  });

  const shareText = outcome.ok
    ? outcome.result.value.finalTax > 0
      ? `${formatManwon(input.amount ?? 0)}을 받으면 증여세가 ${formatManwon(outcome.result.value.finalTax)}이에요. 얼마까지 세금 없이 받는지도 바로 나옵니다.`
      : `${formatManwon(input.amount ?? 0)}까지는 증여세가 0원이네요. 내 경우는 얼마까지인지 30초면 확인돼요.`
    : undefined;

  const headline = outcome.ok ? (
    <ResultHeadline
      label={outcome.result.value.finalTax > 0 ? '내야 하는 증여세' : '내야 하는 증여세가 없어요'}
      value={outcome.result.value.finalTax}
      sub={
        outcome.result.value.finalTax > 0 ? (
          <>
            받는 금액의{' '}
            <strong className="tnum font-bold text-ink">
              {(outcome.result.value.effectiveRate * 100).toFixed(1)}%
            </strong>
            예요. 기한 안에 신고해서 {formatKRW(outcome.result.value.filingCredit)}을 깎은 금액입니다.
          </>
        ) : (
          <>
            공제 한도 안이라 세금이 붙지 않습니다.{' '}
            {outcome.result.value.headroom > 0 && (
              <>
                앞으로{' '}
                <strong className="tnum font-bold text-ink">
                  {formatKRW(outcome.result.value.headroom)}
                </strong>
                까지 더 받아도 세금이 없어요.
              </>
            )}
          </>
        )
      }
    >
      {/* 이 계산기의 진짜 값어치는 금액보다 신고기한이다. 모르고 넘기면 가산세가 붙는다. */}
      {outcome.result.value.filingDueAt && (
        <ResultAside>
          {outcome.result.value.filingPassed ? (
            <>
              신고기한{' '}
              <strong className="font-semibold text-ink">
                {formatDate(outcome.result.value.filingDueAt)}
              </strong>
              이 지났어요. 지금이라도 신고하는 쪽이 가산세가 적습니다.
            </>
          ) : (
            <>
              신고기한은{' '}
              <strong className="font-semibold text-ink">
                {formatDate(outcome.result.value.filingDueAt)}
              </strong>
              까지. 오늘부터{' '}
              <span className="tnum font-bold text-alert">{outcome.result.value.filingDDay}일</span>{' '}
              남았어요.
            </>
          )}
        </ResultAside>
      )}
    </ResultHeadline>
  ) : null;

  const isLineal = input.relationship === 'linealAscendant';

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
            label="이번에 받는 금액"
            hint="현금이면 그 금액, 부동산이나 주식이면 증여일 기준 평가액을 넣어주세요."
            value={input.amount}
            placeholder="100000000"
            onChange={(amount) => set({ amount })}
          />
          <SelectField<string>
            label="준 사람과의 관계"
            hint="공제 한도가 관계마다 다릅니다."
            value={input.relationship}
            onChange={(relationship) => set({ relationship, marriageBirth: false })}
            options={relationships.map((r) => ({
              value: r.code,
              label: `${r.label} · ${formatKRW(r.deduction)}`,
            }))}
          />
          <MoneyField
            label="최근 10년 안에 같은 관계에서 이미 받은 금액"
            hint="아버지에게 받았고 이번엔 어머니에게 받는 거라면, 아버지에게 받은 금액을 여기 넣으세요. 둘 다 직계존속이라 한도를 함께 씁니다."
            value={input.priorGifts}
            placeholder="0"
            onChange={(priorGifts) => set({ priorGifts })}
          />
          <DateField
            label="증여받은 날 (받을 예정일도 괜찮아요)"
            hint="이 날이 속한 달의 말일부터 3개월이 신고기한이에요."
            value={input.giftDate}
            onChange={(giftDate) => set({ giftDate })}
          />
          <ToggleField
            label="받는 사람이 미성년자예요"
            hint="만 19세 미만이면 직계존속 공제가 20,000,000원으로 줄어듭니다."
            checked={input.minor ?? false}
            onChange={(minor) => set({ minor })}
          />
          {isLineal && (
            <>
              <ToggleField
                label="결혼이나 출산 전후 2년 안이에요"
                hint="혼인신고일 전후 2년, 또는 아이 출생·입양신고일부터 2년 안에 부모·조부모에게 받으면 100,000,000원을 더 공제받습니다."
                checked={input.marriageBirth ?? false}
                onChange={(marriageBirth) => set({ marriageBirth })}
              />
              {input.marriageBirth && (
                <MoneyField
                  label="혼인 · 출산 공제를 예전에 이미 쓴 금액"
                  hint="결혼할 때 쓰고 아이 낳을 때 또 쓰는 게 아니라, 둘을 합쳐 평생 100,000,000원이 한도입니다."
                  value={input.marriageBirthUsed}
                  placeholder="0"
                  onChange={(marriageBirthUsed) => set({ marriageBirthUsed })}
                />
              )}
            </>
          )}
        </FieldGroup>
      }
    />
  );
}
