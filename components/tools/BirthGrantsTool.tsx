'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  checkBirthGrants,
  formatDDay,
  listSeoulDistricts,
  type BirthGrantsInput,
  type BirthOrder,
  type ResolvedGrant,
} from '@/lib/calculators/birth-grants';
import { formatKRW, formatManwon } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import { Seeder, pendingExamples, resolveToday } from '@/lib/profile/seed';
import { buildShareQuery, pickDefined, qNum, qStr, readShareQuery } from '@/lib/share';
import type { Tool } from '@/lib/tools';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import {
  DateField,
  FieldGroup,
  MoneyField,
  SegmentedField,
  SelectField,
} from '@/components/ui/fields';
import { ConsultBox } from '@/components/ui/PhoneCopy';

function DeadlineChip({ grant }: { grant: ResolvedGrant }) {
  if (!grant.deadline) return null;
  const { status } = grant.deadline;
  const tone =
    status === 'passed'
      ? 'bg-danger-soft text-danger'
      : status === 'not-yet'
        ? 'bg-sunk text-ink-soft'
        : grant.deadline.dDay <= 30
          ? 'bg-alert-soft text-alert'
          : 'bg-brand-soft text-brand-strong';
  const text =
    status === 'not-yet'
      ? `${grant.deadline.opensAt}부터 신청`
      : `${formatDDay(grant.deadline)} · ${grant.deadline.dueAt}까지`;
  return (
    <span className={`tnum rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${tone}`}>
      {text}
    </span>
  );
}

function GrantCard({ grant }: { grant: ResolvedGrant }) {
  return (
    <li className="flex flex-col gap-1.5 border-b border-line py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-faint">
          {grant.scopeLabel}
        </span>
        <span className="text-[14px] font-semibold text-ink">{grant.name}</span>
        <DeadlineChip grant={grant} />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] leading-relaxed text-ink-soft">{grant.description}</span>
        <span className="tnum shrink-0 text-[15px] font-bold text-ink">
          {formatKRW(grant.totalAmount)}
        </span>
      </div>
      {grant.monthlyBreakdown && (
        <p className="tnum text-[12px] text-ink-faint">
          {grant.monthlyBreakdown
            .map(
              (b) =>
                `생후 ${b.fromMonth}~${b.toMonth}개월 월 ${formatManwon(b.amount)}`,
            )
            .join(' · ')}
        </p>
      )}
      {grant.deadlineNote && (
        <p className="text-[12px] leading-relaxed text-ink-soft">{grant.deadlineNote}</p>
      )}
      <p className="text-[12px] text-ink-faint">
        신청처: {grant.applyAt}
        {grant.applyUrl && (
          <>
            {' · '}
            <a
              href={grant.applyUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand-strong underline underline-offset-2"
            >
              바로가기
            </a>
          </>
        )}
      </p>
    </li>
  );
}

export function BirthGrantsTool({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { profile, hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<BirthGrantsInput>>({});

  const seeded = useMemo(() => {
    const seeder = new Seeder<BirthGrantsInput>();
    const children = hydrated ? (profile.children ?? []) : [];
    seeder.pick('childBirthDate', children[children.length - 1]?.birthDate, {
      value: resolveToday(hydrated, fallbackToday),
      label: '오늘 태어난 아이',
    });
    seeder.set('sido', hydrated ? profile.residence?.sido : undefined);
    seeder.set('sigungu', hydrated ? profile.residence?.sigungu : undefined);

    const order: BirthOrder =
      children.length >= 3 ? 'thirdOrMore' : children.length === 2 ? 'second' : 'first';
    return {
      input: seeder.build({ birthOrder: order, sido: 'seoul' }),
      autofilled: seeder.autofilled,
      examples: seeder.examples,
    };
  }, [profile, hydrated, fallbackToday]);

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    const order = qStr(sp, 'order');
    return pickDefined({
      childBirthDate: qStr(sp, 'birth'),
      birthOrder:
        order === 'first' || order === 'second' || order === 'thirdOrMore'
          ? (order as BirthOrder)
          : undefined,
      sido: qStr(sp, 'sido'),
      sigungu: qStr(sp, 'gu'),
      districtAmount: qNum(sp, 'guAmt'),
    });
  }, [hydrated]);

  const input = useMemo(
    () => ({ ...seeded.input, ...fromLink, ...edits }),
    [seeded, fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<BirthGrantsInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );
  const examples = pendingExamples(seeded.examples, { ...fromLink, ...edits });
  const autofilled = new Set(
    [...seeded.autofilled].filter((field) => !(field in fromLink) && !(field in edits)),
  );
  const shareQuery = buildShareQuery({
    birth: input.childBirthDate,
    order: input.birthOrder,
    sido: input.sido,
    gu: input.sigungu,
    guAmt: input.districtAmount,
  });

  const districts = useMemo(
    () => listSeoulDistricts(input.childBirthDate ?? fallbackToday),
    [input.childBirthDate, fallbackToday],
  );

  const outcome = useMemo(() => checkBirthGrants(input), [input]);

  const headline = outcome.ok ? (
    <ResultHeadline
      label="첫 1년 동안 통장에 들어오는 돈"
      value={outcome.result.value.firstYearAmount}
      sub={
        <>
          아동수당처럼 몇 해에 걸쳐 나오는 것까지 모두 더하면{' '}
          <strong className="tnum font-bold text-ink">
            {formatKRW(outcome.result.value.totalAmount)}
          </strong>
          이에요.
        </>
      }
    >
      {outcome.result.value.urgent.length > 0 && (
        <ResultAside>
          <span className="font-semibold text-alert">
            30일 안에 신청해야 하는 항목이 {outcome.result.value.urgent.length}개 있어요.
          </span>{' '}
          {outcome.result.value.urgent.map((g) => g.name).join(', ')} — 기한을 넘기면 그 전 달치는
          받을 수 없습니다.
        </ResultAside>
      )}
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
      extra={
        outcome.ok && outcome.result.value.districtStatus === 'unverified' ? (
          <ConsultBox
            title={`${outcome.result.value.districtName ?? '이 자치구'}는 전화로 확인하는 게 빠릅니다`}
            lead={`구청 홈페이지에서 금액을 찾지 못했습니다. 지어낸 숫자를 보여드리는 대신 물어보실 곳을 안내해 드려요. 확인된 8개 구 평균은 ${formatManwon(outcome.result.value.districtEstimate)} 정도입니다.`}
            phones={[
              {
                label: '서울 다산콜센터',
                number: '120',
                note: '서울 전체와 자치구 민원을 함께 안내합니다. "출산지원금 있나요"라고 물으시면 됩니다.',
              },
            ]}
          />
        ) : null
      }
      detail={
        outcome.ok ? (
          <section className="rounded-[12px] border border-line bg-surface px-4 py-2">
            <h2 className="pt-2 text-[14px] font-semibold text-ink">받을 수 있는 지원</h2>
            <ul>
              {outcome.result.value.grants.map((g) => (
                <GrantCard key={`${g.scope}-${g.id}`} grant={g} />
              ))}
            </ul>
            {outcome.result.value.extraNotes.length > 0 && (
              <div className="border-t border-line py-3">
                <h3 className="text-[12.5px] font-semibold text-ink">합계에는 없지만 알아두실 것</h3>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {outcome.result.value.extraNotes.map((n, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                      <span className="shrink-0 font-medium text-ink-faint">{n.scope}</span>
                      <span>{n.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {outcome.result.value.districtStatus === 'unverified' && (
              <p className="border-t border-line py-3 text-[12.5px] leading-relaxed text-ink-soft">
                {outcome.result.value.districtName}의 자체 지원은 공식 출처로 확인하지 못해 합계에
                넣지 않았어요.{' '}
                {outcome.result.value.districtLookupUrl && (
                  <a
                    href={outcome.result.value.districtLookupUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-brand-strong underline underline-offset-2"
                  >
                    정부24 지역별 조회에서 확인하기
                  </a>
                )}
              </p>
            )}
          </section>
        ) : null
      }
      form={
        <FieldGroup>
          <DateField
            label="자녀 출생일 (출산 예정일도 괜찮아요)"
            hint="신청 기한이 전부 출생일 기준이라 이 날짜로 D-day를 세어드려요."
            value={input.childBirthDate}
            autofilled={autofilled.has('childBirthDate')}
            onChange={(childBirthDate) => set({ childBirthDate })}
          />
          <SegmentedField<BirthOrder>
            label="이 아이는 몇째인가요"
            value={input.birthOrder}
            onChange={(birthOrder) => set({ birthOrder })}
            options={[
              { value: 'first', label: '첫째' },
              { value: 'second', label: '둘째' },
              { value: 'thirdOrMore', label: '셋째 이상' },
            ]}
          />
          <SegmentedField<string>
            label="사는 지역"
            hint="지금은 서울만 정리돼 있어요. 다른 지역은 정부24 링크로 안내해 드립니다."
            value={input.sido}
            autofilled={autofilled.has('sido')}
            onChange={(sido) => set({ sido, sigungu: undefined })}
            options={[
              { value: 'seoul', label: '서울' },
              { value: 'other', label: '그 밖의 지역' },
            ]}
          />
          {input.sido === 'seoul' && (
            <SelectField<string>
              label="자치구"
              placeholder="구를 골라 주세요"
              value={input.sigungu}
              autofilled={autofilled.has('sigungu')}
              onChange={(sigungu) => set({ sigungu })}
              options={districts.map((d) => ({
                value: d.code,
                label: d.status === 'verified' ? d.name : `${d.name} (자체 지원 확인 중)`,
              }))}
            />
          )}
          {input.sido === 'seoul' && outcome.ok && outcome.result.value.districtStatus === 'unverified' && (
            <MoneyField
              label="구청에서 알려준 금액"
              hint={`전화로 확인하셨으면 넣어주세요. 합계에 함께 더해 드립니다. 확인된 구들의 평균은 ${formatManwon(outcome.result.value.districtEstimate)} 정도예요.`}
              value={input.districtAmount}
              placeholder={String(outcome.result.value.districtEstimate)}
              onChange={(districtAmount) => set({ districtAmount })}
            />
          )}
        </FieldGroup>
      }
    />
  );
}
