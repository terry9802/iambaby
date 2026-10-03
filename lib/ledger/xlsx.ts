import { SOURCE_LABEL, SPEND_CATEGORIES, type SpendCategory } from './categories';
import { CATEGORY_LABEL, HOLDER_LABEL, PURSE_LABEL, sanitizeEntries, type Entry } from './schema';
import { zip, type ZipFile } from './zip';

/**
 * 사장님이 쓰시던 가계부 양식에 맞춘 엑셀 만들기.
 *
 * 올려주신 파일의 칸은 이랬다.
 *   지출 내역 | 금액 | 날짜 | 카테고리 | 출금처
 * 옆에는 SUMIF로 카테고리별·출금처별 합계를 내고 차트를 붙여 두셨다.
 *
 * 그래서 이 다섯 칸을 같은 이름·같은 순서로 맨 앞에 둔다. 쓰시던 수식을
 * 그대로 복사해 붙이면 돌아간다. 우리만 쓰는 칸(지갑·명의·공제 분류)은
 * 그 뒤에 붙여서, 기존 수식의 열 번호를 흔들지 않는다.
 *
 * 수식 칸에는 계산해 둔 값을 안 적는다. 대신 workbook에 fullCalcOnLoad를 걸어서
 * 열 때 엑셀·구글 시트가 직접 세게 한다. 값을 박아 두면 줄을 고쳤을 때 합계가
 * 옛날 값으로 남아 있다가 사람을 속인다.
 *
 * 날짜는 글자가 아니라 엑셀 날짜로 넣는다. 글자로 넣으면 정렬도 월별 합계도
 * 안 된다. 금액도 원화 서식을 붙여서 올려주신 파일과 같은 모양으로 보이게 했다.
 */

const HEADERS = [
  '지출 내역',
  '금액',
  '날짜',
  '카테고리',
  '출금처',
  '지갑',
  '명의',
  '공제 분류',
] as const;

const SHEETS = [
  { name: '전체', filter: () => true },
  { name: '개인 생활비', filter: (e: Entry) => e.purse === 'personal' },
  { name: '커플 데이트비', filter: (e: Entry) => e.purse === 'couple' },
] as const;

/* 서식 번호. styles.xml에 적어 둔 순서와 맞춰야 한다. */
const STYLE = { header: 1, money: 2, date: 3 } as const;

/**
 * 엑셀의 날짜는 1899-12-30을 0으로 센 날 수다.
 * 1900년을 윤년으로 잘못 아는 옛 버그 때문에 1900-03-01 이전은 하루가 어긋나는데,
 * 가계부에 그 시절 날짜를 적을 일은 없으므로 그대로 둔다.
 */
export function excelSerial(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const days = Date.UTC(y, m - 1, d) / 86400000;
  return days + 25569;
}

/** XML에서 뜻이 있는 글자와 엑셀이 못 읽는 제어 문자를 턴다. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

function colName(index: number): string {
  let name = '';
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

type Cell = { v: string | number; s?: number };

function cellXml(ref: string, cell: Cell): string {
  const style = cell.s ? ` s="${cell.s}"` : '';
  if (typeof cell.v === 'number') return `<c r="${ref}"${style}><v>${cell.v}</v></c>`;
  if (cell.v === '') return `<c r="${ref}"${style}/>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(cell.v)}</t></is></c>`;
}

function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row.map((c, i) => cellXml(`${colName(i)}${r + 1}`, c)).join('')}</row>`,
    )
    .join('');
  const last = `${colName(HEADERS.length - 1)}${Math.max(1, rows.length)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="2" width="13" customWidth="1"/><col min="3" max="3" width="13" customWidth="1"/><col min="4" max="5" width="16" customWidth="1"/><col min="6" max="8" width="14" customWidth="1"/></cols><sheetData>${body}</sheetData></worksheet>`;
}

/**
 * 카테고리별 합계 시트.
 *
 * 올려주신 파일처럼 SUMIF로 낸다. 값을 박아 두면 줄을 고쳤을 때 합계가 안 따라오는데,
 * 수식으로 두면 엑셀이 알아서 다시 센다. 범위는 '전체' 시트를 가리킨다.
 */
function summarySheetXml(rowCount: number): string {
  const last = rowCount + 1;
  const rows: string[] = [
    `<row r="1"><c r="A1" s="${STYLE.header}" t="inlineStr"><is><t>카테고리</t></is></c><c r="B1" s="${STYLE.header}" t="inlineStr"><is><t>합계 금액</t></is></c><c r="D1" s="${STYLE.header}" t="inlineStr"><is><t>출금처</t></is></c><c r="E1" s="${STYLE.header}" t="inlineStr"><is><t>합계 금액</t></is></c></row>`,
  ];

  const sources = Object.values(SOURCE_LABEL);
  const height = Math.max(SPEND_CATEGORIES.length, sources.length);
  for (let i = 0; i < height; i++) {
    const r = i + 2;
    const cat = SPEND_CATEGORIES[i];
    const src = sources[i];
    const left = cat
      ? `<c r="A${r}" t="inlineStr"><is><t>${esc(cat)}</t></is></c><c r="B${r}" s="${STYLE.money}"><f>SUMIF(전체!D$2:D$${last},A${r},전체!B$2:B$${last})</f></c>`
      : '';
    const right = src
      ? `<c r="D${r}" t="inlineStr"><is><t>${esc(src)}</t></is></c><c r="E${r}" s="${STYLE.money}"><f>SUMIF(전체!E$2:E$${last},D${r},전체!B$2:B$${last})</f></c>`
      : '';
    rows.push(`<row r="${r}">${left}${right}</row>`);
  }

  const totalRow = height + 2;
  rows.push(
    `<row r="${totalRow}"><c r="A${totalRow}" s="${STYLE.header}" t="inlineStr"><is><t>총합</t></is></c><c r="B${totalRow}" s="${STYLE.money}"><f>SUM(B2:B${height + 1})</f></c><c r="D${totalRow}" s="${STYLE.header}" t="inlineStr"><is><t>총합</t></is></c><c r="E${totalRow}" s="${STYLE.money}"><f>SUM(E2:E${height + 1})</f></c></row>`,
  );

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:E${totalRow}"/><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="14" customWidth="1"/><col min="3" max="3" width="3" customWidth="1"/><col min="4" max="4" width="14" customWidth="1"/><col min="5" max="5" width="14" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

/**
 * 서식.
 *
 * 올려주신 파일과 같은 모양을 쓴다. 원화는 [$₩-412]#,##0, 날짜는 yyyy. m. d.
 * 번호 164·165는 엑셀이 예약해 둔 범위(0~163) 바깥이라야 해서 그렇게 잡는다.
 */
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="[$₩-412]#,##0"/><numFmt numFmtId="165" formatCode="yyyy. m. d"/></numFmts><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F6F5"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="표준" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function rowsFor(entries: Entry[]): Cell[][] {
  return [
    HEADERS.map((h) => ({ v: h as string, s: STYLE.header })),
    ...entries.map((e): Cell[] => [
      // 지출 내역 — 안 적으셨으면 무엇에 썼는지로 채운다. 빈 칸보다 낫다.
      { v: e.memo ?? (e.spend as string) ?? '' },
      { v: e.amount, s: STYLE.money },
      { v: excelSerial(e.date), s: STYLE.date },
      { v: (e.spend as SpendCategory | undefined) ?? '기타' },
      { v: SOURCE_LABEL[e.method] },
      { v: PURSE_LABEL[e.purse] },
      { v: HOLDER_LABEL[e.holder] },
      { v: CATEGORY_LABEL[e.category] },
    ]),
  ];
}

export function entriesToXlsx(entries: Entry[]): Uint8Array {
  const clean = sanitizeEntries(entries);
  const enc = new TextEncoder();
  const sheets = [
    ...SHEETS.map((s) => ({ name: s.name, xml: sheetXml(rowsFor(clean.filter(s.filter))) })),
    { name: '요약', xml: summarySheetXml(clean.length) },
  ];

  const sheetTags = sheets
    .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  const relTags = sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('');
  const styleRel = `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  const overrides = sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('');

  const files: ZipFile[] = [
    {
      name: '[Content_Types].xml',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relTags}${styleRel}</Relationships>`,
      ),
    },
    { name: 'xl/styles.xml', data: enc.encode(STYLES_XML) },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc.encode(s.xml),
    })),
  ];

  return zip(files);
}

export function xlsxFileName(entries: Entry[], today: string): string {
  const dates = entries.map((e) => e.date).sort();
  if (dates.length === 0) return `가계부_${today}.xlsx`;
  const from = dates[0];
  const to = dates[dates.length - 1];
  return from === to ? `가계부_${from}.xlsx` : `가계부_${from}_${to}.xlsx`;
}

/** 서버를 거치지 않는다. 브라우저 안에서 만든 파일을 그대로 떨군다. */
export function downloadXlsx(entries: Entry[], today: string): void {
  const bytes = entriesToXlsx(entries);
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = xlsxFileName(entries, today);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
