import { describe, expect, it } from 'vitest';
import { rowsInScope, SCOPES } from '@/lib/ledger/scope';
import type { Entry } from '@/lib/ledger/schema';

const row = (id: string, purse: Entry['purse'], by?: string): Entry => ({
  id,
  date: '2026-10-01',
  amount: 1000,
  purse,
  method: 'credit',
  holder: 'me',
  category: 'general',
  ...(by ? { by } : {}),
});

// 내가 적은 줄: 개인 하나, 그룹 하나
const mine = [row('p1', 'personal'), row('g1', 'group', 'terry')];
// 그룹 가계부: 내 그룹 줄 + 상대가 적은 줄
const groupRows = [row('g1', 'group', 'terry'), row('g2', 'group', 'nana')];

describe('볼 범위', () => {
  it('개인은 내가 개인으로 적은 줄만', () => {
    expect(rowsInScope('personal', mine, groupRows).map((e) => e.id)).toEqual(['p1']);
  });

  it('그룹은 멤버들이 적은 줄 전부', () => {
    expect(rowsInScope('group', mine, groupRows).map((e) => e.id).sort()).toEqual(['g1', 'g2']);
  });

  it('전체는 겹치는 줄을 두 번 세지 않는다', () => {
    const out = rowsInScope('all', mine, groupRows);
    expect(out.map((e) => e.id).sort()).toEqual(['g1', 'g2', 'p1']);
    expect(out).toHaveLength(3);
  });

  it('그룹이 없으면 전체와 내 것이 같다', () => {
    expect(rowsInScope('all', mine, []).map((e) => e.id).sort()).toEqual(['g1', 'p1']);
    expect(rowsInScope('group', mine, [])).toEqual([]);
  });

  it('어느 범위든 내 줄을 잃지 않는다', () => {
    const all = rowsInScope('all', mine, groupRows).map((e) => e.id);
    for (const e of mine) expect(all).toContain(e.id);
  });

  it('범위는 셋뿐이다', () => {
    expect(SCOPES).toEqual(['all', 'personal', 'group']);
  });
});

describe('조사', () => {
  it('받침이 없으면 로, 있으면 으로', async () => {
    const { withRo } = await import('@/lib/ledger/scope');
    expect(withRo('전체')).toBe('전체로');
    expect(withRo('개인')).toBe('개인으로');
    expect(withRo('그룹')).toBe('그룹으로');
  });

  it('받침 ㄹ은 로', async () => {
    const { withRo } = await import('@/lib/ledger/scope');
    expect(withRo('서울')).toBe('서울로');
  });

  it('한글이 아니면 그냥 로', async () => {
    const { withRo } = await import('@/lib/ledger/scope');
    expect(withRo('ALL')).toBe('ALL로');
  });
});
