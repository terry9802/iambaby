import { NextResponse } from 'next/server';
import {
  clearFailures,
  createAccount,
  dropAccount,
  failedTries,
  kvReady,
  noteFailure,
  readAccount,
  readVault,
  sealVerifier,
  writeVault,
} from '@/lib/sync/kv';

/**
 * 가계부 계정 창구. 가입·로그인·저장·지우기를 다 여기서 받는다.
 *
 * 서버는 가계부 안을 못 본다. 브라우저가 잠근 덩어리를 맡아 두기만 한다.
 * 핀도 안 온다. 오는 건 핀을 30만 번 돌려 만든 '증표'뿐이고, 그것마저 서버
 * 조각을 섞어 한 번 더 구겨서 둔다. (lib/account/crypto.ts에 사정을 적었다.)
 *
 * 그러니 여기에 덩어리를 풀거나 뜯어보거나 기록에 남기는 코드를 쓰지 말 것.
 *
 * 핀이 여섯 자리라 '찍어 보기'를 막는 게 이 파일의 중요한 일이다. 틀린 횟수를
 * 세고, 넘으면 잠근다. 이게 없으면 바깥에서 백만 번 돌려 보면 그만이다.
 */

export const dynamic = 'force-dynamic';

/** 계정 번호는 우리가 만든 꼴만 받는다. 아무 글자나 키로 쓰게 두지 않는다. */
const ACCOUNT_RE = /^[A-Za-z0-9_-]{16,64}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,512}$/;

/** 덩어리 크기 한도. 수천 줄이 들어가고도 남는다. */
const MAX_BLOB = 400_000;

/** 15분 동안 이만큼 틀리면 잠근다. 손으로 치다 틀릴 횟수보다는 넉넉하다. */
const MAX_FAILURES = 10;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function notReady() {
  return bad('가계부 서버가 아직 준비되지 않았어요. 잠시 뒤에 다시 시도해 주세요.', 503);
}

function locked() {
  return NextResponse.json(
    {
      error:
        '핀을 여러 번 잘못 넣어서 잠시 잠갔어요. 15분 뒤에 다시 해 주세요.',
      locked: true,
    },
    { status: 429, headers: { 'Retry-After': '900' } },
  );
}

type Body = {
  op?: unknown;
  account?: unknown;
  verifier?: unknown;
  version?: unknown;
  blob?: unknown;
};

export async function POST(request: Request) {
  if (!kvReady()) return notReady();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad('보낸 내용을 읽을 수 없어요.');
  }

  const op = body.op;
  const account = body.account;
  const verifier = body.verifier;
  if (typeof account !== 'string' || !ACCOUNT_RE.test(account)) return bad('계정이 올바르지 않아요.');
  if (typeof verifier !== 'string' || !TOKEN_RE.test(verifier)) return bad('증표가 올바르지 않아요.');

  try {
    if ((await failedTries(account)) >= MAX_FAILURES) return locked();
    const auth = await sealVerifier(verifier);

    if (op === 'signup') {
      /*
        열쇠 조각은 계정마다 새로 만든다. 이 조각이 섞여야 열쇠가 나오므로,
        로그인에 성공한 쪽만 가계부를 풀 수 있다.
      */
      const keySalt = crypto.randomUUID().replace(/-/g, '');
      const made = await createAccount(account, auth, keySalt);
      if (!made) {
        return NextResponse.json(
          { error: '이미 쓰고 있는 아이디예요. 다른 아이디로 지어 주세요.', taken: true },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: true, keySalt, version: 0, blob: null });
    }

    const found = await readAccount(account);
    /*
      없는 아이디와 틀린 핀을 같은 말로 돌려준다. 다르게 말하면 "이 아이디는
      있다"는 사실이 새어 나가고, 남의 아이디를 하나씩 확인해 볼 수 있게 된다.
      다만 틀린 횟수는 계정이 있을 때만 센다. 없는 아이디로 남의 계정을 잠가
      버릴 수는 없어야 한다.
    */
    const okAuth = !!found && found.auth === auth;
    if (!okAuth) {
      if (found) await noteFailure(account);
      return NextResponse.json(
        { error: '아이디나 핀이 맞지 않아요.', wrong: true },
        { status: 401 },
      );
    }
    await clearFailures(account);

    if (op === 'open') {
      const slot = await readVault(account);
      return NextResponse.json({
        ok: true,
        keySalt: found.keySalt,
        version: slot?.version ?? 0,
        blob: slot?.blob ?? null,
      });
    }

    if (op === 'save') {
      const version = Number(body.version);
      const blob = body.blob;
      if (!Number.isInteger(version) || version < 0) return bad('판수가 올바르지 않아요.');
      if (typeof blob !== 'string' || blob.length === 0) return bad('보낼 내용이 없어요.');
      if (blob.length > MAX_BLOB) {
        return bad('기록이 너무 많아요. 엑셀로 받아 두고 오래된 해를 비워 주세요.', 413);
      }
      if (!/^[A-Za-z0-9_-]+$/.test(blob)) return bad('보낸 내용이 올바르지 않아요.');

      const out = await writeVault(account, version, blob);
      if (out.ok) return NextResponse.json({ ok: true, version: out.version });
      /*
        그 사이 다른 기기가 먼저 올렸다. 지금 값을 돌려주면 브라우저가 합쳐서
        다시 올린다. 여기서 덮으면 상대가 방금 적은 줄이 사라진다.
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
    }

    if (op === 'drop') {
      await dropAccount(account);
      return NextResponse.json({ ok: true });
    }

    return bad('무엇을 할지 알 수 없어요.');
  } catch {
    return bad('지금은 연결이 안 돼요.', 502);
  }
}
