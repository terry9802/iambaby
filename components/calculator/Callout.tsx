import type { ReactNode } from 'react';
import { InlineText } from '@/components/ui/InlineText';

const TONE = {
  warning: {
    box: 'border-alert/25 bg-alert-soft',
    title: 'text-alert',
  },
  note: {
    box: 'border-line bg-sunk',
    title: 'text-ink-soft',
  },
  good: {
    box: 'border-good/25 bg-good-soft',
    title: 'text-good',
  },
} as const;

export function Callout({
  tone = 'note',
  title,
  items,
  children,
}: {
  tone?: keyof typeof TONE;
  title: string;
  items?: string[];
  children?: ReactNode;
}) {
  if (items && items.length === 0 && !children) return null;
  const style = TONE[tone];
  return (
    <section className={`rounded-[12px] border px-4 py-3.5 ${style.box}`}>
      <h2 className={`text-[13px] font-semibold ${style.title}`}>{title}</h2>
      {items && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
              <span aria-hidden className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-ink-faint" />
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}
