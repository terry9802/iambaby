import {
  CATEGORY_LABEL,
  HOLDER_LABEL,
  METHOD_LABEL,
  PURSE_LABEL,
  sanitizeEntries,
  type Entry,
} from './schema';

/**
 * 가계부를 엑셀에서 열 수 있는 파일로 바꾼다.
 *
 * 한글이 깨지지 않게 하는 게 제일 중요하다. 엑셀은 CSV를 열 때 맨 앞 세 바이트가
 * EF BB BF(바이트 순서 표식)가 아니면 윈도 기본 인코딩으로 읽어 버려서, 한글이
 * 전부 깨진 글자가 된다. 메모장에서 열면 멀쩡한데 엑셀에서만 깨지는 게 이 때문이다.
 * 그래서 파일 맨 앞에 ﻿를 붙인다.
 */

const HEADERS = ['날짜', '금액', '지갑', '결제수단', '명의', '분류', '메모'] as const;

/** 쉼표·따옴표·줄바꿈이 든 칸은 따옴표로 감싸고, 안쪽 따옴표는 두 번 쓴다. */
function cell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function entriesToCsv(entries: Entry[]): string {
  const rows = sanitizeEntries(entries).map((e) =>
    [
      e.date,
      e.amount,
      PURSE_LABEL[e.purse],
      METHOD_LABEL[e.method],
      HOLDER_LABEL[e.holder],
      CATEGORY_LABEL[e.category],
      e.memo ?? '',
    ]
      .map(cell)
      .join(','),
  );
  /*
    줄바꿈을 \r\n으로 둔다. 엑셀이 만든 CSV가 그렇고, 윈도 메모장에서 열어도
    한 줄로 뭉치지 않는다. \n만 쓰면 옛 메모장에서 전부 한 줄로 보인다.
  */
  return `﻿${[HEADERS.join(','), ...rows].join('\r\n')}\r\n`;
}

export function csvFileName(entries: Entry[], today: string): string {
  const dates = entries.map((e) => e.date).sort();
  if (dates.length === 0) return `가계부_${today}.csv`;
  const from = dates[0];
  const to = dates[dates.length - 1];
  return from === to ? `가계부_${from}.csv` : `가계부_${from}_${to}.csv`;
}

/**
 * 파일로 받게 한다.
 *
 * 서버를 거치지 않는다. 브라우저 안에서 만든 글자를 그대로 파일로 떨궈서,
 * 적어 두신 금액이 네트워크를 타지 않는다.
 */
export function downloadCsv(entries: Entry[], today: string): void {
  const blob = new Blob([entriesToCsv(entries)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = csvFileName(entries, today);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 바로 지우면 사파리에서 받다 말 때가 있어 한 박자 둔다.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
