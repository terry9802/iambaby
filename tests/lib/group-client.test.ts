import { describe, expect, it } from 'vitest';
import { latestOther, type Member } from '@/lib/group/client';

describe('그룹 멤버', () => {
  const members: Member[] = [
    { id: 'terry', at: '2026-10-05T10:00:00Z' },
    { id: 'nana', at: '2026-10-06T09:00:00Z' },
    { id: 'joon', at: '2026-10-04T08:00:00Z' },
  ];

  it('나 말고 제일 나중에 손댄 사람을 찾는다', () => {
    expect(latestOther(members, 'terry')?.id).toBe('nana');
  });

  it('내가 제일 나중이어도 남 중에서 고른다 — 내 글로 나한테 알림이 가면 안 된다', () => {
    expect(latestOther(members, 'nana')?.id).toBe('terry');
  });

  it('나 혼자면 아무도 없다', () => {
    expect(latestOther([{ id: 'terry', at: '2026-10-05T10:00:00Z' }], 'terry')).toBeNull();
    expect(latestOther([], 'terry')).toBeNull();
  });

  it('시각이 비어 있는 사람은 세지 않는다 — 들어오기만 하고 안 적은 사람', () => {
    expect(latestOther([{ id: 'nana', at: '' }], 'terry')).toBeNull();
  });

  it('세 명 이상이어도 된다', () => {
    const four: Member[] = [...members, { id: 'sol', at: '2026-10-07T00:00:00Z' }];
    expect(latestOther(four, 'terry')?.id).toBe('sol');
  });
});
