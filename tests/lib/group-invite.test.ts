import { describe, expect, it } from 'vitest';
import { inviteLink, readInvite } from '@/lib/group/invite';

describe('초대 링크', () => {
  it('그룹 아이디를 # 뒤에 싣는다', () => {
    expect(inviteLink('https://iamstillbaby.com', '/household/ledger', 'ourhome')).toBe(
      'https://iamstillbaby.com/household/ledger#join=ourhome',
    );
  });

  it('핀은 절대 안 싣는다 — 링크 하나가 새도 안 열려야 한다', () => {
    const link = inviteLink('https://x.com', '/p', 'ourhome');
    expect(link).not.toMatch(/\d{6}/);
    expect(link.toLowerCase()).not.toContain('pin');
  });

  it('대문자로 적어도 같은 그룹으로 본다', () => {
    expect(inviteLink('https://x.com', '/p', 'OurHome')).toContain('join=ourhome');
  });

  it('만든 링크를 다시 읽는다', () => {
    const link = inviteLink('https://x.com', '/p', 'ourhome');
    expect(readInvite(link.slice(link.indexOf('#')))).toBe('ourhome');
  });

  it('다른 조각이 섞여 있어도 찾는다', () => {
    expect(readInvite('#tab=x&join=ourhome')).toBe('ourhome');
    expect(readInvite('join=ourhome')).toBe('ourhome');
  });

  it('초대가 없으면 null', () => {
    expect(readInvite('')).toBeNull();
    expect(readInvite('#tab=x')).toBeNull();
    expect(readInvite('#join=')).toBeNull();
  });

  it('한글이나 빈칸이 섞인 주소도 터지지 않는다', () => {
    expect(readInvite('#join=%EA%B0%80')).toBe('가');
    expect(readInvite('#join=%E0%A4%A')).toBeNull();
  });
});
