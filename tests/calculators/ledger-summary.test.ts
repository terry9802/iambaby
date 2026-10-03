import { describe, expect, it } from 'vitest';
import { summarizeLedger } from '@/lib/calculators/ledger-summary';
import { entriesToCsv, csvFileName } from '@/lib/ledger/csv';
import { mergeEntries, mergePreview, parseLedgerFile, toLedgerFile } from '@/lib/ledger/merge';
import { sanitizeEntries, type Entry } from '@/lib/ledger/schema';

const MAN = 10000;
const ASOF = '2026-10-03';

function entry(partial: Partial<Entry> & { amount: number }): Entry {
  return {
    id:
      partial.id ??
      `id-${partial.amount}-${partial.category ?? 'general'}-${partial.method ?? 'credit'}`,
    date: '2026-03-01',
    purse: 'personal',
    method: 'credit',
    holder: 'me',
    category: 'general',
    ...partial,
  };
}

describe('가계부 요약', () => {
  it('문턱을 못 넘으면 공제가 0원이고, 신용카드를 써도 손해가 없다고 말한다', () => {
    // 총급여 4,000만원 → 문턱 1,000만원. 아직 500만원만 썼다.
    const out = summarizeLedger({
      entries: [entry({ amount: 500 * MAN })],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    const me = out.holders[0];
    expect(me.deduction).toBe(0);
    expect(me.toThreshold).toBe(500 * MAN);
    expect(me.advice).toContain('손해가 없습니다');
  });

  it('문턱을 넘으면 그 위만 공제되고, 체크카드 쪽을 권한다', () => {
    // 문턱 1,000만원을 신용카드로 채우고, 체크카드로 500만원을 더 썼다.
    const out = summarizeLedger({
      entries: [
        entry({ id: 'a', amount: 1000 * MAN, method: 'credit' }),
        entry({ id: 'b', amount: 500 * MAN, method: 'check' }),
      ],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    const me = out.holders[0];
    // 문턱이 신용에서 전부 빠지고 체크 500만이 온전히 30%
    expect(me.deduction).toBe(150 * MAN);
    expect(me.toThreshold).toBe(0);
    expect(me.advice).toContain('체크카드');
  });

  it('최저사용금액은 공제율이 낮은 쪽부터 깎는다', () => {
    /*
      전통시장분(40%)을 먼저 깎으면 납세자가 손해를 본다. 신용카드분(15%)부터
      깎여야 맞다. 같은 1,500만원을 써도 순서에 따라 공제가 크게 달라진다.
    */
    const out = summarizeLedger({
      entries: [
        entry({ id: 'a', amount: 1000 * MAN, method: 'credit', category: 'general' }),
        entry({ id: 'b', amount: 500 * MAN, method: 'credit', category: 'market' }),
      ],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    const me = out.holders[0];
    // 문턱 1,000만이 신용카드분에서 전부 빠지고, 전통시장 500만이 40%로 남는다
    expect(me.deduction).toBe(200 * MAN);
    expect(me.extraDeduction).toBe(200 * MAN);
    expect(me.baseDeduction).toBe(0);
  });

  it('전통시장에서 신용카드로 긁어도 전통시장 공제율이 붙는다', () => {
    // 공제율을 가르는 건 결제수단이 아니라 어디서 썼느냐다.
    const market = summarizeLedger({
      entries: [
        entry({ id: 'a', amount: 1000 * MAN, method: 'check', category: 'general' }),
        entry({ id: 'b', amount: 300 * MAN, method: 'credit', category: 'market' }),
      ],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    expect(market.holders[0].extraDeduction).toBe(120 * MAN); // 300만 × 40%
  });

  it('공제가 안 되는 지출은 문턱에도 안 보태진다', () => {
    const out = summarizeLedger({
      entries: [
        entry({ id: 'a', amount: 1200 * MAN, category: 'excluded' }),
        entry({ id: 'b', amount: 200 * MAN }),
      ],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    const me = out.holders[0];
    expect(me.excluded).toBe(1200 * MAN);
    expect(me.spent).toBe(200 * MAN);
    expect(me.toThreshold).toBe(800 * MAN);
  });

  it('명의가 다르면 공제도 따로 붙는다', () => {
    const out = summarizeLedger({
      entries: [
        entry({ id: 'a', amount: 1500 * MAN, holder: 'me', method: 'check' }),
        entry({ id: 'b', amount: 900 * MAN, holder: 'partner', method: 'check' }),
      ],
      mySalary: 4000 * MAN,
      partnerSalary: 3000 * MAN,
      asOf: ASOF,
    });
    expect(out.holders).toHaveLength(2);
    // 나: 문턱 1,000만 → 체크 500만이 30%
    expect(out.holders[0].deduction).toBe(150 * MAN);
    // 배우자: 문턱 750만 → 체크 150만이 30%
    expect(out.holders[1].deduction).toBe(45 * MAN);
  });

  it('배우자 소득이 없으면 배우자 줄은 세지 않는다', () => {
    const out = summarizeLedger({
      entries: [entry({ amount: 100 * MAN })],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    expect(out.holders).toHaveLength(1);
  });

  it('기본 한도를 채우면 일반 지출은 더 써도 소용없다고 말한다', () => {
    // 총급여 4,000만, 한도 300만. 체크카드로 2,000만을 쓰면 (2,000−1,000)×30% = 300만
    const out = summarizeLedger({
      entries: [entry({ amount: 2000 * MAN, method: 'check' })],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    const me = out.holders[0];
    expect(me.baseLimitReached).toBe(true);
    expect(me.baseDeduction).toBe(300 * MAN);
    expect(me.advice).toContain('한도를 채우셨어요');
  });

  it('커플통장과 개인 지출을 따로 센다', () => {
    const out = summarizeLedger({
      entries: [
        entry({ id: 'a', amount: 100 * MAN, purse: 'couple' }),
        entry({ id: 'b', amount: 40 * MAN, purse: 'personal' }),
      ],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    expect(out.coupleSpent).toBe(100 * MAN);
    expect(out.personalSpent).toBe(40 * MAN);
  });
});

describe('엑셀 내려받기', () => {
  it('맨 앞에 바이트 순서 표식을 붙인다', () => {
    // 이게 없으면 엑셀에서 한글이 전부 깨진다.
    const csv = entriesToCsv([entry({ amount: 12000 })]);
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('머리글과 줄을 사람이 읽는 말로 적는다', () => {
    const csv = entriesToCsv([
      entry({
        amount: 12000,
        purse: 'couple',
        method: 'check',
        category: 'market',
        memo: '장보기',
      }),
    ]);
    expect(csv).toContain('날짜,금액,지갑,결제수단,명의,분류,메모');
    expect(csv).toContain('2026-03-01,12000,커플통장,체크카드,내 명의,전통시장,장보기');
  });

  it('쉼표가 든 메모를 따옴표로 감싼다', () => {
    const csv = entriesToCsv([entry({ amount: 1000, memo: '커피, 빵' })]);
    expect(csv).toContain('"커피, 빵"');
  });

  it('파일 이름에 기간이 들어간다', () => {
    const rows = [
      entry({ id: 'a', amount: 1000, date: '2026-01-05' }),
      entry({ id: 'b', amount: 2000, date: '2026-03-20' }),
    ];
    expect(csvFileName(rows, ASOF)).toBe('가계부_2026-01-05_2026-03-20.csv');
    expect(csvFileName([], ASOF)).toBe('가계부_2026-10-03.csv');
  });
});

describe('둘이 합치기', () => {
  const mine = [entry({ id: 'mine-1', amount: 1000 })];
  const theirs = [entry({ id: 'theirs-1', amount: 2000 }), entry({ id: 'mine-1', amount: 1000 })];

  it('같은 줄을 두 번 넣지 않는다', () => {
    const merged = mergeEntries(mine, theirs, '배우자');
    expect(merged).toHaveLength(2);
    expect(merged.filter((e) => e.id === 'mine-1')).toHaveLength(1);
  });

  it('가져오기 전에 몇 줄이 들어올지 보여 준다', () => {
    expect(mergePreview(mine, theirs)).toEqual({ added: 1, duplicate: 1, total: 2 });
  });

  it('상대가 보낸 줄에 누가 보냈는지를 적어 둔다', () => {
    const merged = mergeEntries(mine, theirs, '배우자');
    expect(merged.find((e) => e.id === 'theirs-1')?.source).toBe('배우자');
    expect(merged.find((e) => e.id === 'mine-1')?.source).toBeUndefined();
  });

  it('내보낸 파일을 그대로 다시 읽는다', () => {
    const file = toLedgerFile(mine, '나', ASOF);
    const read = parseLedgerFile(JSON.stringify(file));
    expect('entries' in read && read.entries).toHaveLength(1);
    expect('from' in read && read.from).toBe('나');
  });

  it('엉뚱한 파일은 무엇이 잘못됐는지 말해 준다', () => {
    expect(parseLedgerFile('그냥 글자')).toEqual({
      error: '가계부 파일이 아니에요. 내보내기로 받은 파일을 그대로 올려주세요.',
    });
    expect(parseLedgerFile('{"kind":"other"}')).toEqual({
      error: '이 사이트에서 내보낸 가계부 파일이 아니에요.',
    });
  });
});

describe('저장소에 들어가는 줄', () => {
  it('금액이 없거나 날짜가 이상한 줄은 버린다', () => {
    const clean = sanitizeEntries([
      { date: '2026-03-01', amount: 1000 },
      { date: '어제', amount: 1000 },
      { date: '2026-03-01', amount: 0 },
      { date: '2026-03-01', amount: -500 },
      null,
    ]);
    expect(clean).toHaveLength(1);
  });

  it('모르는 값은 안전한 쪽으로 돌린다', () => {
    const [row] = sanitizeEntries([
      { date: '2026-03-01', amount: 1000, purse: 'hack', method: 'bitcoin', category: 'free' },
    ]);
    expect(row.purse).toBe('personal');
    expect(row.method).toBe('credit');
    expect(row.category).toBe('general');
  });
});
