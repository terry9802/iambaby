import Link from 'next/link';
import { formatDate, formatKRW } from '@/lib/format';
import { urgentDeadlines } from '@/lib/calculators/deadlines';

/**
 * 곧 끝나는 지원을 홈 맨 위에 띄우는 띠.
 *
 * 이 사이트를 찾아온 사람은 대개 자기 질문을 들고 온다. 그런데 정작 놓치는 돈은
 * 찾아볼 생각조차 못 한 쪽에서 사라진다. 그래서 묻기 전에 먼저 말해준다.
 * 마감이 지나면 목록에서 알아서 빠지므로 끝난 안내가 남아 있을 일은 없다.
 */
export function DeadlineStrip() {
  const urgent = urgentDeadlines();
  if (urgent.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {urgent.map(({ deadline: d, dDay }) => (
        <Link
          key={d.slug}
          href={`/deadline/${d.slug}`}
          className="flex items-center gap-3 rounded-[12px] border border-brand/25 bg-brand-soft px-4 py-3.5"
        >
          <span className="tnum shrink-0 rounded-full bg-brand px-2.5 py-1 text-[11.5px] font-bold text-white">
            {dDay === 0 ? '오늘 마감' : `D-${dDay}`}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-snug text-ink">{d.hook}</span>
            <span className="mt-0.5 block text-[12.5px] text-ink-soft">
              {d.region} · {formatKRW(d.amount)} · {formatDate(d.dueAt)}까지
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
