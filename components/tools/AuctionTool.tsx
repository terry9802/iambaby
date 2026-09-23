'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  auctionChecklist,
  auctionRule,
  calcAuction,
  failedRoundPrices,
  type AuctionInput,
} from '@/lib/calculators/auction';
import { formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { buildShareQuery, pickDefined, qBool, qNum, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import { FieldGroup, MoneyField, NumberField, SegmentedField } from '@/components/ui/fields';

export function AuctionTool({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<AuctionInput>>({});
  const [discount, setDiscount] = useState('0.2');

  const rule = useMemo(() => auctionRule(fallbackToday), [fallbackToday]);
  const checklist = useMemo(() => auctionChecklist(fallbackToday), [fallbackToday]);

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      appraised: qNum(sp, 'ap'),
      minimumPrice: qNum(sp, 'min'),
      bid: qNum(sp, 'bid'),
      areaSqm: qNum(sp, 'a'),
      housesAfter: qNum(sp, 'h'),
      regulated: qBool(sp, 'reg'),
      evictionCost: qNum(sp, 'ev'),
      unpaidDues: qNum(sp, 'du'),
    });
  }, [hydrated]);

  const input = useMemo<AuctionInput>(
    () => ({
      appraised: 600000000,
      minimumPrice: 400000000,
      bid: 450000000,
      areaSqm: 84,
      housesAfter: 1,
      evictionCost: 5000000,
      asOf: fallbackToday,
      ...fromLink,
      ...edits,
    }),
    [fallbackToday, fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<AuctionInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => calcAuction(input), [input]);

  const rounds = useMemo(
    () => failedRoundPrices(input.appraised ?? 0, Number(discount), 3),
    [input.appraised, discount],
  );

  const shareQuery = buildShareQuery({
    ap: input.appraised,
    min: input.minimumPrice,
    bid: input.bid,
    a: input.areaSqm,
    h: input.housesAfter,
    reg: input.regulated,
    ev: input.evictionCost,
    du: input.unpaidDues,
  });

  const shareText = outcome.ok
    ? `${formatManwon(input.bid ?? 0)}에 낙찰받으면 실제로는 ${formatManwon(outcome.result.value.grandTotal)}이 들어요. 세금이랑 명도비까지 세면 낙찰가가 다가 아닙니다.`
    : undefined;

  const headline = outcome.ok ? (
    <ResultHeadline
      label="낙찰받으면 실제로 드는 돈"
      value={outcome.result.value.grandTotal}
      sub={
        <>
          낙찰가 말고{' '}
          <strong className="tnum font-bold text-ink">
            {formatKRW(outcome.result.value.extraTotal)}
          </strong>
          이 더 듭니다.
          {outcome.result.value.vsAppraised !== null && (
            <>
              {' '}감정가의{' '}
              <strong className="tnum font-bold text-ink">
                {(outcome.result.value.vsAppraised * 100).toFixed(1)}%
              </strong>
              예요.
            </>
          )}
        </>
      }
    >
      <ResultAside>
        입찰할 때{' '}
        <strong className="tnum font-semibold text-ink">
          {formatKRW(outcome.result.value.deposit)}
        </strong>
        , 낙찰 뒤{' '}
        <span className="tnum font-bold text-alert">
          {outcome.result.value.paymentDeadlineDays}일
        </span>{' '}
        안에{' '}
        <strong className="tnum font-semibold text-ink">
          {formatKRW(outcome.result.value.balance)}
        </strong>
        . 못 내면 보증금을 잃습니다.
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
      extra={
        <div className="flex flex-col gap-4">
          {/* 돈보다 먼저 봐야 하는 것. 여기서 물리면 계산이 의미가 없다. */}
          <section className="rounded-[12px] border border-alert/25 bg-alert-soft px-4 py-4">
            <h2 className="text-[13.5px] font-semibold text-alert">
              입찰 전에 이건 꼭 확인하세요
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink">
              아래 중 하나라도 걸리면 낙찰가 외에 큰돈이 더 나갈 수 있습니다. 매각물건명세서와
              현황조사서를 읽으면 대부분 나와 있어요.
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {checklist.map((c) => (
                <li key={c.id} className="rounded-[8px] bg-surface px-3 py-2.5">
                  <p className="text-[13.5px] font-semibold text-ink">{c.title}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{c.body}</p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
                    확인처 — {c.where}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-alert/20 pt-3 text-[12px] leading-relaxed text-ink-soft">
              {rule.consult.note}
            </p>
          </section>

          {/* 유찰이 거듭되면 최저가가 어떻게 내려가는지 */}
          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <h2 className="text-[13.5px] font-semibold text-ink">유찰되면 최저가가 이렇게 내려갑니다</h2>
            <div className="mt-2.5">
              <SegmentedField<string>
                label="이 법원의 저감률"
                hint={rule.discountNote}
                value={discount}
                onChange={setDiscount}
                options={rule.discountOptions.map((o) => ({
                  value: String(o.rate),
                  label: o.label,
                }))}
              />
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {rounds.map((r) => (
                <li
                  key={r.round}
                  className="flex items-center justify-between gap-3 border-b border-line pb-1.5 last:border-b-0"
                >
                  <span className="text-[13px] text-ink-soft">
                    {r.round === 0 ? '최초 (감정가)' : `${r.round}회 유찰`}
                  </span>
                  <span className="tnum text-[13.5px] font-semibold text-ink">
                    {formatKRW(r.price)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      }
      form={
        <FieldGroup>
          <MoneyField
            label="감정평가액"
            hint="경매 공고에 적힌 감정가예요. 시세와는 다를 수 있습니다."
            value={input.appraised}
            placeholder="600000000"
            onChange={(appraised) => set({ appraised })}
          />
          <MoneyField
            label="이번 기일의 최저매각가격"
            hint="입찰보증금이 이 금액 기준으로 정해집니다. 낙찰가 기준이 아니에요."
            value={input.minimumPrice}
            placeholder="400000000"
            onChange={(minimumPrice) => set({ minimumPrice })}
          />
          <MoneyField
            label="얼마에 쓸 것인가"
            hint="최저매각가격 이상이어야 합니다."
            value={input.bid}
            placeholder="450000000"
            onChange={(bid) => set({ bid })}
          />
          <NumberField
            label="전용면적"
            hint="85㎡ 이하면 농어촌특별세가 안 붙습니다."
            value={input.areaSqm}
            min={10}
            max={300}
            unit="㎡"
            onChange={(areaSqm) => set({ areaSqm })}
          />
          <NumberField
            label="낙찰받으면 갖게 되는 집 수"
            hint="이 집까지 포함해서요. 다주택이면 취득세가 중과됩니다."
            value={input.housesAfter}
            min={1}
            max={9}
            unit="채"
            onChange={(housesAfter) => set({ housesAfter })}
          />
          <SegmentedField<string>
            label="조정대상지역인가요"
            value={input.regulated ? 'yes' : 'no'}
            onChange={(v) => set({ regulated: v === 'yes' })}
            options={[
              { value: 'no', label: '아니요' },
              { value: 'yes', label: '조정대상지역' },
            ]}
          />
          <MoneyField
            label="내보내는 데 들 돈 (이사비 등)"
            hint="지금 살고 있는 사람이 순순히 나가는 경우는 많지 않아요. 몇백만원을 얹어 주는 일이 흔합니다."
            value={input.evictionCost}
            placeholder="5000000"
            onChange={(evictionCost) => set({ evictionCost })}
          />
          <MoneyField
            label="떠안게 될 체납 관리비"
            hint="공용부분 체납액은 낙찰자가 냅니다. 관리사무소에 전화하면 알려줘요."
            value={input.unpaidDues}
            placeholder="0"
            onChange={(unpaidDues) => set({ unpaidDues })}
          />
        </FieldGroup>
      }
    />
  );
}
