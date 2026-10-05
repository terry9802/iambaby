import { describe, expect, it } from 'vitest';
import { idProblem, normalizeId, pinProblem, weakPin } from '@/lib/account/schema';

describe('아이디', () => {
  it('앞뒤 공백과 대문자를 다듬는다', () => {
    expect(normalizeId('  Terry9802 ')).toBe('terry9802');
  });

  it('쓸 수 있는 아이디는 통과', () => {
    for (const id of ['terry9802', 'na.na', 'a_b-c', 'abcd']) {
      expect(idProblem(id)).toBeNull();
    }
  });

  it('너무 짧거나 길면 왜 안 되는지 말해 준다', () => {
    expect(idProblem('ab')).toMatch(/4글자 이상/);
    expect(idProblem('a'.repeat(21))).toMatch(/20글자까지/);
    expect(idProblem('')).toMatch(/넣어 주세요/);
    expect(idProblem('   ')).toMatch(/넣어 주세요/);
  });

  it('한글이나 빈칸은 안 받는다 — 같은 아이디인지 가릴 수 없게 된다', () => {
    expect(idProblem('가계부지출')).toMatch(/영문 소문자/);
    expect(idProblem('na na')).toMatch(/영문 소문자/);
    expect(idProblem('na@na')).toMatch(/영문 소문자/);
  });

  it('대문자로 쳐도 같은 아이디로 본다', () => {
    expect(idProblem('TERRY9802')).toBeNull();
    expect(normalizeId('TERRY9802')).toBe(normalizeId('terry9802'));
  });
});

describe('핀', () => {
  it('숫자 6~12자리', () => {
    expect(pinProblem('123456')).toBeNull();
    expect(pinProblem('123456789012')).toBeNull();
    expect(pinProblem('12345')).toMatch(/6자리 이상/);
    expect(pinProblem('1234567890123')).toMatch(/12자리까지/);
  });

  it('숫자가 아니면 거절', () => {
    expect(pinProblem('12345a')).toMatch(/숫자만/);
    expect(pinProblem('abc')).toMatch(/숫자만/);
  });

  it('제일 먼저 찍어 보는 번호는 알려 준다', () => {
    expect(weakPin('111111')).toBe(true);
    expect(weakPin('123456')).toBe(true);
    expect(weakPin('654321')).toBe(true);
    expect(weakPin('481526')).toBe(false);
    expect(weakPin('940213')).toBe(false);
  });
});
