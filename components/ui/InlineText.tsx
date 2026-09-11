import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

/**
 * 글과 경고 문구에서 쓰는 최소한의 표기.
 * **굵게** 와 [글자](주소) 둘뿐이다. 그 이상은 본문에 쓰지 않는다.
 */
export function inlineText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];

    if (token.startsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const label = token.slice(1, token.indexOf(']'));
      const href = token.slice(token.indexOf('(') + 1, -1);
      parts.push(
        href.startsWith('http') ? (
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand-strong underline underline-offset-2"
          >
            {label}
          </a>
        ) : (
          <Link key={key++} href={href} className="text-brand-strong underline underline-offset-2">
            {label}
          </Link>
        ),
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((part, i) => <Fragment key={i}>{part}</Fragment>);
}

export function InlineText({ text }: { text: string }) {
  return <>{inlineText(text)}</>;
}
