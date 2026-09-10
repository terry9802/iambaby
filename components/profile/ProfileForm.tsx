'use client';

import { useState } from 'react';
import { listSeoulDistricts } from '@/lib/calculators/birth-grants';
import { toISODate } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import {
  EMPLOYMENT_TYPE_LABEL,
  profileCompletion,
  type EmploymentType,
} from '@/lib/profile/schema';
import {
  DateField,
  FieldGroup,
  MoneyField,
  NumberField,
  SegmentedField,
  SelectField,
  ToggleField,
} from '@/components/ui/fields';

const DISTRICTS = listSeoulDistricts(toISODate(new Date()));

export function ProfileForm() {
  const { profile, hydrated, update, reset, updatedAt } = useProfile();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!hydrated) {
    return (
      <div className="h-64 rounded-[12px] border border-line bg-surface" aria-hidden />
    );
  }

  const { filled, total } = profileCompletion(profile);
  const children = profile.children ?? [];

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-ink">
            {filled}/{total} 채웠어요
          </h2>
          {updatedAt && (
            <span className="tnum text-[11.5px] text-ink-faint">
              {new Date(updatedAt).toLocaleString('ko-KR', {
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              저장됨
            </span>
          )}
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          적는 즉시 이 브라우저에 저장돼요. 아는 것만 채우셔도 됩니다.
        </p>
      </section>

      <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
        <h2 className="mb-3.5 text-[14px] font-semibold text-ink">일과 소득</h2>
        <FieldGroup>
          <MoneyField
            label="월 통상임금"
            hint="기본급 + 매달 고정으로 나오는 수당. 육아휴직 급여, 출산휴가 급여가 전부 이 금액을 기준으로 정해져요."
            value={profile.income?.monthlyWage}
            placeholder="3,000,000"
            onChange={(monthlyWage) =>
              update({ income: { ...profile.income, monthlyWage } })
            }
          />
          <MoneyField
            label="연봉 (세전)"
            hint="지금은 계산에 쓰지 않지만, 앞으로 추가될 이직·퇴직 계산기에서 쓰입니다."
            value={profile.income?.annualSalary}
            placeholder="42,000,000"
            onChange={(annualSalary) =>
              update({ income: { ...profile.income, annualSalary } })
            }
          />
          <DateField
            label="입사일"
            hint="퇴직금·연차 계산에 쓰입니다."
            value={profile.employment?.joinDate}
            onChange={(joinDate) =>
              update({ employment: { ...profile.employment, joinDate } })
            }
          />
          <SegmentedField<EmploymentType>
            label="고용 형태"
            value={profile.employment?.employmentType}
            onChange={(employmentType) =>
              update({ employment: { ...profile.employment, employmentType } })
            }
            options={(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((v) => ({
              value: v,
              label: EMPLOYMENT_TYPE_LABEL[v],
            }))}
          />
        </FieldGroup>
      </section>

      <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
        <h2 className="mb-3.5 text-[14px] font-semibold text-ink">가족</h2>
        <FieldGroup>
          <SegmentedField<'single' | 'married'>
            label="혼인 상태"
            value={profile.maritalStatus}
            onChange={(maritalStatus) => update({ maritalStatus })}
            options={[
              { value: 'single', label: '미혼' },
              { value: 'married', label: '기혼' },
            ]}
          />
          {profile.maritalStatus === 'married' && (
            <MoneyField
              label="배우자 월 통상임금"
              hint="6+6 조합 최적화기에서 두 사람의 임금을 비교하는 데 씁니다."
              value={profile.spouse?.monthlyWage}
              placeholder="3,000,000"
              onChange={(monthlyWage) =>
                update({ spouse: { ...profile.spouse, monthlyWage } })
              }
            />
          )}
          <ToggleField
            label="한부모예요"
            hint="육아휴직 급여 첫 3개월 상한액이 300만원으로 올라갑니다."
            checked={profile.singleParent ?? false}
            onChange={(singleParent) => update({ singleParent })}
          />

          <div className="flex flex-col gap-2">
            <span className="text-[13.5px] font-semibold text-ink">
              아이 생년월일 (출산 예정일도 괜찮아요)
            </span>
            {children.length === 0 && (
              <p className="text-[12.5px] text-ink-faint">
                아직 없어요. 아래 버튼으로 추가하시면 지원금과 휴직 계산기가 자동으로 채워집니다.
              </p>
            )}
            {children.map((child, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label={`${i + 1}째 아이 생년월일`}
                  className="tnum w-full rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[15px] text-ink focus:border-brand focus:outline-none"
                  value={child.birthDate}
                  onChange={(e) => {
                    const next = [...children];
                    next[i] = { birthDate: e.target.value };
                    update({ children: next });
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-[8px] border border-line px-3 py-2.5 text-[13px] text-ink-soft hover:border-line-strong"
                  onClick={() => update({ children: children.filter((_, j) => j !== i) })}
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              type="button"
              className="self-start rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] font-medium text-brand-strong hover:border-line-strong"
              onClick={() =>
                update({ children: [...children, { birthDate: toISODate(new Date()) }] })
              }
            >
              아이 추가
            </button>
          </div>
        </FieldGroup>
      </section>

      <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
        <h2 className="mb-3.5 text-[14px] font-semibold text-ink">사는 곳</h2>
        <FieldGroup>
          <SegmentedField<string>
            label="시 · 도"
            hint="지자체 지원금은 지금 서울만 정리돼 있어요."
            value={profile.residence?.sido}
            onChange={(sido) => update({ residence: { sido, sigungu: undefined } })}
            options={[
              { value: 'seoul', label: '서울' },
              { value: 'other', label: '그 밖의 지역' },
            ]}
          />
          {profile.residence?.sido === 'seoul' && (
            <SelectField<string>
              label="자치구"
              placeholder="구를 골라 주세요"
              value={profile.residence?.sigungu}
              onChange={(sigungu) => update({ residence: { ...profile.residence, sigungu } })}
              options={DISTRICTS.map((d) => ({
                value: d.code,
                label: d.status === 'verified' ? d.name : `${d.name} (자체 지원 확인 중)`,
              }))}
            />
          )}
          <NumberField
            label="보유 주택 수"
            unit="채"
            min={0}
            max={9}
            hint="청약·대출 계산기에서 쓰입니다."
            value={profile.housing?.ownedHomes}
            onChange={(ownedHomes) => update({ housing: { ...profile.housing, ownedHomes } })}
          />
        </FieldGroup>
      </section>

      <section className="rounded-[12px] border border-line bg-sunk px-4 py-4">
        <h2 className="text-[13px] font-semibold text-ink">저장된 곳</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
          이 값들은 브라우저의 localStorage에만 있습니다. 서버로 보내는 코드가 아예 없어요. 브라우저
          기록을 지우면 함께 사라지고, 다른 기기에서는 다시 채우셔야 합니다.
        </p>
        {confirmReset ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-[8px] bg-danger px-3 py-2 text-[13px] font-semibold text-white"
              onClick={() => {
                reset();
                setConfirmReset(false);
              }}
            >
              정말 지울게요
            </button>
            <button
              type="button"
              className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink-soft"
              onClick={() => setConfirmReset(false)}
            >
              그만두기
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="mt-3 rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink-soft hover:border-line-strong"
            onClick={() => setConfirmReset(true)}
          >
            전부 지우기
          </button>
        )}
      </section>
    </div>
  );
}
