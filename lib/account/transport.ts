/**
 * 금고 창구와 주고받는 바닥 층.
 *
 * 개인 가계부와 그룹 가계부가 같은 창구를 쓴다. 그룹도 '아이디 + 핀'을 가진
 * 금고 하나일 뿐이라 서버 입장에서는 둘이 구분되지 않는다. 그래서 이 층을
 * 둘이 나눠 쓴다.
 */

export type Fail =
  | { kind: 'wrong' }
  | { kind: 'taken' }
  | { kind: 'locked'; message: string }
  | { kind: 'off' }
  | { kind: 'error'; message: string };

export type Reply = {
  ok?: boolean;
  error?: string;
  keySalt?: string;
  version?: number;
  blob?: string | null;
  conflict?: boolean;
  taken?: boolean;
  wrong?: boolean;
  locked?: boolean;
};

export async function post(body: Record<string, unknown>): Promise<Reply | Fail> {
  let res: Response;
  try {
    res = await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { kind: 'error', message: '지금은 연결이 안 돼요.' };
  }
  let json: Reply = {};
  try {
    json = (await res.json()) as Reply;
  } catch {
    // 아래에서 상태 코드로 가른다
  }
  if (res.status === 503) return { kind: 'off' };
  if (res.ok) return json;
  if (json.locked) return { kind: 'locked', message: json.error ?? '잠시 잠겼어요.' };
  if (json.taken) return { kind: 'taken' };
  if (json.wrong) return { kind: 'wrong' };
  if (res.status === 409) return json; // 덮어쓰기 충돌은 실패가 아니다
  return { kind: 'error', message: json.error ?? '지금은 연결이 안 돼요.' };
}

export function isFail(x: Reply | Fail): x is Fail {
  return 'kind' in x;
}

export function sayFail(f: Fail): string {
  if (f.kind === 'wrong') return '아이디나 핀이 맞지 않아요.';
  if (f.kind === 'taken') return '이미 쓰고 있는 아이디예요. 다른 아이디로 지어 주세요.';
  if (f.kind === 'locked') return f.message;
  if (f.kind === 'off') return '가계부 서버가 아직 준비되지 않았어요.';
  return f.message;
}
