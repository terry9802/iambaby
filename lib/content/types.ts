import type { RuleId } from '@/lib/rules/loader';
import type { EventKey } from '@/lib/tools';

/**
 * 설명 글.
 * 계산기가 "얼마"를 답한다면 글은 "왜"와 "언제"를 답한다.
 * 본문에 숫자를 적을 때는 계산기와 같은 근거(룰 파일)를 basisRuleIds에 적어 둔다.
 */

/** 본문 인라인 표기: **굵게** 와 [글자](주소) 만 쓴다. */
export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'callout'; tone: 'warning' | 'note'; title: string; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][]; caption?: string }
  | { type: 'tool'; slug: string; note: string };

export type Article = {
  slug: string;
  event: EventKey;
  /** 검색 결과에 걸리는 제목 */
  title: string;
  /** 화면에 크게 보이는, 사용자 말로 된 제목 */
  question: string;
  description: string;
  keywords: string[];
  publishedAt: string;
  updatedAt: string;
  /** 이 글이 인용한 기준값의 출처 */
  basisRuleIds: RuleId[];
  blocks: Block[];
};

/** 한국어 기준 분당 약 500자로 잡는다. */
export function readingMinutes(article: Article): number {
  const chars = article.blocks.reduce((acc, block) => {
    switch (block.type) {
      case 'p':
      case 'h2':
        return acc + block.text.length;
      case 'ul':
      case 'ol':
        return acc + block.items.join('').length;
      case 'callout':
        return acc + block.title.length + block.items.join('').length;
      case 'table':
        return acc + block.rows.flat().join('').length;
      default:
        return acc;
    }
  }, 0);
  return Math.max(1, Math.round(chars / 500));
}
