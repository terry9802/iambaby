import {
  CATEGORY_LABEL,
  HOLDER_LABEL,
  METHOD_LABEL,
  PURSE_LABEL,
  sanitizeEntries,
  type Entry,
} from './schema';
import { zip, type ZipFile } from './zip';

/**
 * 시트를 나눈 엑셀 파일 만들기.
 *
 * CSV는 칸은 되지만 시트가 하나뿐이다. 개인 생활비와 커플 데이트비를 갈라
 * 보시려면 시트가 나뉘어야 해서 .xlsx로 만든다.
 *
 * .xlsx는 XML 몇 장을 담은 ZIP이다. 글자는 sharedStrings 없이 칸마다 직접
 * 넣는다(inlineStr). 글자를 모아 번호를 매기는 쪽이 파일은 작지만, 가계부처럼
 * 같은 말이 몇 번 안 나오는 표에서는 이득이 거의 없고 코드만 복잡해진다.
 */

const SHEETS = [
  { name: '전체', filter: () => true },
  { name: '개인 생활비', filter: (e: Entry) => e.purse === 'personal' },
  { name: '커플 데이트비', filter: (e: Entry) => e.purse === 'couple' },
] as const;

const HEADERS = ['날짜', '금액', '지갑', '결제수단', '명의', '분류', '메모'] as const;

/** XML에서 뜻이 있는 글자를 그대로 두면 파일이 깨진다. */
function esc(text: string): string {
  return (
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      /*
      엑셀이 못 읽는 제어 문자를 턴다. 메모를 다른 데서 붙여 넣으면 눈에 안 보이는
      글자가 섞여 들어오는데, 그게 하나만 있어도 파일이 아예 안 열린다.
    */
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  );
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

function cell(ref: string, value: string | number): string {
  if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
  if (value === '') return `<c r="${ref}"/>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function sheetXml(rows: (string | number)[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row.map((v, c) => cell(`${colName(c)}${r + 1}`, v)).join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="12" customWidth="1"/><col min="3" max="6" width="14" customWidth="1"/><col min="7" max="7" width="28" customWidth="1"/></cols><sheetData>${body}</sheetData></worksheet>`;
}

function rowsFor(entries: Entry[]): (string | number)[][] {
  return [
    [...HEADERS],
    ...entries.map((e) => [
      e.date,
      e.amount,
      PURSE_LABEL[e.purse],
      METHOD_LABEL[e.method],
      HOLDER_LABEL[e.holder],
      CATEGORY_LABEL[e.category],
      e.memo ?? '',
    ]),
  ];
}

export function entriesToXlsx(entries: Entry[]): Uint8Array {
  const clean = sanitizeEntries(entries);
  const enc = new TextEncoder();
  const sheets = SHEETS.map((s) => ({ name: s.name, rows: rowsFor(clean.filter(s.filter)) }));

  const sheetTags = sheets
    .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  const relTags = sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('');
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
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`,
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
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relTags}</Relationships>`,
      ),
    },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc.encode(sheetXml(s.rows)),
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
