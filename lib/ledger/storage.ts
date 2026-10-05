import {
  LEDGER_SCHEMA_VERSION,
  LEDGER_STORAGE_KEY,
  sanitizeEntries,
  sanitizeGraves,
  type Entry,
  type Grave,
  type StoredLedger,
} from './schema';

/**
 * 가계부 저장소. localStorage만 쓴다.
 * 서버 전송 경로가 없다는 것이 이 사이트의 신뢰 근거이므로 여기에 네트워크 호출을 추가하지 말 것.
 */

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    // 사파리 프라이빗 모드 등에서 접근 자체가 예외를 던진다.
    return false;
  }
}

export function loadEntries(): Entry[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredLedger>;
    return sanitizeEntries(parsed?.entries);
  } catch {
    return [];
  }
}

export function loadGraves(): Grave[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeGraves((JSON.parse(raw) as Partial<StoredLedger>)?.graves);
  } catch {
    return [];
  }
}

export function saveEntries(entries: Entry[], graves: Grave[] = []): boolean {
  if (!hasStorage()) return false;
  try {
    const payload: StoredLedger = {
      version: LEDGER_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      entries: sanitizeEntries(entries),
      graves: sanitizeGraves(graves),
    };
    window.localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    /*
      저장소가 꽉 차면 여기서 터진다. 가계부는 줄이 계속 늘어나는 데이터라
      다른 화면보다 이 일이 실제로 일어날 수 있다. 조용히 삼키되 false를
      돌려줘서 화면이 "저장 못 했다"고 말할 수 있게 한다.
    */
    return false;
  }
}

export function clearEntries(): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.removeItem(LEDGER_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadLedgerMeta(): { updatedAt: string | null } {
  if (!hasStorage()) return { updatedAt: null };
  try {
    const raw = window.localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return { updatedAt: null };
    const parsed = JSON.parse(raw) as Partial<StoredLedger>;
    return { updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null };
  } catch {
    return { updatedAt: null };
  }
}

/**
 * 저장이 실제로 되는 기기인지 본다.
 *
 * localStorage가 있다고 쓸 수 있는 건 아니다. 사파리 프라이빗 모드나 저장 공간이
 * 꽉 찬 기기는 객체는 있고 쓰기만 터진다. 적고 나서 사라지는 게 제일 나쁜 일이라,
 * 화면에 들어올 때 한 번 써 보고 안 되면 미리 알린다.
 */
export function storageWorks(): boolean {
  if (!hasStorage()) return false;
  try {
    const probe = '__nanaegi.probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
