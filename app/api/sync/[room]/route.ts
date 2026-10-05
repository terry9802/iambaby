import { NextResponse } from 'next/server';
import { dropRoom, kvReady, readRoom, tooMany, writeRoom } from '@/lib/sync/kv';

/**
 * 커플 가계부 동기화 창구.
 *
 * 이 창구는 덩어리를 맡아 두기만 한다. 안에 무엇이 들었는지 서버는 모른다.
 * 브라우저가 올리기 전에 잠그고, 받아서 푸는 열쇠는 여기로 오지 않는다.
 * (lib/sync/crypto.ts에 사정을 적어 뒀다.)
 *
 * 그래서 이 파일에 덩어리를 풀거나, 뜯어보거나, 기록에 남기는 코드를 쓰지 말 것.
 * 개인정보처리방침이 "운영자도 볼 수 없다"고 적고 있고, 그 말이 사실이어야 한다.
 */

export const dynamic = 'force-dynamic';

/** 방 번호는 우리가 만든 22자리 꼴만 받는다. 아무 글자나 키로 쓰게 두지 않는다. */
const ROOM_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** 덩어리 크기 한도. 수천 줄이 들어가고도 남는다. */
const MAX_BLOB = 400_000;

const READS_PER_MINUTE = 60;
const WRITES_PER_MINUTE = 30;

function notReady() {
  return NextResponse.json(
    { error: '커플 가계부 서버가 아직 준비되지 않았어요. 옮기기 링크를 쓰시면 됩니다.' },
    { status: 503 },
  );
}

function badRoom() {
  return NextResponse.json({ error: '방 번호가 올바르지 않아요.' }, { status: 400 });
}

function busy() {
  return NextResponse.json(
    { error: '잠시 뒤에 다시 시도해 주세요.' },
    { status: 429, headers: { 'Retry-After': '60' } },
  );
}

export async function GET(_request: Request, ctx: { params: Promise<{ room: string }> }) {
  const { room } = await ctx.params;
  if (!ROOM_RE.test(room)) return badRoom();
  if (!kvReady()) return notReady();
  try {
    if (await tooMany(room, READS_PER_MINUTE)) return busy();
    const slot = await readRoom(room);
    return NextResponse.json(
      slot ? { version: slot.version, blob: slot.blob } : { version: 0, blob: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: '지금은 연결이 안 돼요.' }, { status: 502 });
  }
}

/**
 * 맡겨 둔 덩어리를 지운다.
 *
 * 방 번호를 아는 사람이면 지울 수 있다. 핀 없이 지우게 두는 이유는, 핀을 잊은
 * 분이 자기 자료를 못 지우는 쪽이 더 나쁘기 때문이다. 지우기는 남의 내용을
 * 들여다보는 일이 아니고, 각자 기기의 기록은 그대로 남는다.
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ room: string }> }) {
  const { room } = await ctx.params;
  if (!ROOM_RE.test(room)) return badRoom();
  if (!kvReady()) return notReady();
  try {
    if (await tooMany(room, WRITES_PER_MINUTE)) return busy();
    await dropRoom(room);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '지금은 연결이 안 돼요.' }, { status: 502 });
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ room: string }> }) {
  const { room } = await ctx.params;
  if (!ROOM_RE.test(room)) return badRoom();
  if (!kvReady()) return notReady();

  let body: { version?: unknown; blob?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: '보낸 내용을 읽을 수 없어요.' }, { status: 400 });
  }

  const version = Number(body.version);
  const blob = body.blob;
  if (!Number.isInteger(version) || version < 0) {
    return NextResponse.json({ error: '판수가 올바르지 않아요.' }, { status: 400 });
  }
  if (typeof blob !== 'string' || blob.length === 0) {
    return NextResponse.json({ error: '보낼 내용이 없어요.' }, { status: 400 });
  }
  if (blob.length > MAX_BLOB) {
    return NextResponse.json(
      { error: '기록이 너무 많아요. 엑셀로 받아 두고 오래된 해를 비워 주세요.' },
      { status: 413 },
    );
  }
  // 잠긴 덩어리는 base64url 글자만으로 되어 있다. 아니면 우리가 만든 게 아니다.
  if (!/^[A-Za-z0-9_-]+$/.test(blob)) {
    return NextResponse.json({ error: '보낸 내용이 올바르지 않아요.' }, { status: 400 });
  }

  try {
    if (await tooMany(room, WRITES_PER_MINUTE)) return busy();
    const out = await writeRoom(room, version, blob);
    if (out.ok) return NextResponse.json({ ok: true, version: out.version });
    /*
      그 사이 상대가 먼저 올렸다. 지금 값을 돌려주면 브라우저가 그걸 합쳐서
      다시 올린다. 여기서 그냥 덮으면 상대가 방금 적은 줄이 사라진다.
    */
    return NextResponse.json(
      {
        ok: false,
        conflict: true,
        version: out.current?.version ?? 0,
        blob: out.current?.blob ?? null,
      },
      { status: 409 },
    );
  } catch {
    return NextResponse.json({ error: '지금은 연결이 안 돼요.' }, { status: 502 });
  }
}
