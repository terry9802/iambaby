import { describe, expect, it } from 'vitest';
import { importLedgerXlsx } from '@/lib/ledger/import-xlsx';
import { entriesToXlsx, excelSerial } from '@/lib/ledger/xlsx';
import {
  deductionCategoryOf,
  isCardBill,
  methodFromSource,
  spendCategoryFrom,
} from '@/lib/ledger/categories';
import type { Entry } from '@/lib/ledger/schema';

function entry(p: Partial<Entry> & { amount: number; id: string }): Entry {
  return {
    date: '2026-09-21',
    purse: 'personal',
    method: 'credit',
    holder: 'me',
    category: 'general',
    spend: '식비',
    ...p,
  };
}

const ROWS: Entry[] = [
  entry({ id: 'a', amount: 9790, date: '2026-10-03', memo: '파리바게트', spend: '식비' }),
  entry({
    id: 'b',
    amount: 580000,
    date: '2026-09-21',
    memo: '집',
    spend: '주거비',
    method: 'cash',
    category: 'excluded',
  }),
  entry({
    id: 'c',
    amount: 12600,
    date: '2026-09-23',
    memo: '편의점',
    spend: '식비',
    method: 'check',
    purse: 'group',
    holder: 'partner',
  }),
  entry({
    id: 'd',
    amount: 2200,
    date: '2026-09-28',
    memo: '칫솔',
    spend: '일상용품',
    method: 'check',
  }),
];

describe('엑셀 내보내기 · 가져오기', () => {
  it('내보낸 파일을 그대로 다시 읽는다', async () => {
    const bytes = entriesToXlsx(ROWS);
    const out = await importLedgerXlsx(bytes.buffer.slice(0) as ArrayBuffer);
    if ('error' in out) throw new Error(out.error);
    expect(out.entries).toHaveLength(ROWS.length);
    // 날짜·금액·수단·카테고리가 한 톨도 안 바뀌어야 한다.
    expect(out.entries.map((e) => [e.date, e.amount, e.method, e.spend]).sort()).toEqual(
      ROWS.map((e) => [e.date, e.amount, e.method, e.spend]).sort(),
    );
  });

  it('칸 이름으로 찾으므로 순서가 달라도 읽힌다', async () => {
    /*
      사장님 시트는 '지출 내역'이 맨 앞이고 금액이 두 번째다. 처음에 '지출'을
      금액의 다른 이름으로 둔 탓에 '지출 내역'이 금액 칸으로 잡혀서 한 줄도
      못 읽었다. 딱 맞는 이름을 먼저 가져가게 고쳤고, 그걸 여기서 지킨다.
    */
    const bytes = entriesToXlsx(ROWS);
    const out = await importLedgerXlsx(bytes.buffer.slice(0) as ArrayBuffer);
    if ('error' in out) throw new Error(out.error);
    expect(out.entries[0].memo).not.toMatch(/^\d+$/);
    expect(out.entries.every((e) => e.amount > 0)).toBe(true);
  });

  it('엑셀 날짜 숫자를 제대로 오간다', () => {
    // 46298은 2026-10-03이다. 하루라도 밀리면 월별 합계가 어긋난다.
    expect(excelSerial('2026-10-03')).toBe(46298);
    expect(excelSerial('1900-03-01')).toBe(61);
  });

  it('가계부가 아닌 파일은 무엇이 문제인지 말해 준다', async () => {
    const out = await importLedgerXlsx(new TextEncoder().encode('그냥 글자').buffer as ArrayBuffer);
    expect('error' in out && out.error).toContain('엑셀 파일을 여는 데 실패');
  });
});

describe('사장님 시트 어휘 옮기기', () => {
  it('출금처를 결제수단으로 옮긴다', () => {
    expect(methodFromSource('신용카드').method).toBe('credit');
    expect(methodFromSource('체크카드').method).toBe('check');
    // 계좌이체는 현금영수증을 따로 받지 않으면 공제가 안 된다.
    expect(methodFromSource('계좌이체').category).toBe('excluded');
    expect(methodFromSource('청약').category).toBe('excluded');
  });

  it('카드값 갚은 줄은 공제에서 뺀다', () => {
    /*
      카드로 긁을 때 이미 한 줄씩 세어졌다. 갚은 것까지 또 세면 같은 돈을
      두 번 세는 꼴이고, 공제가 두 배로 부풀어 보인다.
    */
    expect(isCardBill('카드값')).toBe(true);
    expect(isCardBill('카드비')).toBe(true);
    expect(isCardBill('카드 대금')).toBe(true);
    expect(isCardBill('카페')).toBe(false);
  });

  it('공제가 확실히 안 되는 것만 빼고 나머지는 일반으로 둔다', () => {
    expect(deductionCategoryOf('저축/투자')).toBe('excluded');
    expect(deductionCategoryOf('월세/이자/통신비')).toBe('excluded');
    /*
      교통은 40%짜리 대중교통일 수도, 택시·주유일 수도 있다. 섞여 있는 걸
      40%로 올려 두면 안 돌려받을 돈을 돌려받는 줄 아시게 된다.
      모자라게 세는 건 놀랄 일이 없지만 넘치게 세는 건 사람을 속이는 것이다.
    */
    expect(deductionCategoryOf('교통')).toBe('general');
    expect(deductionCategoryOf('문화생활')).toBe('general');
    expect(deductionCategoryOf('식비')).toBe('general');
  });

  it('목록에 없는 말은 가장 가까운 것으로 옮긴다', () => {
    expect(spendCategoryFrom('식비')).toBe('식비');
    expect(spendCategoryFrom('청약')).toBe('저축/투자');
    expect(spendCategoryFrom('통신비')).toBe('월세/이자/통신비');
    expect(spendCategoryFrom('노조')).toBe('기타');
  });
});
