'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { calcCardSplit, type CardSplitInput } from '@/lib/calculators/card-split';
import { formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { buildShareQuery, pickDefined, qNum, qStr, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { FieldGroup, MoneyField, NumberField, ToggleField } from '@/components/ui/fields';
import { CardSplitDashboard, CardSplitStickyBar } from './CardSplitDashboard';

const MAN = 10000;

export function CardSplitTool({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<CardSplitInput>>({});

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      yearlySpend: qNum(sp, 'spend'),
      aSalary: qNum(sp, 'a'),
      bSalary: qNum(sp, 'b'),
      aLabel: qStr(sp, 'an'),
      bLabel: qStr(sp, 'bn'),
      milesPer1000: qNum(sp, 'mp'),
      wonPerMile: qNum(sp, 'mv'),
      annualFee: qNum(sp, 'fee'),
      married: qStr(sp, 'wed') === '1' ? true : qStr(sp, 'wed') === '0' ? false : undefined,
    });
  }, [hydrated]);

  const input = useMemo<CardSplitInput>(
    () => ({
      yearlySpend: 3600 * MAN,
      aSalary: 3500 * MAN,
      bSalary: 3200 * MAN,
      milesPer1000: 1,
      wonPerMile: 20,
      annualFee: 0,
      married: false,
      asOf: fallbackToday,
      ...fromLink,
      ...edits,
    }),
    [fallbackToday, fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<CardSplitInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => calcCardSplit(input), [input]);

  const shareQuery = buildShareQuery({
    spend: input.yearlySpend,
    a: input.aSalary,
    b: input.bSalary,
    an: input.aLabel,
    bn: input.bLabel,
    mp: input.milesPer1000,
    mv: input.wonPerMile,
    fee: input.annualFee,
    wed: input.married ? '1' : '0',
  });

  const shareText = outcome.ok
    ? `카드를 이렇게 나눠 쓰면 한 해에 ${formatManwon(outcome.result.value.netBenefit)}이 남아요. 누구 카드로 얼마를 쓸지 30초면 나옵니다.`
    : undefined;

  const v = outcome.ok ? outcome.result.value : null;

  /*
    대시보드가 끝나는 자리에 표식을 둔다. 이게 헤더 밑으로 넘어가면
    상단 요약 줄을 띄운다. 스크롤 위치를 직접 재는 것보다 싸고 정확하다.
  */
  const sentinel = useRef<HTMLDivElement>(null);

  const headline = v ? (
    <>
      <CardSplitDashboard v={v} />
      <div ref={sentinel} aria-hidden className="h-px" />
    </>
  ) : null;

  return (
    <>
      {v && <CardSplitStickyBar v={v} sentinelRef={sentinel} />}
      <CalcShell
        tool={tool}
        outcome={outcome}
        headline={headline}
        shareQuery={shareQuery}
        shareText={shareText}
        fromSharedLink={Object.keys(fromLink).length > 0}
        extra={
          v ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-[16px] font-bold text-ink">왜 이 사람, 이 금액인가</h2>
              <div className="flex flex-col gap-2.5">
                {[v.a, v.b]
                  .filter((p) => p.salary > 0)
                  .map((p) => (
                    <div
                      key={p.label}
                      className="rounded-[12px] border border-line bg-surface px-4 py-4"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[15px] font-bold text-ink">{p.label}</p>
                        <p className="tnum text-[12px] text-ink-faint">
                          연봉 {formatManwon(p.salary)} · 세율 {Math.round(p.marginalRate * 100)}%
                        </p>
                      </div>
                      {p.spend <= 0 ? (
                        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                          이 사람 카드는 쓰지 않는 게 낫습니다. 문턱(
                          {formatKRW(Math.round(p.threshold))})을 넘기기 어려워 공제가 안 붙어요.
                        </p>
                      ) : (
                        <dl className="mt-3 flex flex-col gap-1.5 text-[13px]">
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-ink-soft">공제가 시작되는 문턱</dt>
                            <dd className="tnum font-semibold text-ink">
                              {formatKRW(Math.round(p.threshold))}
                            </dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-ink-soft">받는 소득공제</dt>
                            <dd className="tnum font-semibold text-ink">
                              {formatKRW(Math.round(p.deduction))}
                              {p.cappedBy > 0 && (
                                <span className="ml-1 font-normal text-ink-faint">
                                  한도 {formatKRW(p.limit)}에서 잘림
                                </span>
                              )}
                            </dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-ink-soft">줄어드는 세금</dt>
                            <dd className="tnum font-semibold text-ink">
                              {formatKRW(Math.round(p.taxSaved))}
                            </dd>
                          </div>
                        </dl>
                      )}
                    </div>
                  ))}
              </div>
              <p className="rounded-[12px] border border-line bg-sunk px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-soft">
                <strong className="font-semibold text-ink">왜 이렇게 나오나요.</strong>{' '}
                최저사용금액은 공제율이 낮은 신용카드분부터 차감합니다. 그래서 신용카드로 문턱까지
                채우고 그 위를 체크카드로 쓰면, 공제는 그대로 두고 신용카드 혜택만 더 얻습니다.
                한도를 이미 채운 뒤로는 더 써도 공제가 안 늘어서 그때부터는 신용카드가 유리해요.
              </p>
            </section>
          ) : null
        }
        form={
          <FieldGroup>
            <MoneyField
              label="한 해에 카드로 쓸 생활비"
              hint="한 달 생활비 × 12예요. 보험료·교육비·관리비·통신비처럼 공제가 안 되는 건 빼고 넣어주세요."
              value={input.yearlySpend}
              placeholder="36000000"
              onChange={(yearlySpend) => set({ yearlySpend })}
            />
            <MoneyField
              label="내 연간 총급여"
              hint="세금 떼기 전 연봉이에요. 문턱과 세율이 이 금액으로 정해집니다."
              value={input.aSalary}
              placeholder="35000000"
              onChange={(aSalary) => set({ aSalary })}
            />
            <ToggleField
              label="혼인신고를 마쳤습니다"
              hint="카드 사용액이 합쳐지는지는 이 칸과 아래 총급여가 같이 정합니다. 사실혼·예비부부는 아직 해당되지 않아요."
              checked={input.married ?? false}
              onChange={(married) => set({ married })}
            />
            <MoneyField
              label="배우자(예비 배우자) 연간 총급여"
              hint="혼자시면 0을 넣고 위 칸을 꺼 두세요. 혼인신고를 했고 이 금액이 5,000,000원 이하면 두 분 카드 사용액이 합쳐집니다."
              value={input.bSalary}
              placeholder="32000000"
              onChange={(bSalary) => set({ bSalary })}
            />
            <NumberField
              label="1,000원당 쌓이는 마일리지"
              hint="카드 약관에 적혀 있어요. 마일리지 카드가 아니면 0으로 두세요."
              value={input.milesPer1000}
              min={0}
              max={10}
              unit="마일"
              onChange={(milesPer1000) => set({ milesPer1000 })}
            />
            <MoneyField
              label="1마일을 얼마로 칠까요"
              hint="이건 정답이 없습니다. 어느 노선을 어느 좌석으로 쓰느냐에 따라 10원도 30원도 됩니다. 보수적으로 보시려면 15원쯤으로 두세요."
              value={input.wonPerMile}
              placeholder="20"
              onChange={(wonPerMile) => set({ wonPerMile })}
            />
            <MoneyField
              label="신용카드 연회비 (두 장 합계)"
              hint="마일리지 카드는 연회비가 있습니다. 넣어야 진짜 남는 돈이 보여요."
              value={input.annualFee}
              placeholder="0"
              onChange={(annualFee) => set({ annualFee })}
            />
          </FieldGroup>
        }
      />
    </>
  );
}
