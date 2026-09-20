import Link from 'next/link';
import { EVENTS } from '@/lib/tools';

/**
 * 없는 주소로 들어왔을 때.
 * 막다른 길로 두지 않고, 여기서 갈 수 있는 곳을 바로 보여준다.
 */
export default function NotFound() {
  const live = EVENTS.filter((e) => e.status === 'live');

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-5 px-4 pb-16 pt-10">
      <header className="flex flex-col gap-2">
        <p className="tnum text-[13px] font-semibold text-ink-faint">404</p>
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
          찾으시는 페이지가 없어요
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">
          주소가 바뀌었거나 없어진 페이지입니다. 아래에서 바로 가실 수 있어요.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {live.map((e) => (
          <li key={e.key}>
            <Link
              href={`/${e.key}`}
              className="flex flex-col gap-1 rounded-[12px] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong"
            >
              <span className="text-[15px] font-semibold text-ink">{e.title}</span>
              <span className="text-[12.5px] leading-relaxed text-ink-soft">{e.lead}</span>
            </Link>
          </li>
        ))}
      </ul>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-[13px]">
        <Link href="/" className="font-medium text-brand-strong hover:underline">
          홈으로
        </Link>
        <Link href="/guide" className="text-ink-soft hover:text-ink">
          읽을거리
        </Link>
        <Link href="/contact" className="text-ink-soft hover:text-ink">
          문의
        </Link>
      </nav>
    </div>
  );
}
