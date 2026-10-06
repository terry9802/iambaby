'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { idProblem, PIN_MAX, PIN_MIN, pinProblem } from '@/lib/account/schema';
import { sayFail, type Fail } from '@/lib/account/transport';
import {
  createGroup,
  joinGroup,
  latestOther,
  syncGroup,
  type GroupAuth,
} from '@/lib/group/client';
import {
  bumpGroup,
  clearGroup,
  groupSnapshot,
  saveGroup,
  serverGroupSnapshot,
  subscribeGroup,
  type GroupSession,
} from '@/lib/group/session';
import {
  bumpGroupLog,
  clearGroupLog,
  groupLogSnapshot,
  markSeen,
  saveGroupLog,
  seenSnapshot,
  serverGroupLogSnapshot,
  serverSeenSnapshot,
  subscribeGroupLog,
  subscribeSeen,
} from '@/lib/group/store';
import type { Entry, Grave } from '@/lib/ledger/schema';
import { Icon } from '@/components/ui/Icon';

/**
 * 그룹 가계부.
 *
 * 여럿이 같은 가계부를 같이 적는 자리다. 둘이든 넷이든 된다. 그룹도 '아이디 +
 * 핀'을 가진 금고라, 공유하기는 그 둘을 보여 주는 일이다.
 *
 * 내 개인 핀과 그룹 핀은 다른 값이다. 그룹 핀이 새면 그 그룹 가계부만 열리고
 * 내 개인 가계부는 안 열린다. 화면에도 그렇게 적는다.
 */

const PUSH_DELAY_MS = 2000;
const POLL_MS = 45_000;

type Status =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'ok'; at: string }
  | { kind: 'error'; message: string };

export function GroupPanel({
  myId,
  entries,
  graves,
}: {
  /** 지금 로그인한 사람의 아이디. 그룹에 누가 적었는지 표시하는 데 쓴다. */
  myId: string;
  /** 내가 적은 줄 전부. 이 중 '그룹 지출'만 그룹 금고로 올라간다. */
  entries: Entry[];
  graves: Grave[];
}) {
  const group = useSyncExternalStore(subscribeGroup, groupSnapshot, serverGroupSnapshot);
  const log = useSyncExternalStore(subscribeGroupLog, groupLogSnapshot, serverGroupLogSnapshot);
  /* 어디까지 본 소식인지도 브라우저 저장소에 있다. 같은 방식으로 구독해서 읽는다. */
  const seen = useSyncExternalStore(subscribeSeen, seenSnapshot, serverSeenSnapshot);

  const [mode, setMode] = useState<'none' | 'make' | 'join'>('none');
  const [id, setId] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);


  const mineRef = useRef({ entries, graves, myId });
  useEffect(() => {
    mineRef.current = { entries, graves, myId };
  });

  const groupRows = entries.filter((e) => e.purse === 'group');
  const fingerprint = groupRows.map((e) => `${e.id}@${e.at ?? ''}`).sort().join(',');

  useEffect(() => {
    if (!group) return;
    let alive = true;
    const auth: GroupAuth = {
      id: group.id,
      pin: group.pin,
      account: group.account,
      keySalt: group.keySalt,
    };

    const run = async () => {
      if (!alive) return;
      setStatus({ kind: 'syncing' });
      const now = mineRef.current;
      const out = await syncGroup(
        auth,
        now.myId,
        now.entries.filter((e) => e.purse === 'group'),
        now.graves,
        group.name,
      );
      if (!alive) return;
      if ('kind' in out) {
        setStatus({ kind: 'error', message: sayFail(out) });
        return;
      }
      saveGroupLog(out.vault, new Date().toISOString());
      bumpGroupLog();
      setStatus({ kind: 'ok', at: new Date().toISOString() });
    };

    const timer = window.setTimeout(run, PUSH_DELAY_MS);
    const beat = window.setInterval(run, POLL_MS);
    const onFocus = () => void run();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearInterval(beat);
      window.removeEventListener('focus', onFocus);
    };
  }, [group, fingerprint]);

  const enter = async (making: boolean) => {
    setFormError(null);
    const idBad = idProblem(id);
    if (idBad) return setFormError(idBad.replace('아이디', '그룹 아이디'));
    const pinBad = pinProblem(pin);
    if (pinBad) return setFormError(pinBad.replace('핀', '그룹 핀'));

    setBusy(true);
    try {
      const out = making
        ? await createGroup(id, pin, name.trim() || undefined, myId)
        : await joinGroup(id, pin);
      if ('kind' in out) return setFormError(groupFail(out, making));

      const next: GroupSession = {
        ...out.auth,
        ...(out.vault.name ? { name: out.vault.name } : {}),
        since: new Date().toISOString(),
      };
      if (!saveGroup(next)) {
        return setFormError('이 브라우저는 저장을 막고 있어요. 일반 창으로 열어 주세요.');
      }
      saveGroupLog(out.vault, new Date().toISOString());
      bumpGroup();
      bumpGroupLog();
      setMode('none');
      setId('');
      setPin('');
      setName('');
      if (making) setShowShare(true);
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    clearGroup();
    clearGroupLog();
    bumpGroup();
    bumpGroupLog();
    setConfirmLeave(false);
    setShowShare(false);
    setStatus({ kind: 'idle' });
  };

  const copyInvite = async () => {
    if (!group) return;
    const text = `[${group.name ?? group.id}] 그룹 가계부에 초대합니다\n그룹 아이디: ${group.id}\n그룹 핀: ${group.pin}\n\niamstillbaby.com 에서 쓴 돈 적기 → 그룹 가계부 → 그룹 참여하기`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setFormError('복사가 막혀 있어요. 아래 글자를 길게 눌러 직접 복사해 주세요.');
    }
  };

  /* ── 아직 그룹이 없을 때 ── */
  if (!group) {
    return (
      <section className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface px-4 py-4">
        <h2 className="text-[15px] font-bold text-ink">그룹 가계부</h2>

        {mode === 'none' && (
          <>
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              여럿이 같은 가계부를 같이 적는 자리예요. 둘이든 넷이든 됩니다. 쓴 돈을 적으실 때
              지갑을 <strong className="font-semibold text-ink">그룹 지출</strong>로 고르시면, 내
              가계부에도 남고 그룹 가계부에도 올라가요.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('make');
                  setFormError(null);
                }}
                className="flex items-center gap-1.5 rounded-[8px] bg-brand-strong px-3.5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-deep"
              >
                <Icon name="plus" size={16} />
                그룹 만들기
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('join');
                  setFormError(null);
                }}
                className="flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] font-semibold text-ink-soft hover:border-line-strong"
              >
                <Icon name="devices" size={16} />
                그룹 참여하기
              </button>
            </div>
          </>
        )}

        {mode !== 'none' && (
          <div className="flex flex-col gap-3 rounded-[8px] bg-sunk px-3.5 py-3">
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              {mode === 'make'
                ? '그룹 아이디와 그룹 핀을 정해 주세요. 이 둘을 같이 쓸 분들께 알려 주시면 됩니다.'
                : '초대받은 그룹 아이디와 그룹 핀을 넣어 주세요.'}{' '}
              <strong className="font-semibold text-ink">내 로그인 핀과는 다른 값</strong>이에요.
            </p>

            {mode === 'make' && (
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-ink-soft">그룹 이름 (선택)</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 30))}
                  placeholder="우리집 가계부"
                  className="w-full max-w-[240px] rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[16px] text-ink"
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-ink-soft">그룹 아이디</span>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="영문 소문자·숫자"
                className="w-full max-w-[240px] rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[16px] text-ink"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-ink-soft">
                그룹 핀 (숫자 {PIN_MIN}자리 이상)
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={PIN_MAX}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
                placeholder="••••••"
                className="w-[160px] rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[16px] tracking-[0.3em] text-ink"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void enter(mode === 'make')}
                disabled={busy}
                className="rounded-[8px] bg-brand-strong px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-deep disabled:bg-sunk disabled:text-ink-faint"
              >
                {busy ? '여는 중…' : mode === 'make' ? '만들기' : '참여하기'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('none');
                  setId('');
                  setPin('');
                  setName('');
                  setFormError(null);
                }}
                className="rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft"
              >
                그만두기
              </button>
            </div>
          </div>
        )}

        {formError && (
          <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
            {formError}
          </p>
        )}
      </section>
    );
  }

  /* ── 그룹에 들어가 있을 때 ── */
  const other = latestOther(log.members, myId);
  const fresh = other && other.at > seen ? other : null;
  const title = group.name ?? group.id;

  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        <span
          className={
            'rounded-full px-2.5 py-1 text-[12px] font-semibold ' +
            (status.kind === 'ok'
              ? 'bg-good-soft text-good'
              : status.kind === 'error'
                ? 'bg-alert-soft text-alert'
                : 'bg-sunk text-ink-soft')
          }
        >
          {status.kind === 'ok'
            ? '맞춰져 있어요'
            : status.kind === 'syncing'
              ? '맞추는 중…'
              : status.kind === 'error'
                ? '연결 안 됨'
                : '곧 맞춥니다'}
        </span>
      </div>

      {/*
        "○○님이 가계부를 업데이트했습니다". 한 번 보시면 닫히고, 그다음 새 소식이
        올 때 다시 뜬다. 안 그러면 화면을 열 때마다 같은 말이 또 뜬다.
      */}
      {fresh && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-brand-strong bg-brand-soft px-3.5 py-3">
          <p className="text-[13px] font-semibold leading-relaxed text-ink">
            {fresh.id}님이 가계부를 업데이트했습니다. {myId}님도 업데이트해 보세요.
          </p>
          <button
            type="button"
            onClick={() => markSeen(fresh.at)}
            className="shrink-0 rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft"
          >
            확인
          </button>
        </div>
      )}

      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        멤버 <strong className="font-semibold text-ink">{log.members.length || 1}명</strong>이 같이
        쓰고 있어요
        {log.members.length > 0 && (
          <> — {log.members.map((m) => m.id).join(', ')}</>
        )}
        . 쓴 돈을 적으실 때 지갑을 <strong className="font-semibold text-ink">그룹 지출</strong>로
        고르시면 여기 올라갑니다. 지금 {log.entries.length}건.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setShowShare((v) => !v);
            setCopied(false);
          }}
          className="flex items-center gap-1.5 rounded-[8px] bg-brand-strong px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-deep"
        >
          <Icon name="share" size={16} />
          공유하기
        </button>
        <button
          type="button"
          onClick={() => setConfirmLeave(true)}
          className="rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:border-line-strong"
        >
          그룹 나가기
        </button>
      </div>

      {showShare && (
        <div className="flex flex-col gap-2 rounded-[8px] bg-sunk px-3.5 py-3">
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            이 둘을 같이 쓰실 분께 알려 주세요. 그분이 &lsquo;그룹 참여하기&rsquo;에서 넣으시면
            바로 같이 쓰게 됩니다.
          </p>
          <dl className="flex flex-col gap-1 rounded-[8px] border border-line bg-surface px-3 py-2.5">
            <div className="flex items-baseline gap-2">
              <dt className="w-[72px] shrink-0 text-[12px] text-ink-faint">그룹 아이디</dt>
              <dd className="text-[15px] font-bold text-ink">{group.id}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="w-[72px] shrink-0 text-[12px] text-ink-faint">그룹 핀</dt>
              <dd className="tnum text-[15px] font-bold tracking-[0.15em] text-ink">{group.pin}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="flex w-fit items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft hover:border-line-strong"
          >
            <Icon name="copy" size={14} />
            {copied ? '복사했어요' : '초대 글 복사'}
          </button>
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            이 핀은 그룹 가계부만 엽니다. 사장님 개인 가계부는 이것으로 안 열려요.
          </p>
        </div>
      )}

      {confirmLeave && (
        <div className="flex flex-col gap-2 rounded-[8px] bg-alert-soft px-3.5 py-3">
          <p className="text-[12.5px] leading-relaxed text-alert">
            이 기기에서만 나갑니다. 다른 멤버는 그대로 쓰시고, 사장님이 적으신 줄도 그룹에 남아요.
            다시 들어오시려면 같은 그룹 아이디와 핀을 넣으시면 됩니다.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={leave}
              className="rounded-[8px] bg-alert px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              나가기
            </button>
            <button
              type="button"
              onClick={() => setConfirmLeave(false)}
              className="rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft"
            >
              그만두기
            </button>
          </div>
        </div>
      )}

      {status.kind === 'error' && (
        <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
          {status.message} 적으신 건 이 기기에 그대로 있고, 연결되면 저절로 올라갑니다.
        </p>
      )}

      {formError && (
        <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
          {formError}
        </p>
      )}
    </section>
  );
}

/** 그룹 쪽 말로 바꿔 준다. '아이디'만 적으면 어느 아이디인지 헷갈린다. */
function groupFail(f: Fail, making: boolean): string {
  if (f.kind === 'taken') return '이미 있는 그룹 아이디예요. 참여하시려면 ‘그룹 참여하기’를 쓰세요.';
  if (f.kind === 'wrong') {
    return making
      ? '그룹 아이디나 핀이 맞지 않아요.'
      : '그런 그룹이 없거나 핀이 달라요. 초대하신 분께 다시 확인해 주세요.';
  }
  return sayFail(f);
}
