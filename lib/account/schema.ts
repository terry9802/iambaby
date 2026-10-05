/**
 * 아이디와 핀 규칙.
 *
 * 서버 없이 쓰던 '가계부 번호'를 걷어내고 계정으로 바꾼다. 번호는 안전했지만
 * 사람이 쓸 수 있는 물건이 아니었다. 적어 두지 않으면 못 들어오고, 적어 두면
 * 그 쪽지가 곧 열쇠라서 잃어버리기 쉽다. 사장님이 "할 게 너무 많다"고 하신 게
 * 맞다.
 *
 * 대신 아이디는 사람이 고른다. 고른다는 건 남도 짐작할 수 있다는 뜻이라,
 * 안전은 핀과 서버가 나눠서 받친다. 자세한 사정은 lib/account/crypto.ts에 적었다.
 */

export const ID_MIN = 4;
export const ID_MAX = 20;

/**
 * 영문 소문자·숫자와 . _ - 만 받는다.
 *
 * 한글이나 대문자를 받으면 '같은 아이디'를 가리는 일이 어려워진다. 유니코드는
 * 같아 보이는 글자가 여럿이고(ㅏ 하나도 조합/완성 두 가지), 기기마다 다르게
 * 보내서 "분명 맞게 쳤는데 없는 아이디"가 된다. 그 혼란을 아예 만들지 않는다.
 */
const ID_RE = /^[a-z0-9._-]+$/;

export const PIN_MIN = 6;
export const PIN_MAX = 12;

export function normalizeId(input: string): string {
  return input.trim().toLowerCase();
}

export function idProblem(input: string): string | null {
  const id = normalizeId(input);
  if (id.length === 0) return '아이디를 넣어 주세요.';
  if (id.length < ID_MIN) return `아이디는 ${ID_MIN}글자 이상으로 지어 주세요.`;
  if (id.length > ID_MAX) return `아이디는 ${ID_MAX}글자까지만 됩니다.`;
  if (!ID_RE.test(id)) return '아이디는 영문 소문자, 숫자와 . _ - 만 쓸 수 있어요.';
  return null;
}

export function pinProblem(input: string): string | null {
  if (!/^\d*$/.test(input)) return '핀은 숫자만 넣어 주세요.';
  if (input.length < PIN_MIN) return `핀은 숫자 ${PIN_MIN}자리 이상으로 정해 주세요.`;
  if (input.length > PIN_MAX) return `핀은 숫자 ${PIN_MAX}자리까지만 됩니다.`;
  return null;
}

/**
 * 너무 쉬운 핀인지.
 *
 * 막지는 않고 말만 해 준다. 생일이 제일 기억하기 좋은 건 사실이고, 못 쓰게
 * 막으면 적어 두시게 되어 더 나빠진다. 다만 '123456'처럼 제일 먼저 찍어 보는
 * 번호는 알려 드린다.
 */
export function weakPin(pin: string): boolean {
  if (/^(\d)\1*$/.test(pin)) return true; // 111111
  const up = '0123456789012';
  const down = '9876543210987';
  return up.includes(pin) || down.includes(pin);
}
