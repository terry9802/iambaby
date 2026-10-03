import { byDateDesc, sanitizeEntries, type Entry } from './schema';

/**
 * 두 사람의 가계부를 합친다.
 *
 * 서버가 없으니 각자 브라우저에 적고, 한쪽이 파일을 보내면 다른 쪽이 그 파일을
 * 가져와 합치는 식이다. 같은 파일을 두 번 가져와도 줄이 두 배가 되면 안 되므로
 * 아이디로 거른다. 아이디가 같으면 같은 줄이고, 나중 것으로 덮지 않는다.
 * 덮어 버리면 내가 고친 메모가 상대가 보낸 옛 파일에 지워질 수 있다.
 */
export function mergeEntries(mine: Entry[], incoming: Entry[], source?: string): Entry[] {
  const known = new Set(mine.map((e) => e.id));
  const added = sanitizeEntries(incoming)
    .filter((e) => !known.has(e.id))
    .map((e) => ({ ...e, ...(source && !e.source ? { source } : {}) }));
  return [...mine, ...added].sort(byDateDesc);
}

/** 가져온 파일에서 몇 줄이 새로 들어오고 몇 줄이 이미 있던 것인지 */
export function mergePreview(
  mine: Entry[],
  incoming: unknown,
): { added: number; duplicate: number; total: number } {
  const clean = sanitizeEntries(incoming);
  const known = new Set(mine.map((e) => e.id));
  const duplicate = clean.filter((e) => known.has(e.id)).length;
  return { added: clean.length - duplicate, duplicate, total: clean.length };
}

export type LedgerFile = {
  kind: 'nanaegi.ledger';
  version: 1;
  exportedAt: string;
  /** 보낸 사람이 자기를 부르는 이름. 합친 뒤 어느 줄이 누구 것인지 보려고 둔다. */
  from?: string;
  entries: Entry[];
};

export function toLedgerFile(entries: Entry[], from: string | undefined, now: string): LedgerFile {
  return {
    kind: 'nanaegi.ledger',
    version: 1,
    exportedAt: now,
    ...(from ? { from } : {}),
    entries: sanitizeEntries(entries),
  };
}

/**
 * 가져온 파일을 읽는다.
 *
 * 남이 보낸 파일이라 무엇이든 들어 있을 수 있다. 모양이 맞는지 보고,
 * 줄 하나하나는 sanitize가 다시 거른다. 아니면 무엇이 잘못됐는지 말해 준다.
 */
export function parseLedgerFile(
  text: string,
): { entries: Entry[]; from?: string } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: '가계부 파일이 아니에요. 내보내기로 받은 파일을 그대로 올려주세요.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { error: '가계부 파일이 아니에요. 내보내기로 받은 파일을 그대로 올려주세요.' };
  }
  const raw = parsed as Record<string, unknown>;
  if (raw.kind !== 'nanaegi.ledger') {
    return { error: '이 사이트에서 내보낸 가계부 파일이 아니에요.' };
  }
  const entries = sanitizeEntries(raw.entries);
  if (entries.length === 0) {
    return { error: '파일에 읽을 수 있는 줄이 없어요.' };
  }
  return {
    entries,
    ...(typeof raw.from === 'string' && raw.from ? { from: raw.from.slice(0, 40) } : {}),
  };
}
