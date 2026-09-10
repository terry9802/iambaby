/** 숫자 표기. 원 단위 정확값과 만원 단위 요약을 함께 쓴다. */

export function formatKRW(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

/**
 * 만원/억 단위 요약. 25,000,000 → "2,500만원", 123,450,000 → "1억 2,345만원".
 * 만원 미만 끝자리가 있으면 "약"을 붙여 정확값이 아님을 드러낸다.
 */
export function formatManwon(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '';
  if (abs < 10000) return formatKRW(rounded);

  const hasRemainder = abs % 10000 !== 0;
  const prefix = hasRemainder ? '약 ' : '';
  const man = Math.round(abs / 10000);

  if (man >= 10000) {
    const eok = Math.floor(man / 10000);
    const rest = man % 10000;
    return rest === 0
      ? `${prefix}${sign}${eok.toLocaleString('ko-KR')}억원`
      : `${prefix}${sign}${eok.toLocaleString('ko-KR')}억 ${rest.toLocaleString('ko-KR')}만원`;
  }
  return `${prefix}${sign}${man.toLocaleString('ko-KR')}만원`;
}

/** "25,000,000원 (2,500만원)" — 표에는 정확값, 눈에는 요약값. */
export function formatMoneyPair(value: number): string {
  const exact = formatKRW(value);
  const summary = formatManwon(value);
  return summary === exact ? exact : `${exact} (${summary})`;
}

export function formatPercent(ratio: number): string {
  const pct = ratio * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
}

/** 'YYYY-MM-DD' 를 로컬 자정으로 읽는다. new Date('YYYY-MM-DD')는 UTC로 읽혀 하루가 밀린다. */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISODate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const targetMonth = next.getMonth() + months;
  next.setMonth(targetMonth);
  // 1월 31일 + 1개월처럼 존재하지 않는 날짜는 말일로 맞춘다.
  if (next.getMonth() !== ((targetMonth % 12) + 12) % 12) next.setDate(0);
  return next;
}

export function diffDays(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

/** 기준일 시점의 자녀 월령(개월). 생일 당일은 0. */
export function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}
