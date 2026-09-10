/**
 * 계산 결과 공유.
 * 입력값을 주소(URL)에 담아, 링크를 받은 사람이 같은 숫자로 같은 결과를 보게 한다.
 *
 * 주의: 링크에는 통상임금 같은 값이 그대로 담긴다. 프로필을 서버로 보내지 않는다는 약속과
 * 어긋나지 않으려면, 공유는 반드시 사용자가 버튼을 눌렀을 때만 일어나야 하고
 * 링크에 값이 담겨 있다는 사실을 화면에 밝혀야 한다.
 */

export type ShareValue = string | number | boolean | undefined;

export function buildShareQuery(params: Record<string, ShareValue>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    sp.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  const query = sp.toString();
  return query ? `?${query}` : '';
}

/**
 * 주소에 담긴 값을 읽는다.
 * 정적으로 미리 만들어진 HTML과 첫 화면이 어긋나면 안 되므로 하이드레이션 뒤에만 읽는다.
 */
export function readShareQuery(hydrated: boolean): URLSearchParams | null {
  if (!hydrated || typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  for (const _ of sp.keys()) return sp;
  return null;
}

export function qNum(sp: URLSearchParams | null, key: string): number | undefined {
  const raw = sp?.get(key);
  if (raw === null || raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function qStr(sp: URLSearchParams | null, key: string): string | undefined {
  const raw = sp?.get(key);
  return raw === null || raw === undefined || raw === '' ? undefined : raw;
}

export function qBool(sp: URLSearchParams | null, key: string): boolean | undefined {
  const raw = sp?.get(key);
  if (raw === null || raw === undefined || raw === '') return undefined;
  return raw === '1' || raw === 'true';
}

/** undefined인 키를 없애서, 펼쳐 합칠 때 앞의 값을 지우지 않게 한다. */
export function pickDefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function absoluteShareUrl(query: string): string {
  if (typeof window === 'undefined') return query;
  return `${window.location.origin}${window.location.pathname}${query}`;
}
