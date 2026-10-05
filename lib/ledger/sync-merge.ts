import { byDateDesc, sanitizeEntries, sanitizeGraves, type Entry, type Grave } from './schema';

/**
 * 기기 둘(또는 사람 둘)의 가계부를 하나로 맞춘다.
 *
 * 파일로 주고받는 mergeEntries와 규칙이 다르다. 저쪽은 "상대가 보낸 줄을 더한다"라
 * 더하기만 하고 덮지 않는다. 받는 쪽이 고쳐 둔 메모를 상대의 옛 파일이 지우면
 * 안 되기 때문이다.
 *
 * 여기는 "같은 가계부를 여러 기기가 들고 있다"는 상황이다. 그래서 세 가지가 더 필요하다.
 *  - 같은 줄을 양쪽에서 고쳤으면 나중에 고친 쪽이 이긴다 (Entry.at)
 *  - 한쪽에서 지운 줄은 다른 쪽에서도 지워진다 (Grave)
 *  - 지운 뒤에 다시 적었으면 되살아난다 (적은 시각이 지운 시각보다 뒤니까)
 *
 * 이 셈은 순서를 타지 않는다. A와 B를 합치나 B와 A를 합치나 같은 값이 나오고,
 * 두 번 합쳐도 한 번 합친 것과 같다. 그래야 누가 먼저 올렸는지와 무관하게
 * 세 기기가 같은 자리로 모인다.
 */

export type Side = { entries: Entry[]; graves: Grave[] };

/** 묘비를 무한정 들고 다닐 수는 없다. 최근 것부터 이만큼만 남긴다. */
export const MAX_GRAVES = 1000;

/** 시각이 없는 옛 줄은 제일 오래된 것으로 친다. 시각이 적힌 쪽에 양보한다. */
function stamp(e: Entry): string {
  return e.at ?? '';
}

export function mergeSides(a: Side, b: Side): Side {
  const graves = sanitizeGraves([...a.graves, ...b.graves])
    .sort((x, y) => (x.at < y.at ? 1 : -1))
    .slice(0, MAX_GRAVES);
  const buried = new Map(graves.map((g) => [g.id, g.at]));

  const kept = new Map<string, Entry>();
  for (const e of [...sanitizeEntries(a.entries), ...sanitizeEntries(b.entries)]) {
    const had = kept.get(e.id);
    if (!had || stamp(had) < stamp(e)) kept.set(e.id, e);
  }

  const entries: Entry[] = [];
  for (const e of kept.values()) {
    const grave = buried.get(e.id);
    // 지운 시각보다 뒤에 고친 줄이면 되살린다. 같거나 앞서면 지워진 채로 둔다.
    if (grave !== undefined && stamp(e) <= grave) continue;
    entries.push(e);
  }

  /*
    되살아난 줄의 묘비는 버린다. 안 그러면 다음 기기가 그 묘비를 보고 또 지운다.
    이 줄은 지금 살아 있는 게 맞다는 판정이 이미 났다.
  */
  const alive = new Set(entries.map((e) => e.id));
  return {
    entries: entries.sort(byDateDesc),
    graves: graves.filter((g) => !alive.has(g.id)),
  };
}

/** 지운 줄을 묘비로 바꾼다. */
export function buryIds(graves: Grave[], ids: string[], now: string): Grave[] {
  return sanitizeGraves([...graves, ...ids.map((id) => ({ id, at: now }))])
    .sort((x, y) => (x.at < y.at ? 1 : -1))
    .slice(0, MAX_GRAVES);
}
