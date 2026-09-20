'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  calcSocialDues,
  type AttendanceKey,
  type ClosenessKey,
  type FrequencyKey,
  type OccasionKey,
  type RelationKey,
  type SocialDuesInput,
  type VenueKey,
} from '@/lib/calculators/social-dues';
import { formatKRW, formatManwon } from '@/lib/format';
import type { Tool } from '@/lib/tools';
import { buildShareQuery, pickDefined, qNum, qStr, readShareQuery } from '@/lib/share';
import { useProfile } from '@/lib/profile/context';
import { CalcShell } from '@/components/calculator/CalcShell';
import { ResultAside, ResultHeadline } from '@/components/calculator/ResultHeadline';
import {
  FieldGroup,
  MoneyField,
  NumberField,
  SegmentedField,
  SelectField,
} from '@/components/ui/fields';

const RELATIONS: { value: RelationKey; label: string }[] = [
  { value: 'family', label: '가족 · 가까운 친척' },
  { value: 'closeFriend', label: '오래 본 친한 친구' },
  { value: 'friend', label: '그냥 아는 친구' },
  { value: 'teamColleague', label: '같은 팀 직장 동료' },
  { value: 'otherColleague', label: '다른 팀 직장 동료' },
  { value: 'work', label: '거래처 · 업무로 아는 사이' },
  { value: 'club', label: '동호회 · 모임 사람' },
];

export function SocialDuesTool({ tool }: { tool: Tool }) {
  const { hydrated } = useProfile();
  const [edits, setEdits] = useState<Partial<SocialDuesInput>>({});

  const fromLink = useMemo(() => {
    const sp = readShareQuery(hydrated);
    return pickDefined({
      occasion: qStr(sp, 'o') as OccasionKey | undefined,
      relation: qStr(sp, 'r') as RelationKey | undefined,
      frequency: qStr(sp, 'f') as FrequencyKey | undefined,
      closeness: qStr(sp, 'c') as ClosenessKey | undefined,
      attendance: qStr(sp, 'a') as AttendanceKey | undefined,
      venue: qStr(sp, 'v') as VenueKey | undefined,
      partySize: qNum(sp, 'n'),
      receivedBefore: qNum(sp, 'got'),
    });
  }, [hydrated]);

  const input = useMemo<SocialDuesInput>(
    () => ({
      occasion: 'wedding',
      relation: 'teamColleague',
      frequency: 'fewTimesYear',
      closeness: 'normal',
      attendance: 'attendMeal',
      venue: 'normal',
      partySize: 1,
      ...fromLink,
      ...edits,
    }),
    [fromLink, edits],
  );
  const set = useCallback(
    (patch: Partial<SocialDuesInput>) => setEdits((prev) => ({ ...prev, ...patch })),
    [],
  );

  const outcome = useMemo(() => calcSocialDues(input), [input]);
  const shareQuery = buildShareQuery({
    o: input.occasion,
    r: input.relation,
    f: input.frequency,
    c: input.closeness,
    a: input.attendance,
    v: input.venue,
    n: input.partySize,
    got: input.receivedBefore,
  });

  const shareText = outcome.ok
    ? `이 관계라면 ${outcome.result.value.occasionLabel}은 ${formatManwon(outcome.result.value.recommended)}이 무난해요. 너무 적지도 많지도 않은 선은 ${formatManwon(outcome.result.value.min)}에서 ${formatManwon(outcome.result.value.max)} 사이입니다.`
    : undefined;

  const headline = outcome.ok ? (
    <ResultHeadline
      label={`이 정도면 무난한 ${outcome.result.value.occasionLabel}`}
      value={outcome.result.value.recommended}
      sub={
        <>
          너무 적지도 많지도 않은 선은{' '}
          <strong className="tnum font-semibold text-ink">
            {formatKRW(outcome.result.value.min)} ~ {formatKRW(outcome.result.value.max)}
          </strong>{' '}
          사이예요.
        </>
      }
    >
      <ResultAside>
        {outcome.result.value.reciprocityFloor > 0 ? (
          <>
            그 사람이 나에게 {formatKRW(outcome.result.value.reciprocityFloor)}을 냈다는 게 가장 큰
            기준이 됐어요. 받은 만큼은 돌려주는 쪽이 마음이 편합니다.
          </>
        ) : outcome.result.value.mealFloor > 0 ? (
          <>
            식사하시는 분이 있어 식대 {formatKRW(outcome.result.value.mealFloor)}을 밑돌지 않게
            잡았어요.
          </>
        ) : (
          <>참석하지 않으시니 식대 부담은 빼고 관계만 보고 계산했어요.</>
        )}
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
          <SegmentedField<OccasionKey>
            label="어떤 자리인가요"
            value={input.occasion}
            onChange={(occasion) => set({ occasion })}
            options={[
              { value: 'wedding', label: '결혼식' },
              { value: 'funeral', label: '장례식' },
              { value: 'firstBirthday', label: '돌잔치' },
            ]}
          />
          <SelectField<RelationKey>
            label="그 사람과 어떤 사이인가요"
            value={input.relation}
            onChange={(relation) => relation && set({ relation })}
            options={RELATIONS}
          />
          <SegmentedField<FrequencyKey>
            label="얼마나 자주 보나요"
            value={input.frequency}
            onChange={(frequency) => set({ frequency })}
            options={[
              { value: 'weekly', label: '주 1회 이상' },
              { value: 'monthly', label: '월 1회쯤' },
              { value: 'fewTimesYear', label: '연 몇 번' },
              { value: 'rare', label: '몇 년 만' },
            ]}
          />
          <SegmentedField<ClosenessKey>
            label="마음의 거리는 어떤가요"
            hint="자주 보는 것과 가까운 것은 다릅니다. 매일 보는 옆자리 동료가 먼 사이일 수도 있어요."
            value={input.closeness}
            onChange={(closeness) => set({ closeness })}
            options={[
              { value: 'close', label: '속 얘기까지' },
              { value: 'normal', label: '적당히 편한' },
              { value: 'distant', label: '인사만 하는' },
            ]}
          />
          <SegmentedField<AttendanceKey>
            label="가시나요"
            value={input.attendance}
            onChange={(attendance) => set({ attendance })}
            options={[
              { value: 'attendMeal', label: '가서 식사도' },
              { value: 'attendNoMeal', label: '가지만 식사는 안 함' },
              { value: 'absent', label: '봉투만' },
            ]}
          />
          {input.attendance === 'attendMeal' && (
            <>
              <SegmentedField<VenueKey>
                label="어떤 곳인가요"
                value={input.venue}
                onChange={(venue) => set({ venue })}
                options={[
                  { value: 'normal', label: '일반 예식장·장례식장' },
                  { value: 'hotel', label: '호텔' },
                ]}
              />
              <NumberField
                label="나까지 몇 명이 가나요"
                unit="명"
                min={1}
                max={10}
                value={input.partySize}
                onChange={(partySize) => set({ partySize })}
              />
            </>
          )}
          <MoneyField
            label="이 사람이 내 경조사 때 냈던 금액"
            hint="기억나신다면 꼭 넣어주세요. 계산보다 이게 더 강한 기준입니다. 없으면 비워두시면 돼요."
            value={input.receivedBefore}
            placeholder="비워두셔도 됩니다"
            onChange={(receivedBefore) => set({ receivedBefore })}
          />
        </FieldGroup>
      }
    />
  );
}
