'use client';

import { useMemo, useState } from 'react';
import { listSeoulDistricts } from '@/lib/calculators/birth-grants';
import { toISODate } from '@/lib/format';
import { useProfile } from '@/lib/profile/context';
import {
  EMPLOYMENT_TYPE_LABEL,
  profileCompletion,
  type EmploymentType,
  type Profile,
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
import { Icon } from '@/components/ui/Icon';

const DISTRICTS = listSeoulDistricts(toISODate(new Date()));

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      {lead && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{lead}</p>}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

export function ProfileForm() {
  const { profile, hydrated, replace, reset, updatedAt } = useProfile();

  // 저장 버튼을 누르기 전까지는 화면에서만 고쳐지고 저장소에는 손대지 않는다.
  const [draft, setDraft] = useState<Profile | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const current = draft ?? profile;
  const dirty = useMemo(
    () => draft !== null && JSON.stringify(draft) !== JSON.stringify(profile),
    [draft, profile],
  );

  const edit = (patch: Partial<Profile>) => {
    setDraft({ ...current, ...patch });
    setJustSaved(false);
  };

  const save = () => {
    if (!draft) return;
    replace(draft);
    setDraft(null);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 3000);
  };

  if (!hydrated) {
    return <div className="h-64 rounded-[12px] border border-line bg-surface" aria-hidden />;
  }

  const { filled, total } = profileCompletion(current);
  const children = current.children ?? [];
  const married = current.maritalStatus === 'married';

  return (
    <div className="flex flex-col gap-4 pb-24">
      <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-ink">
            {filled}/{total} 채웠어요
          </h2>
          {updatedAt && !dirty && (
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
          <strong className="font-semibold text-ink">필수</strong> 표시가 붙은 것만 채우셔도 대부분의
          계산기가 돌아가요. 나머지는 채우면 더 정확해지는 값입니다.
        </p>
      </section>

      <Section
        title="꼭 필요한 것"
        lead="이 세 가지가 계산기 대부분의 기준이 됩니다."
      >
        <FieldGroup>
          <MoneyField
            label="월 통상임금"
            required
            hint="기본급에 매달 고정으로 나오는 수당을 더한 금액이에요. 성과급처럼 들쭉날쭉한 항목은 뺍니다. 육아휴직 급여와 출산휴가 급여가 전부 이 금액으로 정해져요."
            value={current.income?.monthlyWage}
            placeholder="3,000,000"
            onChange={(monthlyWage) => edit({ income: { ...current.income, monthlyWage } })}
          />

          <div className="flex flex-col gap-2">
            <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink">
              아이 생년월일
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-strong">
                필수
              </span>
            </span>
            <p className="text-[12.5px] leading-relaxed text-ink-faint">
              아직 안 태어났으면 출산 예정일을 적으시면 됩니다. 지원금 신청 기한과 6+6 특례가 전부 이
              날짜 기준이에요.
            </p>
            {children.length === 0 && (
              <p className="rounded-[8px] bg-sunk px-3 py-2.5 text-[12.5px] text-ink-soft">
                아직 없어요. 아래 버튼으로 추가해 주세요.
              </p>
            )}
            {children.map((child, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label={`${i + 1}째 아이 생년월일`}
                  className="tnum min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[16px] text-ink focus:border-brand focus:outline-none"
                  value={child.birthDate}
                  onChange={(e) => {
                    const next = [...children];
                    next[i] = { birthDate: e.target.value };
                    edit({ children: next });
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-[8px] border border-line px-3 py-2.5 text-[13px] text-ink-soft hover:border-line-strong"
                  onClick={() => edit({ children: children.filter((_, j) => j !== i) })}
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              type="button"
              className="self-start rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] font-medium text-brand-strong hover:border-line-strong"
              onClick={() => edit({ children: [...children, { birthDate: toISODate(new Date()) }] })}
            >
              아이 추가
            </button>
          </div>

          <SegmentedField<'single' | 'married'>
            label="혼인 상태"
            required
            hint="기혼이면 부부가 함께 쓰는 6+6 계산이 열립니다."
            value={current.maritalStatus}
            onChange={(maritalStatus) => edit({ maritalStatus })}
            options={[
              { value: 'single', label: '미혼' },
              { value: 'married', label: '기혼' },
            ]}
          />

          {married && (
            <MoneyField
              label="배우자 월 통상임금"
              required
              hint="6+6 조합 계산에서 두 사람의 임금을 비교하는 데 씁니다. 대략이어도 괜찮아요."
              value={current.spouse?.monthlyWage}
              placeholder="3,000,000"
              onChange={(monthlyWage) => edit({ spouse: { ...current.spouse, monthlyWage } })}
            />
          )}
        </FieldGroup>
      </Section>

      <Section
        title="채우면 더 정확해져요"
        lead="비워두셔도 계산은 됩니다. 아는 것만 적어주세요."
      >
        <FieldGroup>
          <ToggleField
            label="한부모예요"
            hint="육아휴직 급여 첫 3개월 상한액이 250만원에서 300만원으로 올라갑니다."
            checked={current.singleParent ?? false}
            onChange={(singleParent) => edit({ singleParent })}
          />
          <SegmentedField<string>
            label="사는 곳 (시 · 도)"
            hint="지자체 지원금은 지금 서울만 정리돼 있어요."
            value={current.residence?.sido}
            onChange={(sido) => edit({ residence: { sido, sigungu: undefined } })}
            options={[
              { value: 'seoul', label: '서울' },
              { value: 'other', label: '그 밖의 지역' },
            ]}
          />
          {current.residence?.sido === 'seoul' && (
            <SelectField<string>
              label="자치구"
              placeholder="구를 골라 주세요"
              value={current.residence?.sigungu}
              onChange={(sigungu) => edit({ residence: { ...current.residence, sigungu } })}
              options={DISTRICTS.map((d) => ({
                value: d.code,
                label: d.status === 'verified' ? d.name : `${d.name} (자체 지원 확인 중)`,
              }))}
            />
          )}
          <DateField
            label="입사일"
            hint="앞으로 추가될 퇴직금·연차 계산기에서 씁니다."
            value={current.employment?.joinDate}
            onChange={(joinDate) => edit({ employment: { ...current.employment, joinDate } })}
          />
          <SegmentedField<EmploymentType>
            label="고용 형태"
            value={current.employment?.employmentType}
            onChange={(employmentType) =>
              edit({ employment: { ...current.employment, employmentType } })
            }
            options={(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((v) => ({
              value: v,
              label: EMPLOYMENT_TYPE_LABEL[v],
            }))}
          />
          <MoneyField
            label="연봉 (세전)"
            hint="앞으로 추가될 이직·퇴직 계산기에서 씁니다."
            value={current.income?.annualSalary}
            placeholder="42,000,000"
            onChange={(annualSalary) => edit({ income: { ...current.income, annualSalary } })}
          />
          <NumberField
            label="보유 주택 수"
            unit="채"
            min={0}
            max={9}
            hint="앞으로 추가될 청약·대출 계산기에서 씁니다."
            value={current.housing?.ownedHomes}
            onChange={(ownedHomes) => edit({ housing: { ...current.housing, ownedHomes } })}
          />
        </FieldGroup>
      </Section>

      <section className="rounded-[12px] border border-line bg-sunk px-4 py-4">
        <h2 className="text-[13px] font-semibold text-ink">이 값들은 어디에 저장되나요</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
          회원가입도 로그인도 없습니다. 적으신 값은 지금 쓰고 계신 <strong>이 브라우저 안에만</strong>{' '}
          저장돼요. 서버로 보내는 코드가 아예 없어서 저희도 볼 수 없습니다. 대신 브라우저 기록을
          지우면 함께 사라지고, 다른 기기나 다른 브라우저에서는 다시 채우셔야 합니다.
        </p>
        {confirmReset ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-[8px] bg-danger px-3 py-2 text-[13px] font-semibold text-white"
              onClick={() => {
                reset();
                setDraft(null);
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

      {/* 저장 바. 고친 게 있을 때만 올라온다. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="text-[12.5px] leading-snug text-ink-soft">
            {dirty ? (
              <span className="font-medium text-ink">저장하지 않은 변경이 있어요</span>
            ) : justSaved ? (
              <span className="flex items-center gap-1.5 font-medium text-brand-strong">
                <Icon name="check" size={15} />
                저장했어요
              </span>
            ) : (
              '고친 뒤 저장 버튼을 눌러 주세요'
            )}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className={
              'shrink-0 rounded-[8px] px-5 py-2.5 text-[14px] font-semibold transition-colors ' +
              (dirty
                ? 'bg-brand-strong text-white hover:bg-brand-deep'
                : 'cursor-not-allowed bg-sunk text-ink-faint')
            }
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
