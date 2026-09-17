'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  checkRestBenefits,
  type IncomeBracket,
  type Region,
  type RestBenefit,
  type RestBenefitsInput,
  type WorkPlace,
} from '@/lib/calculators/rest-benefits';
import { formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { Seeder, pendingExamples, resolveToday } from '@/lib/profile/seed';
import { buildShareQuery, pickDefined, qBool, qNum, qStr, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import { FieldGroup, NumberField, SegmentedField, ToggleField } from '@/components/ui/fields';
import { ConsultBox } from '@/components/ui/PhoneCopy';
import { InlineText } from '@/components/ui/InlineText';

const STATUS_CHIP = {
  open: { tone: 'bg-brand-soft text-brand-strong', text: '지금 신청할 수 있어요' },
  'not-yet': { tone: 'bg-sunk text-ink-soft', text: '아직 안 열렸어요' },
  closed: { tone: 'bg-danger-soft text-danger', text: '올해는 마감됐어요' },
  unknown: { tone: 'bg-alert-soft text-alert', text: '기간을 전화로 확인하세요' },
} as const;

function BenefitCard({ benefit }: { benefit: RestBenefit }) {
  const chip = STATUS_CHIP[benefit.applyStatus];
  return (
    <li className="flex flex-col gap-2 border-b border-line py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14.5px] font-bold text-ink">{benefit.name}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${chip.tone}`}>
          {chip.text}
        </span>
        {benefit.dDay !== null && benefit.dDay >= 0 && (
          <span className="tnum rounded-full bg-alert-soft px-2 py-0.5 text-[11.5px] font-semibold text-alert">
            D-{benefit.dDay}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] leading-relaxed text-ink-soft">{benefit.summary}</span>
        <span className="tnum shrink-0 text-right">
          <span className="block text-[16px] font-bold text-ink">
            {benefit.unit === 'month'
              ? `월 ${formatManwon(benefit.amount)}`
              : formatKRW(benefit.amount)}
          </span>
          {benefit.myCost > 0 && (
            <span className="block text-[11.5px] text-ink-faint">
              내 부담 {formatManwon(benefit.myCost)}
            </span>
          )}
        </span>
      </div>

      {benefit.bonusLabels.length > 0 && (
        <p className="text-[12px] text-brand-strong">{benefit.bonusLabels.join(' · ')}</p>
      )}

      <div className="rounded-[8px] bg-sunk px-3 py-2.5">
        <p className="text-[12.5px] leading-relaxed text-ink-soft">{benefit.applyNote}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
          신청: {benefit.applyAt} · {benefit.useBy}까지 사용
          {benefit.applyBy === 'company' && (
            <span className="font-semibold text-alert"> · 회사가 신청합니다</span>
          )}
        </p>
        <a
          href={benefit.applyUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-block text-[12px] font-medium text-brand-strong underline"
        >
          공식 누리집 열기
        </a>
      </div>

      <ul className="flex flex-col gap-1.5">
        {benefit.notes.map((note, i) => (
          <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
            <span
              aria-hidden
              className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-ink-faint"
            />
            <span>
              <InlineText text={note} />
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function RestBenefitsTool({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { profile, hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<RestBenefitsInput>>({});

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      birthYear: qNum(sp, 'by'),
      income: qStr(sp, 'inc') as IncomeBracket | undefined,
      workplace: qStr(sp, 'wp') as WorkPlace | undefined,
      region: qStr(sp, 'rg') as Region | undefined,
      disabled: qBool(sp, 'dis'),
    });
  }, [hydrated]);

  const seeded = useMemo(() => {
    const seeder = new Seeder<RestBenefitsInput>();
    seeder.pick('birthYear', hydrated ? profile.birthYear : undefined, {
      value: 1994,
      label: '태어난 해',
    });
    // 수도권/비수도권만 가르면 되므로 시/도 하나로 판단한다
    const sido = hydrated ? profile.residence?.sido : undefined;
    if (sido) {
      seeder.set('region', sido === 'seoul' || sido === 'gyeonggi' || sido === 'incheon'
        ? 'capital'
        : 'nonCapital');
    }
    return seeder;
  }, [hydrated, profile]);

  const today = resolveToday(hydrated, fallbackToday);

  const input: RestBenefitsInput = useMemo(
    () => ({
      ...seeded.build({ income: 'none', workplace: 'other', region: 'capital', disabled: false }),
      ...fromLink,
      ...edits,
      today,
    }),
    [seeded, fromLink, edits, today],
  );

  const outcome = useMemo(() => checkRestBenefits(input), [input]);

  const edit = useCallback((patch: Partial<RestBenefitsInput>) => {
    setEdits((prev) => ({ ...prev, ...patch }));
  }, []);

  const examples = pendingExamples(seeded.examples, { ...fromLink, ...edits });
  const shareQuery = buildShareQuery({
    by: input.birthYear,
    inc: input.income,
    wp: input.workplace,
    rg: input.region,
    dis: input.disabled,
  });

  const value = outcome.ok ? outcome.result.value : null;

  const shareText = value
    ? value.eligible.length === 0
      ? '쉬는 데 나라에서 보태주는 돈, 저는 해당되는 게 없더라고요. 조건 넣으면 30초 만에 나옵니다.'
      : `쉬는 데 나라에서 보태주는 돈이 1년에 ${formatManwon(value.totalNet)}이나 되네요. 조건만 넣으면 뭐가 되는지 바로 나옵니다.`
    : undefined;

  const headline = value ? (
    value.eligible.length > 0 ? (
      <ResultHeadline
        label="1년 동안 받을 수 있는 돈"
        value={value.totalNet}
        sub={
          <>
            {value.eligible.length}가지가 해당돼요.
            {value.totalCost > 0 && (
              <>
                {' '}
                이 중 <strong className="tnum font-bold text-ink">
                  {formatKRW(value.totalCost)}
                </strong>
                은 내가 내고 시작하는 돈입니다.
              </>
            )}
          </>
        }
      >
        <ResultAside>
          {value.openNow > 0 ? (
            <>
              이 중{' '}
              <strong className="font-bold text-brand-strong">{value.openNow}가지</strong>는 지금
              신청할 수 있어요. 아래에서 마감일을 확인해 주세요.
            </>
          ) : (
            <>
              지금 당장 신청할 수 있는 건 없습니다. 대부분 1~2월에 열리니 연초에 다시 확인해
              주세요.
            </>
          )}
        </ResultAside>
      </ResultHeadline>
    ) : (
      <ResultHeadline
        label="해당되는 지원"
        valueText="없어요"
        sub={
          <>
            쉬는 데 보태주는 국가 지원은 대부분 저소득층이나 특정 나이를 대상으로 합니다. 없는 걸
            있다고 말씀드릴 수는 없어요.
          </>
        }
      >
        <ResultAside>
          다만 <strong className="font-semibold text-ink">근로자 휴가지원사업</strong>은 회사가
          신청만 해주면 20만원을 내고 40만원을 받습니다. 중소기업에 다니신다면 총무·인사팀에 한 번
          물어볼 만해요.
        </ResultAside>
      </ResultHeadline>
    )
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
      extra={
        value ? (
          <ConsultBox
            title="어디에 물어야 할지 모를 때"
            lead={value.consult.note}
            phones={[
              {
                label: value.consult.label,
                number: value.consult.number,
                note: '어떤 지원이든 담당 기관을 찾아 연결해 줍니다.',
              },
            ]}
          />
        ) : null
      }
      detail={
        value ? (
          <>
            {value.eligible.length > 0 && (
              <section className="rounded-[12px] border border-line bg-surface px-4 py-2">
                <h2 className="pt-2 text-[14px] font-semibold text-ink">받을 수 있는 것</h2>
                <ul>
                  {value.eligible.map((b) => (
                    <BenefitCard key={b.id} benefit={b} />
                  ))}
                </ul>
              </section>
            )}

            {value.missed.length > 0 && (
              <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
                <h2 className="text-[14px] font-semibold text-ink">안 되는 것과 그 이유</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-faint">
                  헛걸음하지 않도록 왜 안 되는지도 적어둡니다. 조건이 바뀌면 다시 확인해 보세요.
                </p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {value.missed.map((m) => (
                    <li key={m.id} className="rounded-[8px] bg-sunk px-3 py-2.5">
                      <p className="text-[13px] font-semibold text-ink-soft">{m.name}</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
                        {m.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null
      }
      form={
        <FieldGroup>
          <NumberField
            label="태어난 해"
            value={input.birthYear}
            onChange={(v) => edit({ birthYear: v })}
            min={1930}
            max={2026}
            unit="년"
            autofilled={seeded.autofilled.has('birthYear') && !('birthYear' in edits)}
            hint="지원 대부분이 나이로 갈립니다. 만 나이가 아니라 태어난 해로 봐요."
          />
          <SegmentedField<IncomeBracket>
            label="소득 구분"
            value={input.income}
            onChange={(v) => edit({ income: v })}
            required
            options={[
              { value: 'none', label: '해당 없음' },
              { value: 'basic', label: '기초생활수급' },
              { value: 'nearpoor', label: '차상위 · 한부모' },
            ]}
            hint="쉼 지원은 저소득층 대상이 많아서 이 항목이 결과를 가장 크게 바꿉니다."
          />
          <SegmentedField<WorkPlace>
            label="다니는 회사"
            value={input.workplace}
            onChange={(v) => edit({ workplace: v })}
            options={[
              { value: 'sme', label: '중소기업 · 소상공인 등' },
              { value: 'other', label: '대기업 · 공공기관' },
              { value: 'none', label: '일하고 있지 않음' },
            ]}
            hint="중소기업·소상공인·비영리민간단체·사회복지시설 근로자만 근로자 휴가지원사업에 참여할 수 있어요."
          />
          <SegmentedField<Region>
            label="사는 곳"
            value={input.region}
            onChange={(v) => edit({ region: v })}
            options={[
              { value: 'capital', label: '수도권' },
              { value: 'nonCapital', label: '비수도권' },
            ]}
            autofilled={seeded.autofilled.has('region') && !('region' in edits)}
            hint="청년문화예술패스는 비수도권이 5만원 더 많습니다."
          />
          <ToggleField
            label="장애가 있어요"
            checked={input.disabled ?? false}
            onChange={(v) => edit({ disabled: v })}
            hint="스포츠강좌이용권은 장애인이면 소득과 관계없이 받고, 금액도 월 11만원으로 더 많습니다."
          />
        </FieldGroup>
      }
    />
  );
}
