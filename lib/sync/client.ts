import { mergeSides, type Side } from '@/lib/ledger/sync-merge';
import { sanitizeEntries, sanitizeGraves } from '@/lib/ledger/schema';
import { seal, unseal } from './crypto';

/**
 * 브라우저가 서버와 한 바퀴 맞추는 절차.
 *
 *   1. 서버에 올라와 있는 덩어리를 받아서 푼다
 *   2. 내 것과 합친다 (mergeSides가 규칙을 안다)
 *   3. 합친 결과가 서버 것과 다르면 다시 잠가서 올린다
 *
 * 2번이 핵심이다. 그냥 덮으면 그 사이에 상대가 적은 줄이 사라진다. 합치기는
 * 순서를 타지 않으므로, 둘이 아무 때나 올려도 결국 같은 자리로 모인다.
 *
 * 올라가는 건 잠긴 덩어리뿐이다. 핀과 방 열쇠는 이 파일을 거쳐 나가지 않는다.
 */

export type SyncOutcome =
  | { state: 'ok'; side: Side; changed: boolean }
  /** 서버에 있는 걸 못 열었다. 핀이 다르거나 방 열쇠가 다르다. */
  | { state: 'pin' }
  /** 서버가 아직 준비되지 않았다 */
  | { state: 'off' }
  | { state: 'busy' }
  | { state: 'error'; message: string };

const EMPTY: Side = { entries: [], graves: [] };

/** 올릴 거리가 있는지 보는 지문. 금액은 안 본다. 달라지면 어차피 시각이 달라진다. */
function fingerprint(s: Side): string {
  const rows = s.entries.map((e) => `${e.id}@${e.at ?? ''}`).sort().join(',');
  const tombs = s.graves.map((g) => `${g.id}@${g.at}`).sort().join(',');
  return `${rows}|${tombs}`;
}

function cleanSide(raw: unknown): Side {
  const o = (raw ?? {}) as { entries?: unknown; graves?: unknown };
  return { entries: sanitizeEntries(o.entries), graves: sanitizeGraves(o.graves) };
}

type Fetched = { version: number; blob: string | null };

async function pull(roomId: string): Promise<Fetched | SyncOutcome> {
  const res = await fetch(`/api/sync/${roomId}`, { cache: 'no-store' });
  if (res.status === 503) return { state: 'off' };
  if (res.status === 429) return { state: 'busy' };
  if (!res.ok) return { state: 'error', message: '지금은 연결이 안 돼요.' };
  return (await res.json()) as Fetched;
}

/** 맞서 올리기를 몇 번까지 다시 해볼지. 둘이 동시에 올릴 때만 쓰인다. */
const MAX_RETRY = 4;

export async function syncOnce(
  roomId: string,
  key: CryptoKey,
  local: Side,
): Promise<SyncOutcome> {
  let got: Fetched | SyncOutcome;
  try {
    got = await pull(roomId);
  } catch {
    return { state: 'error', message: '지금은 연결이 안 돼요.' };
  }
  if ('state' in got) return got;

  let version = got.version;
  let remote: Side = EMPTY;
  if (got.blob) {
    const opened = await unseal<unknown>(key, got.blob);
    if (opened === null) return { state: 'pin' };
    remote = cleanSide(opened);
  }

  for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
    const merged = mergeSides(local, remote);
    const changedHere = fingerprint(merged) !== fingerprint(local);

    // 서버 것과 같으면 올릴 게 없다. 괜히 두드리지 않는다.
    if (fingerprint(merged) === fingerprint(remote)) {
      return { state: 'ok', side: merged, changed: changedHere };
    }

    let res: Response;
    try {
      res = await fetch(`/api/sync/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, blob: await seal(key, merged) }),
      });
    } catch {
      return { state: 'error', message: '지금은 연결이 안 돼요.' };
    }

    if (res.ok) return { state: 'ok', side: merged, changed: changedHere };
    if (res.status === 503) return { state: 'off' };
    if (res.status === 429) return { state: 'busy' };

    if (res.status === 409) {
      /*
        그 사이 상대가 먼저 올렸다. 서버가 돌려준 지금 값을 받아 다시 합치고
        또 올린다. 여기서 포기하면 내가 방금 적은 줄이 안 올라간 채로 남는다.
      */
      const now = (await res.json()) as { version?: number; blob?: string | null };
      version = typeof now.version === 'number' ? now.version : version;
      if (now.blob) {
        const opened = await unseal<unknown>(key, now.blob);
        if (opened === null) return { state: 'pin' };
        remote = cleanSide(opened);
      } else {
        remote = EMPTY;
      }
      continue;
    }

    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { state: 'error', message: body.error ?? '올리지 못했어요.' };
  }

  return { state: 'error', message: '상대방과 동시에 적고 계신 것 같아요. 잠시 뒤 다시 맞춥니다.' };
}

/** 서버에 맡겨 둔 덩어리를 지운다. 각 기기에 적힌 기록은 그대로 남는다. */
export async function dropRoomOnServer(roomId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/sync/${roomId}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
