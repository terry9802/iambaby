'use client';

import { useState } from 'react';
import { Icon } from './Icon';

/**
 * 전화번호 한 줄.
 * 폰에서는 눌러서 바로 걸고, PC에서는 번호를 복사한다.
 * 사이트가 답할 수 없는 것(은행 금리, 구청 지원금)은 답하는 척하지 말고 여기로 보낸다.
 */
export function PhoneCopy({
  label,
  number,
  note,
}: {
  label: string;
  number: string;
  note?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 복사가 막힌 환경에서는 번호가 화면에 그대로 보이니 그걸로 충분하다.
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-[8px] border border-line bg-surface px-3 py-2.5">
      <div className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <a
          href={`tel:${number.replace(/[^0-9+]/g, '')}`}
          className="tnum text-[15px] font-semibold text-brand-strong"
        >
          {number}
        </a>
        {note && <span className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">{note}</span>}
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`${label} 번호 복사`}
        className="flex shrink-0 items-center gap-1.5 rounded-[8px] border border-line px-2.5 py-2 text-[12.5px] font-medium text-ink-soft hover:border-line-strong"
      >
        <Icon name={copied ? 'check' : 'copy'} size={14} />
        {copied ? '복사됨' : '복사'}
      </button>
    </div>
  );
}

/** 여러 번호를 묶어서 보여줄 때 */
export function ConsultBox({
  title,
  lead,
  phones,
}: {
  title: string;
  lead: string;
  phones: { label: string; number: string; note?: string }[];
}) {
  return (
    <section className="rounded-[12px] border border-alert/25 bg-alert-soft px-4 py-4">
      <h2 className="text-[13px] font-semibold text-alert">{title}</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{lead}</p>
      <div className="mt-3 flex flex-col gap-2">
        {phones.map((phone) => (
          <PhoneCopy key={phone.number + phone.label} {...phone} />
        ))}
      </div>
    </section>
  );
}
