import Link from 'next/link';
import type { Block } from '@/lib/content/types';
import { inlineText as inline } from '@/components/ui/InlineText';
import { TOOLS } from '@/lib/tools';
import { Callout } from '@/components/calculator/Callout';

function ToolCard({ slug, note }: { slug: string; note: string }) {
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) return null;
  return (
    <Link
      href={`/${tool.event}/${tool.slug}`}
      className="flex flex-col gap-1 rounded-[12px] border border-line bg-sunk px-4 py-3.5 transition-colors hover:border-line-strong"
    >
      <span className="text-[12px] font-medium text-ink-faint">직접 계산해 보기</span>
      <span className="text-[15px] font-semibold leading-snug text-ink">{tool.question}</span>
      <span className="text-[12.5px] leading-relaxed text-ink-soft">{note}</span>
    </Link>
  );
}

export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h2':
            return (
              <h2 key={i} className="mt-3 text-[18px] font-bold leading-snug text-ink">
                {block.text}
              </h2>
            );
          case 'p':
            return (
              <p key={i} className="text-[15px] leading-[1.75] text-ink-soft">
                {inline(block.text)}
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="flex flex-col gap-2">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-[15px] leading-[1.7] text-ink-soft">
                    <span
                      aria-hidden
                      className="mt-[10px] h-[4px] w-[4px] shrink-0 rounded-full bg-line-strong"
                    />
                    <span>{inline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="flex flex-col gap-2">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-[15px] leading-[1.7] text-ink-soft">
                    <span className="tnum mt-[1px] shrink-0 text-[13px] font-semibold text-brand-strong">
                      {j + 1}
                    </span>
                    <span>{inline(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'callout':
            return <Callout key={i} tone={block.tone} title={block.title} items={block.items} />;
          case 'table':
            return (
              <div key={i} className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-[360px] border-collapse text-[13.5px]">
                  {block.caption && (
                    <caption className="mb-2 text-left text-[12.5px] text-ink-faint">
                      {block.caption}
                    </caption>
                  )}
                  <thead>
                    <tr className="border-b border-line-strong text-left text-[12.5px] text-ink-faint">
                      {block.head.map((cell, j) => (
                        <th key={j} scope="col" className="py-2 pr-3 font-medium last:pr-0">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tnum">
                    {block.rows.map((row, j) => (
                      <tr key={j} className="border-b border-line last:border-b-0">
                        {row.map((cell, k) => (
                          <td key={k} className="py-2 pr-3 align-top text-ink-soft last:pr-0">
                            {inline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'tool':
            return <ToolCard key={i} slug={block.slug} note={block.note} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
