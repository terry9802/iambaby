import { describe, expect, it } from 'vitest';
import { compareCoupleStrategies, summarizeLedger } from '@/lib/calculators/ledger-summary';
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
  it('세금이 줄기 시작하는 금액에 못 미치면 혜택 좋은 신용카드를 권한다', () => {
    // 총급여 4,000만원 → 문턱 1,000만원. 아직 500만원만 썼다.
    const out = summarizeLedger({
      entries: [entry({ amount: 500 * MAN })],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    const me = out.holders[0];
    expect(me.deduction).toBe(0);
    expect(me.toThreshold).toBe(500 * MAN);
    /*
      이 구간에서 쓴 돈은 한 푼도 세금을 안 줄여 준다. 그러니 잃을 게 없고
      포인트·마일리지가 붙는 카드가 그냥 이득이다. 여기서 체크카드를 권하면
      공짜로 받을 혜택을 버리게 만드는 셈이다.
    */
    expect(me.nowUse).toBe('credit');
    expect(me.nowWhy).toContain('세금이 줄기 시작해요');
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
    expect(me.nowUse).toBe('check');
    expect(me.nowWhy).toContain('두 배');
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

  it('한도를 채우면 다시 혜택 좋은 신용카드를 권한다', () => {
    // 총급여 4,000만, 한도 300만. 체크카드로 2,000만을 쓰면 (2,000−1,000)×30% = 300만
    const out = summarizeLedger({
      entries: [entry({ amount: 2000 * MAN, method: 'check' })],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    const me = out.holders[0];
    expect(me.baseLimitReached).toBe(true);
    expect(me.baseDeduction).toBe(300 * MAN);
    // 더 써도 안 줄어드니 이제부터는 혜택이 좋은 카드가 이득이다.
    expect(me.nowUse).toBe('credit');
    expect(me.nowWhy).toContain('한도를 이미 다 채우셨어요');
  });

  it('그룹 지출와 개인 생활비를 따로 센다', () => {
    const out = summarizeLedger({
      entries: [
        entry({ id: 'a', amount: 100 * MAN, purse: 'group' }),
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
        purse: 'group',
        method: 'check',
        category: 'market',
        memo: '장보기',
      }),
    ]);
    expect(csv).toContain('날짜,금액,지갑,결제수단,명의,분류,메모');
    expect(csv).toContain('2026-03-01,12000,그룹 지출,체크카드,내 명의,전통시장,장보기');
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

  it('가져올 때 명의를 보는 쪽 기준으로 돌려 놓는다', () => {
    /*
      공제는 명의자 소득에서만 붙는다. 신랑이 자기 카드로 쓴 줄은 그 파일에서
      '내 명의'인데, 신부가 그대로 가져오면 신랑 카드로 쓴 돈이 신부 소득에서
      공제되는 걸로 계산된다. 답이 틀어지므로 가져올 때 뒤집는다.
    */
    const fromGroom = [entry({ id: 'g1', amount: 5000, holder: 'me' })];
    const merged = mergeEntries([], fromGroom, '배우자', true);
    expect(merged[0].holder).toBe('partner');

    // 신부가 다시 내보내고 신랑이 가져오면 원래 자리로 돌아온다.
    const backToGroom = mergeEntries([], merged, '배우자', true);
    expect(backToGroom[0].holder).toBe('me');
  });

  it('뒤집지 않으면 명의가 그대로 들어온다', () => {
    const merged = mergeEntries([], [entry({ id: 'x', amount: 5000, holder: 'me' })], '배우자');
    expect(merged[0].holder).toBe('me');
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

describe('데이트비를 신용카드로 몰면 이득인가', () => {
  /*
    사장님 방식: 커플통장에 모아 두고 한 사람 신용카드로 데이트비를 다 긁은 뒤,
    결제일에 커플통장에서 카드값을 갚는다. 통장은 공제와 상관이 없으므로
    남는 질문은 "신용카드 15%냐 체크카드 30%냐" 하나다.
  */
  const date = (d: number) => `2026-${String(d).padStart(2, '0')}-01`;
  const dateNights = Array.from({ length: 12 }, (_, i) =>
    entry({
      id: `c${i}`,
      date: date(i + 1),
      amount: 100 * MAN,
      purse: 'group',
      method: 'credit',
      holder: 'me',
    }),
  );

  it('신용카드로 몰면 체크카드보다 덜 돌려받는다고 말한다', () => {
    const out = compareCoupleStrategies({
      entries: dateNights,
      mySalary: 4000 * MAN,
      partnerSalary: 3600 * MAN,
      asOf: ASOF,
    });
    if (!out) throw new Error('비교 실패');
    expect(out.coupleSpent).toBe(1200 * MAN);
    expect(out.coupleOnCredit).toBe(1200 * MAN);
    // 공제율이 두 배라 체크카드 쪽이 이긴다
    expect(out.best.key).not.toBe('asRecorded');
    expect(out.lossVsBest).toBeGreaterThan(0);
    expect(out.verdict).toContain('덜 돌려받습니다');
  });

  it('이미 체크카드로 쓰고 계시면 그렇다고 말한다', () => {
    const out = compareCoupleStrategies({
      entries: dateNights.map((e) => ({ ...e, method: 'check' as const })),
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    if (!out) throw new Error('비교 실패');
    expect(out.coupleOnCredit).toBe(0);
    expect(out.verdict).toContain('세금을 더 줄여 주는 쪽을 이미');
  });

  it('데이트비가 없으면 아무 말도 하지 않는다', () => {
    const out = compareCoupleStrategies({
      entries: [entry({ amount: 100 * MAN, purse: 'personal' })],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    expect(out).toBeNull();
  });

  it('전통시장처럼 공제율이 따로 붙는 줄은 결제수단을 바꾸지 않는다', () => {
    // 전통시장은 신용카드로 긁어도 40%다. 체크카드로 바꿔도 달라질 게 없다.
    const out = compareCoupleStrategies({
      entries: [
        entry({
          id: 'm',
          amount: 1200 * MAN,
          purse: 'group',
          method: 'credit',
          category: 'market',
        }),
      ],
      mySalary: 4000 * MAN,
      asOf: ASOF,
    });
    if (!out) throw new Error('비교 실패');
    expect(out.lossVsBest).toBe(0);
  });
});

describe('지금 방식이 이길 때', () => {
  it('신용카드분이 통째로 먼저 빠지는 몫이면 바꿔도 소용없다고 말한다', () => {
    /*
      연봉 4,500만(문턱 1,125만). 데이트비 1,000만을 신용카드로 몰고 개인 500만은
      체크카드. 문턱이 신용카드분을 전부 먹어 치우므로 체크카드로 바꿔도 공제가
      같다. 즉 신용카드 혜택은 공짜로 버는 셈이다. "신용카드는 손해"라는 흔한
      오해 때문에 안 써도 될 손해를 보지 않게 이걸 말해 줘야 한다.
    */
    const rows = Array.from({ length: 10 }, (_, i) => [
      entry({
        id: `c${i}`,
        date: `2026-${String(i + 1).padStart(2, '0')}-15`,
        amount: 100 * MAN,
        purse: 'group',
        method: 'credit',
        holder: 'me',
      }),
      entry({
        id: `p${i}`,
        date: `2026-${String(i + 1).padStart(2, '0')}-15`,
        amount: 50 * MAN,
        purse: 'personal',
        method: 'check',
        holder: 'me',
      }),
    ]).flat();

    const out = compareCoupleStrategies({
      entries: rows,
      mySalary: 4500 * MAN,
      partnerSalary: 3800 * MAN,
      asOf: ASOF,
    });
    if (!out) throw new Error('비교 실패');
    expect(out.lossVsBest).toBe(0);
    expect(out.verdict).toContain('지금 방식이 가장 낫습니다');
    expect(out.verdict).toContain('먼저 빠지는 몫에 통째로');
  });

  it('둘로 쪼개면 둘 다 문턱을 못 넘어 오히려 손해라는 것도 잡아낸다', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      entry({
        id: `c${i}`,
        date: `2026-${String(i + 1).padStart(2, '0')}-15`,
        amount: 100 * MAN,
        purse: 'group',
        method: 'credit',
        holder: 'me',
      }),
    );
    const out = compareCoupleStrategies({
      entries: rows,
      mySalary: 3000 * MAN,
      partnerSalary: 3000 * MAN,
      asOf: ASOF,
    });
    if (!out) throw new Error('비교 실패');
    const split = out.scenarios.find((s) => s.key === 'splitCheck');
    const all = out.scenarios.find((s) => s.key === 'allCheck');
    // 한 사람에게 몰아야 문턱을 넘는다. 쪼개면 둘 다 못 넘는다.
    expect(split!.taxSaved).toBeLessThan(all!.taxSaved);
  });
});

describe('왜 같은 답이 나오는지 가려 말한다', () => {
  /*
    세 방식이 같은 답을 내는 이유는 두 가지인데 서로 전혀 다르다.
     - 한도를 이미 채웠다 → 뭘 더 긁든 세금이 안 줄어든다
     - 아직 세금이 줄기 시작하는 금액에 못 미친다 → 지금 쓰는 돈이 세금과 무관하다
    처음엔 둘을 구분하지 않고 늘 두 번째 설명을 내보냈다. 그래서 한도를 세 배나
    넘긴 분께 "문턱 안에서 긁은 신용카드는…"이라고 엉뚱한 말을 했다.
  */
  const big = (n: number, purse: 'personal' | 'group') =>
    entry({ id: `${purse}-${n}`, amount: n, purse, method: 'credit' });

  it('한도를 채웠으면 한도 때문이라고 말한다', () => {
    const out = compareCoupleStrategies({
      entries: [big(3000 * MAN, 'personal'), big(1500 * MAN, 'group')],
      mySalary: 5678 * MAN,
      asOf: ASOF,
    });
    if (!out) throw new Error('비교 실패');
    expect(out.lossVsBest).toBe(0);
    expect(out.verdict).toContain('한도를 이미 다 채우셨어요');
    expect(out.verdict).not.toContain('최저사용금액');
  });

  it('아직 못 미쳤으면 그 이유로 말한다', () => {
    const out = compareCoupleStrategies({
      entries: [big(300 * MAN, 'personal'), big(200 * MAN, 'group')],
      mySalary: 5678 * MAN,
      asOf: ASOF,
    });
    if (!out) throw new Error('비교 실패');
    expect(out.verdict).toContain('아직 세금이 줄기 시작하는 금액에 못 미쳐서');
  });

  it('데이트비가 쥐꼬리면 견줄 거리가 못 된다고 말한다', () => {
    /*
      4,300만원 중 9,790원(0.02%)을 두고 "지금 방식이 가장 낫습니다"라고 하면
      비교하지도 않은 걸 비교한 척하는 것이다.
    */
    const out = compareCoupleStrategies({
      entries: [big(4300 * MAN, 'personal'), big(9790, 'group')],
      mySalary: 5678 * MAN,
      asOf: ASOF,
    });
    if (!out) throw new Error('비교 실패');
    expect(out.tooSmall).toBe(true);
    expect(out.verdict).toContain('견줄 거리가 못 됩니다');
  });

  it('법에서 쓰는 말을 화면에 내보내지 않는다', () => {
    const hard = ['최저사용금액', '공제율', '문턱'];
    for (const entries of [
      [big(3000 * MAN, 'personal'), big(1500 * MAN, 'group')],
      [big(300 * MAN, 'personal'), big(200 * MAN, 'group')],
      [big(2000 * MAN, 'personal'), big(800 * MAN, 'group')],
    ]) {
      const out = compareCoupleStrategies({ entries, mySalary: 5678 * MAN, asOf: ASOF });
      if (!out) throw new Error('비교 실패');
      for (const word of hard) expect(out.verdict).not.toContain(word);
    }
  });
});
