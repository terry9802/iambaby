'use client';

import { useMemo } from 'react';
import { formatKRW } from '@/lib/format';
import { breakdown, type Slice } from '@/lib/ledger/breakdown';
import type { Entry } from '@/lib/ledger/schema';
import type { Scope } from '@/lib/ledger/scope';
import { ScopeTabs } from './ScopeTabs';

/**
 * 무엇에 얼마 썼는지 도넛으로.
 *
 * 전체 · 개인 · 그룹을 버튼으로 갈아 가며 본다. 셋은 세는 대상이 다르다.
 *   전체 — 내가 적은 모든 줄 + 그룹에서 멤버들이 적은 줄
 *   개인 — 내가 '개인 지출'로 적은 줄
 *   그룹 — 그룹 가계부에 쌓인 줄 (누가 적었든)
 *
 * 조각은 여섯 개까지다. 색맹 검사를 통과하면서 서로 구분되는 색이 거기까지라,
 * 그 이상은 '기타'로 묶는다. 색만으로 알아보게 두지 않고 아래에 이름과 금액을
 * 같이 적는다 — 색이 안 보이는 분께는 그 목록이 본체다.
 */

const SLICE_COLORS = [
  'var(--color-slice-1)',
  'var(--color-slice-2)',
  'var(--color-slice-3)',
  'var(--color-slice-4)',
  'var(--color-slice-5)',
  'var(--color-slice-6)',
];

/** 조각 사이를 띄우는 흰 틈. 조각끼리 붙어 있으면 경계가 안 보인다. */
const GAP_PX = 3;
const RADIUS = 56;
const THICK = 22;

export function SpendBreakdown({
  rows,
  scope,
  onScope,
  hasGroup,
  groupName,
}: {
  /** 이미 고른 범위로 걸러진 줄 */
  rows: Entry[];
  scope: Scope;
  onScope: (next: Scope) => void;
  hasGroup: boolean;
  groupName?: string;
}) {
  const slices = useMemo(() => breakdown(rows), [rows]);
  const total = useMemo(() => rows.reduce((n, e) => n + e.amount, 0), [rows]);

  return (
    <section className="flex flex-col gap-4 rounded-[12px] border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-ink">무엇에 썼나</h2>
        <ScopeTabs scope={scope} onScope={onScope} />
      </div>

      {scope === 'group' && hasGroup && (
        <p className="text-[12px] leading-relaxed text-ink-faint">
          {groupName ?? '그룹'} 가계부에 멤버들이 적은 줄을 전부 셉니다.
        </p>
      )}

      {slices.length === 0 ? (
        <p className="rounded-[8px] bg-sunk px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
          {scope !== 'group'
            ? '아직 적어 두신 게 없어요.'
            : hasGroup
              ? '그룹 가계부에 아직 적힌 게 없어요. 쓴 돈을 적으실 때 지갑을 그룹 지출로 고르시면 여기 쌓입니다.'
              : '아직 그룹이 없어요. 위 \u2018그룹 가계부\u2019에서 만들거나 참여하시면, 여럿이 적은 돈이 여기 모입니다.'}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <Donut slices={slices} total={total} />
          {/*
            색 옆에 이름과 금액을 반드시 같이 적는다. 색만으로 알아보게 두면
            색이 안 보이는 분은 도넛을 읽을 길이 없다.
          */}
          <ul className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            {slices.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                />
                <span className="flex-1 text-[12.5px] text-ink">{s.label}</span>
                <span className="tnum text-[12.5px] font-semibold text-ink">
                  {formatKRW(s.amount)}
                </span>
                <span className="tnum w-[38px] shrink-0 text-right text-[11.5px] text-ink-faint">
                  {Math.round(s.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Donut({ slices, total }: { slices: Slice[]; total: number }) {
  const circumference = 2 * Math.PI * RADIUS;
  /*
    조각이 시작하는 자리를 미리 다 계산해 둔다. 그리면서 더해 나가면 React가
    같은 그림을 두 번 그려 볼 때 두 번째가 어긋난다.
  */
  const arcs = useMemo(
    () =>
      slices.reduce<{ slice: Slice; start: number }[]>((acc, s) => {
        const last = acc.at(-1);
        const start = last ? last.start + last.slice.share * circumference : 0;
        return [...acc, { slice: s, start }];
      }, []),
    [slices, circumference],
  );

  return (
    <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
      <svg width={150} height={150} viewBox="0 0 150 150" role="img" aria-label="쓴 돈 나눠 보기">
        <g transform="rotate(-90 75 75)">
          {arcs.map(({ slice: s, start }, i) => {
            const len = Math.max(0, s.share * circumference - GAP_PX);
            return (
              <circle
                key={s.label}
                cx={75}
                cy={75}
                r={RADIUS}
                fill="none"
                strokeWidth={THICK}
                stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={-start}
              >
                <title>{`${s.label} ${formatKRW(s.amount)} (${Math.round(s.share * 100)}%)`}</title>
              </circle>
            );
          })}
        </g>
      </svg>
      {/* 가운데는 비어 있으니 합계를 둔다. 도넛을 쓰는 이유가 이 자리다. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] text-ink-faint">합계</span>
        <span className="tnum text-[13.5px] font-bold text-ink">{formatKRW(total)}</span>
      </div>
    </div>
  );
}
