import { sanitizeEntries, type Entry } from './schema';
import { sanitizeProfile, type Profile } from '@/lib/profile/schema';

/**
 * 기기를 옮길 때 쓰는 꾸러미.
 *
 * 이 사이트는 적은 것을 서버에 보내지 않는다. 그래서 컴퓨터에 적은 줄이
 * 폰에 저절로 따라오지 않는다. 브라우저의 저장 공간은 기기마다, 브라우저마다
 * 따로이기 때문이다. 같은 폰에서도 카카오톡 안에서 열었을 때와 사파리로
 * 열었을 때가 다른 칸이다.
 *
 * 서버를 두지 않고 옮기는 방법으로 주소 뒤에 붙는 #(우물 정) 조각을 쓴다.
 * 이 조각은 브라우저가 서버로 보내지 않는 유일한 부분이다. 주소창에 적혀 있어도
 * 서버 접속 기록에는 남지 않는다. 그러니 "링크 하나로 옮기기"를 서버 없이 할 수 있다.
 *
 * 다만 그 링크를 카카오톡으로 보내면 그 글자는 카카오톡에 남는다. 그건 사장님이
 * 직접 고르는 일이라, 화면에서 그렇게 적어 두고 파일로 옮기는 길도 같이 남긴다.
 */

export const HANDOFF_HASH_KEY = 'h';

/** 주소에 실을 수 있는 글자 수. 넘으면 링크가 중간에 잘려 못 읽는다. */
export const HANDOFF_MAX_CHARS = 8000;

export type Handoff = {
  kind: 'nanaegi.handoff';
  version: 1;
  at: string;
  entries: Entry[];
  /** 프로필도 같이 보낼지는 보내는 쪽에서 고른다. 연봉이 들어 있어서다. */
  profile?: Profile;
};

function toBase64Url(bytes: Uint8Array): string {
  /*
    btoa에 바이트를 넘길 때 스프레드(...)로 펼치면 수만 개에서 스택이 터진다.
    기록이 쌓이면 실제로 그 크기가 되므로 끊어서 붙인다.
  */
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    s += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * 압축한다. 안 되는 브라우저면 null을 돌려주고 날것으로 싣는다.
 * 압축이 되면 링크가 1/4쯤으로 줄어서 그만큼 더 많은 줄을 실을 수 있다.
 */
async function squeeze(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (typeof CompressionStream === 'undefined') return null;
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function loosen(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (typeof DecompressionStream === 'undefined') return null;
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * 꾸러미를 주소에 실을 글자로 만든다.
 *
 * 맨 앞 한 글자가 압축했는지 여부다. 'z'면 압축한 것, 'p'면 날것.
 * 이 글자를 안 두면 받는 쪽이 둘 다 시도해 봐야 하고, 실패했을 때
 * 압축이 문제인지 내용이 문제인지 구분이 안 된다.
 */
export async function encodeHandoff(
  entries: Entry[],
  profile: Profile | null,
  now: string,
): Promise<string> {
  const payload: Handoff = {
    kind: 'nanaegi.handoff',
    version: 1,
    at: now,
    entries: sanitizeEntries(entries),
    ...(profile ? { profile: sanitizeProfile(profile) } : {}),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const packed = await squeeze(bytes);
  return packed ? `z${toBase64Url(packed)}` : `p${toBase64Url(bytes)}`;
}

export type HandoffRead =
  | { entries: Entry[]; profile: Profile | null; at: string | null }
  | { error: string };

export async function decodeHandoff(token: string): Promise<HandoffRead> {
  const trimmed = token.trim();
  if (trimmed.length < 2) return { error: '옮기기 링크가 비어 있어요.' };

  const mode = trimmed[0];
  const body = fromBase64Url(trimmed.slice(1));
  if (!body) return { error: '링크가 중간에 잘린 것 같아요. 다시 복사해서 보내 주세요.' };

  let bytes: Uint8Array | null = body;
  if (mode === 'z') {
    bytes = await loosen(body);
    if (!bytes) {
      return {
        error:
          '이 브라우저에서는 옮기기 링크를 풀 수 없어요. 합치기 파일로 보내 주시면 읽을 수 있습니다.',
      };
    }
  } else if (mode !== 'p') {
    return { error: '옮기기 링크가 아니에요.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { error: '링크가 중간에 잘린 것 같아요. 다시 복사해서 보내 주세요.' };
  }
  if (!parsed || typeof parsed !== 'object') return { error: '옮기기 링크가 아니에요.' };

  const raw = parsed as Record<string, unknown>;
  if (raw.kind !== 'nanaegi.handoff') return { error: '이 사이트에서 만든 옮기기 링크가 아니에요.' };

  const entries = sanitizeEntries(raw.entries);
  const profile =
    raw.profile && typeof raw.profile === 'object' ? sanitizeProfile(raw.profile) : null;
  if (entries.length === 0 && (!profile || Object.keys(profile).length === 0)) {
    return { error: '링크에 읽을 수 있는 내용이 없어요.' };
  }
  return {
    entries,
    profile,
    at: typeof raw.at === 'string' ? raw.at : null,
  };
}

/** 주소의 # 조각에서 옮기기 글자를 꺼낸다. 없으면 null. */
export function readHandoffHash(hash: string): string | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!body) return null;
  for (const part of body.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq) === HANDOFF_HASH_KEY) {
      const value = part.slice(eq + 1);
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

export function handoffLink(origin: string, pathname: string, token: string): string {
  return `${origin}${pathname}#${HANDOFF_HASH_KEY}=${token}`;
}
