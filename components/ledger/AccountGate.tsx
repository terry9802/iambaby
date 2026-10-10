'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  dropAccount,
  logIn,
  profileChanged,
  signUp,
  syncOnce,
  type Auth,
  type Fail,
  type Vault,
} from '@/lib/account/client';
import { idProblem, PIN_MAX, PIN_MIN, pinProblem, weakPin } from '@/lib/account/schema';
import {
  bumpSession,
  clearSession,
  saveSession,
  serverSessionSnapshot,
  sessionSnapshot,
  subscribeSession,
  type Session,
} from '@/lib/account/session';
import type { Grave, Entry } from '@/lib/ledger/schema';
import type { Side } from '@/lib/ledger/sync-merge';
import { useProfile } from '@/lib/profile/context';
import { storageWorks } from '@/lib/ledger/storage';
import { Icon } from '@/components/ui/Icon';

/**
 * 가계부 로그인.
 *
 * 전에는 기기마다 따로 적히고, 옮기려면 링크를 주고받아야 했다. 사장님이
 * "할 게 너무 많다, 그냥 아이디랑 핀 넣으면 보이게 하라"고 하셨고 그게 맞다.
 * 이제 아이디와 핀만 있으면 어느 기기에서든 같은 가계부가 열린다.
 *
 * 올라가는 건 브라우저에서 잠근 덩어리뿐이다. 핀은 서버로 가지 않고, 핀을
 * 30만 번 돌려 만든 증표만 간다.
 */

/*
  저장이 되는 브라우저인지는 한 번만 보면 된다. 쓰기가 막힌 창이 열려 있는 동안
  갑자기 풀리지는 않는다. useSyncExternalStore는 같은 값을 돌려주는 getSnapshot을
  요구하므로 한 번 적어 두고 그걸 돌려준다.
*/
let storageProbe: boolean | null = null;
const noSubscribe = () => () => {};
function readStorageProbe(): boolean {
  if (storageProbe === null) storageProbe = storageWorks();
  return storageProbe;
}

/** 적자마자 올리지 않는다. 연달아 적으실 때 한 번만 올라가게 묶는다. */
const PUSH_DELAY_MS = 2000;
/** 다른 기기가 올린 걸 받아오는 간격. */
const POLL_MS = 45_000;

type Status =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'ok'; at: string }
  | { kind: 'off' }
  | { kind: 'error'; message: string };

function sayFail(f: Fail): string {
  if (f.kind === 'wrong') return '아이디나 핀이 맞지 않아요.';
  if (f.kind === 'taken') return '이미 쓰고 있는 아이디예요. 다른 아이디로 지어 주세요.';
  if (f.kind === 'locked') return f.message;
  if (f.kind === 'off') return '가계부 서버가 아직 준비되지 않았어요.';
  return f.message;
}

export function AccountGate({
  entries,
  graves,
  applySide,
}: {
  entries: Entry[];
  graves: Grave[];
  applySide: (side: Side) => boolean;
}) {
  /*
    프로필도 같이 싣는다. 연봉이나 결혼 여부는 기기마다 다시 적을 값이 아니고,
    가계부만 따라오고 프로필은 안 따라오면 "저건 왜 안 돼요"가 또 나온다.
  */
  const { profile, updatedAt: profileAt, adopt } = useProfile();
  const session = useSyncExternalStore(
    subscribeSession,
    sessionSnapshot,
    serverSessionSnapshot,
  );

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [id, setId] = useState('');
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [confirmOut, setConfirmOut] = useState(false);
  /* 서버 그림은 '된다'로 둔다. 멀쩡한 기기에서 화면이 한 번 깜빡이면 안 된다. */
  const storageOk = useSyncExternalStore(noSubscribe, readStorageProbe, () => true);

  /*
    올릴 거리와 앉히는 함수를 칸에 담아 둔다. 맞추는 효과가 이것들을 지켜보면
    한 줄 적을 때마다 시계가 통째로 다시 걸린다. 담는 일은 그린 뒤에 한다.
  */
  const sideRef = useRef<Vault>({ entries, graves, profile, profileAt });
  const applyRef = useRef<(v: Vault) => void>(() => {});
  useEffect(() => {
    sideRef.current = { entries, graves, profile, profileAt };
    applyRef.current = (v: Vault) => {
      applySide({ entries: v.entries, graves: v.graves });
      // 프로필은 바뀌었을 때만 앉힌다. 매번 앉히면 저장이 끝없이 돈다.
      if (profileChanged({ entries: [], graves: [], profile, profileAt }, v)) {
        adopt(v.profile ?? {}, v.profileAt ?? null);
      }
    };
  });

  const fingerprint = [
    entries.map((e) => `${e.id}@${e.at ?? ''}`).sort().join(','),
    graves.map((g) => `${g.id}@${g.at}`).sort().join(','),
    profileAt ?? '',
    JSON.stringify(profile),
  ].join('|');

  useEffect(() => {
    if (!session) return;
    let alive = true;
    const auth: Auth = {
      id: session.id,
      pin: session.pin,
      account: session.account,
      keySalt: session.keySalt,
    };

    const run = async () => {
      if (!alive) return;
      setStatus({ kind: 'syncing' });
      const out = await syncOnce(auth, sideRef.current);
      if (!alive) return;
      if ('kind' in out) {
        setStatus(
          out.kind === 'off' ? { kind: 'off' } : { kind: 'error', message: sayFail(out) },
        );
        return;
      }
      // 달라진 게 있을 때만 앉힌다. 매번 앉히면 쳇바퀴가 된다.
      if (out.changed) applyRef.current(out.vault);
      setStatus({ kind: 'ok', at: new Date().toISOString() });
    };

    const timer = window.setTimeout(run, PUSH_DELAY_MS);
    const beat = window.setInterval(run, POLL_MS);
    // 다른 창을 보다 돌아오시면 그 사이 올라온 게 있는지 본다.
    const onFocus = () => void run();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearInterval(beat);
      window.removeEventListener('focus', onFocus);
    };
  }, [session, fingerprint]);

  const submit = async () => {
    setFormError(null);
    const idBad = idProblem(id);
    if (idBad) return setFormError(idBad);
    const pinBad = pinProblem(pin);
    if (pinBad) return setFormError(pinBad);
    if (mode === 'signup' && pin !== pinAgain) {
      return setFormError('두 번 적으신 핀이 서로 달라요.');
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const made = await signUp(id, pin);
        if ('kind' in made) return setFormError(sayFail(made));
        /*
          가입하면 이 기기에 적혀 있던 줄을 그대로 올린다. 가입 전에 적어 두신
          게 사라지면 안 된다.
        */
        const out = await syncOnce(made, sideRef.current);
        if ('kind' in out) return setFormError(sayFail(out));
        applyRef.current(out.vault);
        finish({ ...made, since: new Date().toISOString() });
        return;
      }

      const opened = await logIn(id, pin);
      if ('kind' in opened) return setFormError(sayFail(opened));
      /*
        로그인은 덮어쓰기가 아니라 합치기다. 이 기기에만 있던 줄과 서버에 있던
        줄을 더한다. 덮어쓰면 로그인하는 순간 기기에 적어 두신 게 날아간다.
      */
      const out = await syncOnce(opened.auth, sideRef.current);
      if ('kind' in out) return setFormError(sayFail(out));
      applyRef.current(out.vault);
      finish({ ...opened.auth, since: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  };

  const finish = (next: Session) => {
    if (!saveSession(next)) {
      setFormError('이 브라우저는 저장을 막고 있어요. 일반 창으로 열어 주세요.');
      return;
    }
    bumpSession();
    setId('');
    setPin('');
    setPinAgain('');
    setStatus({ kind: 'ok', at: new Date().toISOString() });
  };

  const logOut = async (alsoServer: boolean) => {
    if (alsoServer && session) {
      await dropAccount({
        id: session.id,
        pin: session.pin,
        account: session.account,
        keySalt: session.keySalt,
      });
    }
    clearSession();
    bumpSession();
    setConfirmOut(false);
    setStatus({ kind: 'idle' });
  };

  const storageWarning = !storageOk && (
    <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
      이 브라우저는 저장을 막고 있어요. 시크릿·프라이빗 모드면 일반 창으로 열어 주세요. 지금
      적으시는 건 화면을 닫으면 사라집니다.
    </p>
  );

  /* ── 로그인한 뒤 ── */
  if (session) {
    return (
      <section className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-ink">
            {session.id}님의 가계부
          </h2>
          <span
            className={
              'rounded-full px-2.5 py-1 text-[12px] font-semibold ' +
              (status.kind === 'ok'
                ? 'bg-good-soft text-good'
                : status.kind === 'syncing' || status.kind === 'idle'
                  ? 'bg-sunk text-ink-soft'
                  : 'bg-alert-soft text-alert')
            }
          >
            {status.kind === 'ok'
              ? '저장됐어요'
              : status.kind === 'syncing'
                ? '저장 중…'
                : status.kind === 'off'
                  ? '서버 준비 중'
                  : status.kind === 'error'
                    ? '저장 안 됨'
                    : '곧 저장합니다'}
          </span>
        </div>

        {storageWarning}

        {/*
          잘 돌아갈 때는 짧게 적는다. 이 카드가 길면 아래 탭이 첫 화면 밖으로
          밀린다. 자세한 설명은 로그아웃을 누르셨을 때나 문제가 생겼을 때만 꺼낸다.
        */}
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          가계부와 프로필이 저절로 저장돼요. 어느 기기에서든 같은 아이디·핀으로 보입니다.
        </p>

        {status.kind === 'error' && (
          <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
            {status.message} 적으신 건 이 기기에 그대로 있고, 연결되면 저절로 올라갑니다.
          </p>
        )}

        {confirmOut ? (
          <div className="flex flex-col gap-2 rounded-[8px] bg-alert-soft px-3.5 py-3">
            <p className="text-[12.5px] leading-relaxed text-alert">
              어느 쪽을 고르셔도{' '}
              <strong className="font-semibold">이 기기에 적어 둔 기록은 안 지워집니다.</strong>
            </p>
            <button
              type="button"
              onClick={() => void logOut(false)}
              className="rounded-[8px] border border-line bg-surface px-3.5 py-2 text-left text-[13px] font-semibold text-ink-soft"
            >
              이 기기에서 나가기
              <span className="block text-[11.5px] font-normal text-ink-faint">
                다시 로그인하면 그대로 돌아옵니다
              </span>
            </button>
            <button
              type="button"
              onClick={() => void logOut(true)}
              className="rounded-[8px] bg-alert px-3.5 py-2 text-left text-[13px] font-semibold text-white"
            >
              계정을 아예 지우기
              <span className="block text-[11.5px] font-normal opacity-90">
                서버에 맡긴 것까지 없앱니다. 되돌릴 수 없어요
              </span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmOut(false)}
              className="rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft"
            >
              그만두기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmOut(true)}
            className="w-fit text-[12.5px] font-semibold text-ink-faint underline underline-offset-2 hover:text-ink-soft"
          >
            로그아웃
          </button>
        )}
      </section>
    );
  }

  /* ── 로그인 전 ── */
  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-line-strong bg-surface px-5 py-5">
      <div>
        <h2 className="text-[16px] font-bold text-ink">
          {mode === 'login' ? '가계부 열기' : '가계부 만들기'}
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          아이디와 핀만 있으면 <strong className="font-semibold text-ink">어느 기기에서든</strong>{' '}
          같은 가계부가 열려요. 쓴 돈 기록은 물론{' '}
          <strong className="font-semibold text-ink">내 프로필(연봉·결혼 여부 같은 것)</strong>도
          같이 따라옵니다.
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-ink-soft">아이디</span>
        <input
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="영문 소문자·숫자"
          className="w-full max-w-[260px] rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[16px] text-ink"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-ink-soft">핀 (숫자 {PIN_MIN}자리 이상)</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          maxLength={PIN_MAX}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
          placeholder="••••••"
          className="w-[160px] rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[16px] tracking-[0.3em] text-ink"
        />
      </label>

      {mode === 'signup' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ink-soft">핀 한 번 더</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={PIN_MAX}
              value={pinAgain}
              onChange={(e) => setPinAgain(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
              placeholder="••••••"
              className="w-[160px] rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[16px] tracking-[0.3em] text-ink"
            />
          </label>
          {/*
            막지는 않고 말만 한다. 못 쓰게 하면 적어 두시게 되어 더 나빠진다.
          */}
          {pin.length >= PIN_MIN && weakPin(pin) && (
            <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12px] leading-relaxed text-alert">
              제일 먼저 찍어 보는 번호예요. 다른 숫자를 권합니다. 한 자리만 늘려도 열 배 안전해져요.
            </p>
          )}
          <p className="rounded-[8px] bg-sunk px-3 py-2.5 text-[12px] leading-relaxed text-ink-soft">
            <strong className="font-semibold text-ink">핀을 잊으면 저희도 못 열어 드려요.</strong>{' '}
            가계부는 핀으로 잠겨서 올라가고, 저희는 그 열쇠를 안 갖고 있습니다. 둘 다 기억할 숫자로
            정해 주세요.
          </p>
        </>
      )}

      {formError && (
        <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-[8px] bg-brand-strong px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-deep disabled:bg-sunk disabled:text-ink-faint"
        >
          <Icon name="lock" size={16} />
          {busy ? '여는 중…' : mode === 'login' ? '열기' : '만들기'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setFormError(null);
            setPinAgain('');
          }}
          className="text-[12.5px] font-semibold text-brand-strong underline underline-offset-2"
        >
          {mode === 'login' ? '처음이세요? 만들기' : '이미 있으세요? 열기'}
        </button>
      </div>

      {storageWarning}

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        지금 이 기기에 적어 두신 기록과 프로필이 있으면, 들어가실 때 함께 올라갑니다. 사라지지
        않아요.
      </p>
    </section>
  );
}
