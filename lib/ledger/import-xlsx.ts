import { deductionCategoryOf, isCardBill, methodFromSource, spendCategoryFrom } from './categories';
import { newId, type Entry } from './schema';

/**
 * 쓰시던 엑셀 가계부를 읽어 들인다.
 *
 * 올려주신 파일의 칸은 이랬다.
 *   지출 내역 | 금액 | 날짜 | 카테고리 | 출금처
 * 칸 이름을 보고 찾으므로 순서가 달라도 되고, 우리가 내보낸 파일도 그대로 읽힌다.
 *
 * 엑셀이 만든 파일은 ZIP 안이 압축돼 있다. 압축을 푸는 코드를 직접 쓰면 수백 줄이라,
 * 브라우저에 이미 들어 있는 DecompressionStream을 쓴다. 사파리 16.4, 크롬 80부터
 * 있어서 요즘 기기면 거의 다 되지만, 안 되는 기기도 있으니 그때는 CSV로 올리시라고
 * 말해 준다. 조용히 실패하면 왜 안 되는지 알 길이 없다.
 */

type Row = Record<string, string | number>;

export type ImportResult =
  | {
      entries: Entry[];
      sheet: string;
      skipped: number;
      /** 카드값 갚은 줄로 보여서 공제에서 뺀 건수 */
      cardBills: number;
      /**
       * 지갑 칸이 파일에 있었는가.
       *
       * 없으면 전부 '개인 생활비'로 들어간다. 그대로 두면 데이트비가 하나도
       * 없는 걸로 세어져서 "데이트비를 신용카드로 몰면 이득일까요" 비교가
       * 아예 안 나온다. 그래서 없었다는 사실을 화면에 알려야 한다.
       */
      hadPurse: boolean;
    }
  | { error: string };

/* ── ZIP 풀기 ───────────────────────────────────────────────── */

function u16(b: Uint8Array, at: number) {
  return b[at] | (b[at + 1] << 8);
}
function u32(b: Uint8Array, at: number) {
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * ZIP에서 파일 하나하나를 꺼낸다.
 *
 * 가운데 목록(central directory)을 읽는다. 로컬 머리만 훑으면 크기가 0으로 적히고
 * 뒤에 따로 적히는 경우(data descriptor)를 놓친다. 엑셀이 그렇게 쓸 때가 있다.
 */
async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();

  // 끝 표시를 뒤에서부터 찾는다. 주석이 붙어 있을 수 있어 끝에서 바로는 아니다.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP 끝 표시를 찾지 못했습니다.');

  const count = u16(bytes, eocd + 10);
  let at = u32(bytes, eocd + 16);
  const dec = new TextDecoder();

  for (let i = 0; i < count; i++) {
    if (u32(bytes, at) !== 0x02014b50) break;
    const method = u16(bytes, at + 10);
    const compSize = u32(bytes, at + 20);
    const nameLen = u16(bytes, at + 28);
    const extraLen = u16(bytes, at + 30);
    const commentLen = u16(bytes, at + 32);
    const localAt = u32(bytes, at + 42);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));

    // 로컬 머리에서 실제 데이터가 시작하는 자리를 다시 센다.
    const localNameLen = u16(bytes, localAt + 26);
    const localExtraLen = u16(bytes, localAt + 28);
    const start = localAt + 30 + localNameLen + localExtraLen;
    const raw = bytes.subarray(start, start + compSize);

    out.set(name, method === 0 ? raw : await inflateRaw(raw));
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* ── 시트 읽기 ──────────────────────────────────────────────── */

const XML_ENT: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function unesc(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENT[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** <si> 하나에 <t>가 여러 개일 수 있다(글자마다 서식이 다를 때). 다 이어 붙인다. */
function readSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.split('<si>').slice(1)) {
    const chunk = si.slice(0, si.indexOf('</si>'));
    let text = '';
    for (const m of chunk.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += unesc(m[1]);
    out.push(text);
  }
  return out;
}

function colOf(ref: string): string {
  return ref.replace(/\d+/g, '');
}

/** 엑셀 날짜(1899-12-30부터 센 날 수)를 YYYY-MM-DD로 */
export function fromExcelSerial(serial: number): string {
  const ms = (serial - 25569) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function readSheet(xml: string, shared: string[]): Row[] {
  const rows: Row[] = [];
  for (const chunk of xml.split('<row ').slice(1)) {
    const cells: Record<string, string | number> = {};
    for (const m of chunk.matchAll(/<c ([^>]*?)\/?>([\s\S]*?)(?=<c |<\/row>|$)/g)) {
      const attrs = m[1];
      const body = m[2];
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      if (!ref) continue;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];

      let value: string | number | undefined;
      if (type === 's' && v !== undefined) value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') {
        let text = '';
        for (const t of body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += unesc(t[1]);
        value = text;
      } else if (type === 'str' && v !== undefined) value = unesc(v);
      else if (v !== undefined) value = Number(v);

      if (value !== undefined && value !== '') cells[colOf(ref)] = value;
    }
    if (Object.keys(cells).length > 0) rows.push(cells);
  }
  return rows;
}

/* ── 칸 찾기 ────────────────────────────────────────────────── */

const WANTED = {
  memo: ['지출 내역', '내역', '메모', '내용', '적요', 'memo'],
  amount: ['금액', '사용액', '사용금액', '지출액', 'amount'],
  date: ['날짜', '일자', '사용일', 'date'],
  category: ['카테고리', '분류', '항목', 'category'],
  source: ['출금처', '결제수단', '수단', '카드', 'method'],
  purse: ['지갑', '구분', '용도', '누구', 'purse'],
  holder: ['명의', '카드주인', 'holder'],
} as const;

/**
 * 머리글 줄을 찾아 칸 위치를 잡는다.
 *
 * 첫 줄이 머리글이 아닌 파일이 흔하다(제목이나 빈 줄이 위에 있다). 그래서 위에서
 * 열 줄까지 훑으며 '금액'과 '날짜'가 같이 있는 줄을 머리글로 본다. 그 둘이 없으면
 * 가계부로 읽을 수가 없다.
 */
function findHeader(
  rows: Row[],
): { at: number; map: Partial<Record<keyof typeof WANTED, string>> } | null {
  const keys = Object.keys(WANTED) as (keyof typeof WANTED)[];

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cols = Object.entries(rows[i]).map(
      ([col, raw]) => [col, String(raw).trim().toLowerCase()] as const,
    );
    const map: Partial<Record<keyof typeof WANTED, string>> = {};
    const taken = new Set<string>();

    /*
      딱 맞는 이름을 먼저 가져간 다음에야 비슷한 이름을 본다.
      이 순서를 안 지키면 '지출 내역'이 '지출'에 걸려서 금액 칸으로 잡히고,
      금액 자리에 가게 이름이 들어와 한 줄도 못 읽는다. 실제로 그렇게 틀렸었다.
    */
    for (const pass of ['exact', 'loose'] as const) {
      for (const key of keys) {
        if (map[key]) continue;
        const names = WANTED[key].map((n) => n.toLowerCase());
        const hit = cols.find(
          ([col, text]) =>
            !taken.has(col) &&
            (pass === 'exact' ? names.includes(text) : names.some((n) => text.includes(n))),
        );
        if (hit) {
          map[key] = hit[0];
          taken.add(hit[0]);
        }
      }
    }

    if (map.amount && map.date) return { at: i, map };
  }
  return null;
}

/* ── 들여오기 ───────────────────────────────────────────────── */

export async function importLedgerXlsx(file: ArrayBuffer): Promise<ImportResult> {
  let files: Map<string, Uint8Array>;
  try {
    files = await unzip(new Uint8Array(file));
  } catch {
    return {
      error:
        '엑셀 파일을 여는 데 실패했어요. 쓰시는 브라우저가 오래됐을 수 있습니다. 스프레드시트에서 CSV로 저장해 올려주세요.',
    };
  }

  const dec = new TextDecoder();
  const sharedBytes = files.get('xl/sharedStrings.xml');
  const shared = sharedBytes ? readSharedStrings(dec.decode(sharedBytes)) : [];

  const bookBytes = files.get('xl/workbook.xml');
  if (!bookBytes) return { error: '엑셀 파일이 아니에요. .xlsx 파일을 올려주세요.' };
  const names = [...dec.decode(bookBytes).matchAll(/<sheet[^>]*name="([^"]*)"/g)].map((m) =>
    unesc(m[1]),
  );

  /*
    시트가 여럿이면 가계부처럼 생긴 첫 시트를 쓴다. 우리가 내보낸 파일은 '전체'가
    맨 앞이고, 사장님 파일은 월 이름 시트 하나뿐이라 둘 다 자연스럽게 걸린다.
  */
  for (let i = 0; i < names.length; i++) {
    const bytes = files.get(`xl/worksheets/sheet${i + 1}.xml`);
    if (!bytes) continue;
    const rows = readSheet(dec.decode(bytes), shared);
    const header = findHeader(rows);
    if (!header) continue;

    const entries: Entry[] = [];
    let skipped = 0;
    let cardBills = 0;

    for (const row of rows.slice(header.at + 1)) {
      const amountRaw = header.map.amount ? row[header.map.amount] : undefined;
      const dateRaw = header.map.date ? row[header.map.date] : undefined;
      const amount =
        typeof amountRaw === 'number'
          ? amountRaw
          : Number(String(amountRaw ?? '').replace(/[^0-9.-]/g, ''));
      if (!Number.isFinite(amount) || amount <= 0 || dateRaw === undefined) {
        skipped += 1;
        continue;
      }

      const date =
        typeof dateRaw === 'number'
          ? fromExcelSerial(dateRaw)
          : /^\d{4}-\d{2}-\d{2}/.test(String(dateRaw))
            ? String(dateRaw).slice(0, 10)
            : null;
      if (!date) {
        skipped += 1;
        continue;
      }

      const sourceText = header.map.source ? String(row[header.map.source] ?? '') : '';
      const { method, category: forced } = methodFromSource(sourceText);
      const spend = spendCategoryFrom(
        header.map.category ? String(row[header.map.category] ?? '') : '',
      );
      const memo = header.map.memo ? String(row[header.map.memo] ?? '').slice(0, 120) : '';

      /*
        지갑 칸은 쓰시던 가계부에 대개 없다. 있으면 읽고, 없으면 개인 생활비로
        둔 뒤 화면에서 바꾸시게 한다. 없는 걸 마음대로 데이트비로 찍으면
        공제 계산이 통째로 어긋난다.
      */
      const purseText = header.map.purse ? String(row[header.map.purse] ?? '') : '';
      const purse: Entry['purse'] =
        purseText.includes('커플') || purseText.includes('데이트') || purseText.includes('공동')
          ? 'group'
          : 'personal';

      const holderText = header.map.holder ? String(row[header.map.holder] ?? '') : '';
      const holder: Entry['holder'] =
        holderText.includes('배우자') || holderText.includes('상대') ? 'partner' : 'me';

      const billRow = isCardBill(memo) || isCardBill(sourceText);
      if (billRow) cardBills += 1;

      entries.push({
        id: newId(),
        date,
        amount: Math.round(amount),
        purse,
        method,
        holder,
        spend,
        /*
          카드값 갚은 줄과 계좌이체처럼 공제가 안 되는 출금처는 분류를 이긴다.
          거기에 공제를 붙이면 같은 돈을 두 번 세게 된다.
        */
        category: billRow ? 'excluded' : (forced ?? deductionCategoryOf(spend)),
        ...(memo ? { memo } : {}),
      });
    }

    if (entries.length === 0) continue;
    return {
      entries,
      sheet: names[i] ?? `시트${i + 1}`,
      skipped,
      cardBills,
      hadPurse: !!header.map.purse,
    };
  }

  return {
    error: '가계부로 읽을 수 있는 시트를 못 찾았어요. 머리글 줄에 금액과 날짜 칸이 있어야 합니다.',
  };
}
