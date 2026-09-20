import { diffDays, formatDate, formatKRW, parseDate } from '@/lib/format';
import type { TimelineSegment } from '@/lib/calculators/leave-timeline';

type Phase = {
  id: string;
  name: string;
  start: string;
  end: string;
  days: number;
  amount: number;
  payerLabel: string;
  note: string;
};

/** 육아휴직 12개월치를 한 줄씩 그리면 읽히지 않는다. 단계로 묶어서 보여준다. */
export function groupPhases(segments: TimelineSegment[]): Phase[] {
  const phases: Phase[] = [];
  const parental = segments.filter((s) => s.id.startsWith('parental-'));

  for (const seg of segments) {
    if (seg.id.startsWith('parental-')) continue;
    phases.push({
      id: seg.id,
      name: seg.name,
      start: seg.start,
      end: seg.end,
      days: seg.days,
      amount: seg.amount,
      payerLabel: seg.payerLabel,
      note: seg.note,
    });
  }

  if (parental.length > 0) {
    const first = parental[0];
    const last = parental[parental.length - 1];
    phases.push({
      id: 'parental',
      name: `육아휴직 ${parental.length}개월`,
      start: first.start,
      end: last.end,
      days: parental.reduce((acc, s) => acc + s.days, 0),
      amount: parental.reduce((acc, s) => acc + s.amount, 0),
      payerLabel: '고용보험',
      note: `첫 달 ${formatKRW(first.amount)}에서 시작해 마지막 달 ${formatKRW(last.amount)}까지 줄어듭니다.`,
    });
  }

  return phases;
}

export function LeaveGantt({
  segments,
  returnDate,
}: {
  segments: TimelineSegment[];
  returnDate: string;
}) {
  const phases = groupPhases(segments);
  if (phases.length === 0) return null;

  const start = parseDate(phases[0].start);
  const end = parseDate(returnDate);
  const totalDays = Math.max(1, diffDays(start, end));

  // 색을 순서가 아니라 구간에 묶어둬야 회사 규모를 바꿔도 같은 구간이 같은 색으로 남는다.
  const toneOf = (id: string) =>
    id === 'maternity-employer'
      ? 'bg-ink-soft'
      : id === 'maternity-insurance'
        ? 'bg-brand-strong'
        : 'bg-partner';

  return (
    <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
      <h2 className="text-[14px] font-semibold text-ink">전체 일정</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
        {formatDate(start)}부터 {formatDate(end)} 복직까지 {totalDays.toLocaleString('ko-KR')}일.
      </p>

      <div className="mt-3 flex h-8 w-full overflow-hidden rounded-[6px] bg-sunk">
        {phases.map((phase) => (
          <div
            key={phase.id}
            className={`flex items-center justify-center ${toneOf(phase.id)}`}
            style={{ width: `${(phase.days / totalDays) * 100}%` }}
            title={`${phase.name} ${phase.days}일`}
          >
            <span className="tnum truncate px-1 text-[10.5px] font-semibold text-white">
              {phase.days}일
            </span>
          </div>
        ))}
      </div>

      <ul className="mt-3 flex flex-col">
        {phases.map((phase) => (
          <li key={phase.id} className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${toneOf(phase.id)}`}
                />
                {phase.name}
              </span>
              <span className="tnum shrink-0 text-[14px] font-bold text-ink">
                {formatKRW(phase.amount)}
              </span>
            </div>
            <p className="tnum text-[12.5px] text-ink-soft">
              {phase.start} ~ {phase.end} · {phase.days}일 · {phase.payerLabel} 지급
            </p>
            <p className="text-[12px] leading-relaxed text-ink-faint">{phase.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
