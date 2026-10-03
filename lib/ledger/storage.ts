import {
  LEDGER_SCHEMA_VERSION,
  LEDGER_STORAGE_KEY,
  sanitizeEntries,
  type Entry,
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

export function saveEntries(entries: Entry[]): boolean {
  if (!hasStorage()) return false;
  try {
    const payload: StoredLedger = {
      version: LEDGER_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      entries: sanitizeEntries(entries),
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
