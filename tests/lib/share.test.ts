import { describe, expect, it } from 'vitest';
import { buildShareQuery, pickDefined, qBool, qNum, qStr } from '@/lib/share';

describe('결과 공유 링크', () => {
  it('입력값을 주소 조각으로 만든다', () => {
    expect(buildShareQuery({ wage: 3000000, months: 12, single: false })).toBe(
      '?wage=3000000&months=12&single=0',
    );
  });

  it('비어 있는 값은 주소에 담지 않는다', () => {
    expect(buildShareQuery({ wage: undefined, months: 12, birth: '' })).toBe('?months=12');
    expect(buildShareQuery({})).toBe('');
  });

  it('주소에서 숫자·문자·참거짓을 읽는다', () => {
    const sp = new URLSearchParams('?wage=3000000&birth=2026-03-01&single=1&overlap=0');
    expect(qNum(sp, 'wage')).toBe(3000000);
    expect(qStr(sp, 'birth')).toBe('2026-03-01');
    expect(qBool(sp, 'single')).toBe(true);
    expect(qBool(sp, 'overlap')).toBe(false);
  });

  it('없거나 이상한 값은 undefined로 돌려준다', () => {
    const sp = new URLSearchParams('?wage=abc&months=-3&empty=');
    expect(qNum(sp, 'wage')).toBeUndefined();
    expect(qNum(sp, 'months')).toBeUndefined();
    expect(qStr(sp, 'empty')).toBeUndefined();
    expect(qNum(null, 'wage')).toBeUndefined();
    expect(qBool(sp, 'nope')).toBeUndefined();
  });

  it('만들었다가 다시 읽으면 원래 값으로 돌아온다', () => {
    const query = buildShareQuery({ my: 3500000, spouse: 3000000, birth: '2026-03-01', overlap: true });
    const sp = new URLSearchParams(query);
    expect(qNum(sp, 'my')).toBe(3500000);
    expect(qNum(sp, 'spouse')).toBe(3000000);
    expect(qStr(sp, 'birth')).toBe('2026-03-01');
    expect(qBool(sp, 'overlap')).toBe(true);
  });

  it('undefined인 키를 걷어내 앞의 값을 덮어쓰지 않게 한다', () => {
    const merged = { a: 1, b: 2, ...pickDefined({ a: undefined, b: 9 }) };
    expect(merged).toEqual({ a: 1, b: 9 });
  });
});
