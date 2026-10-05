'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Grave, Entry } from '@/lib/ledger/schema';
import type { Side } from '@/lib/ledger/sync-merge';
import { deriveKey, isValidPin, newRoom, PIN_LENGTH } from '@/lib/sync/crypto';
import { dropRoomOnServer, syncOnce } from '@/lib/sync/client';
import {
  bumpRoom,
  clearRoom,
  dropHash,
  hashSnapshot,
  inviteLink,
  readInviteHash,
  roomSnapshot,
  saveRoom,
  serverHashSnapshot,
  serverRoomSnapshot,
  subscribeHash,
  subscribeRoom,
  type Room,
} from '@/lib/sync/room';
import { Icon } from '@/components/ui/Icon';

/**
 * 둘이 같이 쓰는 자리.
 *
 * 한 사람이 방을 만들고 핀 6자리를 정하면, 그 뒤로는 양쪽이 적은 게 알아서
 * 합쳐진다. 올라가는 건 브라우저에서 잠근 덩어리뿐이고, 푸는 열쇠는 이 기기와
 * 상대 기기에만 있다.
 *
 * 링크와 핀을 일부러 갈라 둔다. 링크만 새도, 핀만 새도 안 열린다.
 * 그래서 화면에서도 "링크는 카톡으로, 핀은 입으로"라고 말한다.
 */

/** 적자마자 올리지 않는다. 연달아 적으실 때 한 번만 올라가게 묶는다. */
const PUSH_DELAY_MS = 2000;
/** 상대가 올린 걸 받아오는 간격. */
const POLL_MS = 45_000;

type Status =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'ok'; at: string }
  | { kind: 'pin' }
  | { kind: 'off' }
  | { kind: 'error'; message: string };

export function CoupleSync({
  entries,
  graves,
  applySide,
  partnerWord,
}: {
  entries: Entry[];
  graves: Grave[];
  applySide: (side: Side) => boolean;
  /** '배우자'인지 '상대방'인지. 혼인신고 전이면 배우자가 아니다. */
  partnerWord: string;
}) {
  const room = useSyncExternalStore(subscribeRoom, roomSnapshot, serverRoomSnapshot);
  const hash = useSyncExternalStore(subscribeHash, hashSnapshot, serverHashSnapshot);
  const invite = useMemo(() => (hash ? readInviteHash(hash) : null), [hash]);

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [making, setMaking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  /*
    열쇠 만들기는 일부러 느리게 돼 있다(찍어 맞추기를 늦추려고). 매번 다시 만들면
    화면이 버벅이므로 방이 그대로인 동안은 한 번 만든 걸 들고 있는다.
  */
  const keyRef = useRef<{ roomId: string; key: CryptoKey } | null>(null);

  /*
    올릴 거리와 앉히는 함수를 칸에 담아 둔다. 맞추는 효과가 이것들을 지켜보게 하면
    한 줄 적을 때마다 시계와 구독이 통째로 다시 걸린다. 칸에 담아 두면 효과는 그대로
    두고 안에서 최신 값만 꺼내 쓴다.

    담는 일은 그리는 중이 아니라 그린 뒤에 한다. 그리는 중에 칸을 건드리면 React가
    같은 그림을 두 번 그려 볼 때 결과가 달라질 수 있다. 맞추는 효과보다 먼저 적어
    두어야 하므로 이 효과를 위에 둔다.
  */
  const sideRef = useRef<Side>({ entries, graves });
  const applyRef = useRef(applySide);
  useEffect(() => {
    sideRef.current = { entries, graves };
    applyRef.current = applySide;
  });

  const fingerprint = useMemo(
    () =>
      [
        entries.map((e) => `${e.id}@${e.at ?? ''}`).sort().join(','),
        graves.map((g) => `${g.id}@${g.at}`).sort().join(','),
      ].join('|'),
    [entries, graves],
  );

  useEffect(() => {
    if (!room) {
      keyRef.current = null;
      return;
    }
    let alive = true;

    const run = async () => {
      if (!alive) return;
      try {
        if (keyRef.current?.roomId !== room.roomId) {
          keyRef.current = {
            roomId: room.roomId,
            key: await deriveKey(room.pin, room.roomSecret, room.roomId),
          };
        }
        if (!alive) return;
        setStatus({ kind: 'syncing' });
        const out = await syncOnce(room.roomId, keyRef.current.key, sideRef.current);
        if (!alive) return;
        if (out.state === 'ok') {
          /*
            달라진 게 있을 때만 앉힌다. 매번 앉히면 가계부가 바뀌고, 바뀌면 이
            효과가 다시 돌고, 그게 또 앉히는 쳇바퀴가 된다.
          */
          if (out.changed) applyRef.current(out.side);
          setStatus({ kind: 'ok', at: new Date().toISOString() });
        } else if (out.state === 'pin') {
          setStatus({ kind: 'pin' });
        } else if (out.state === 'off') {
          setStatus({ kind: 'off' });
        } else if (out.state === 'busy') {
          setStatus({ kind: 'error', message: '잠시 뒤에 다시 맞출게요.' });
        } else {
          setStatus({ kind: 'error', message: out.message });
        }
      } catch {
        if (alive) setStatus({ kind: 'error', message: '지금은 연결이 안 돼요.' });
      }
    };

    // 적자마자가 아니라 잠깐 뒤에 올린다. 연달아 적으실 때 한 번만 올라간다.
    const timer = window.setTimeout(run, PUSH_DELAY_MS);
    const beat = window.setInterval(run, POLL_MS);
    // 다른 창을 보다 돌아오시면 그 사이 상대가 적은 게 있는지 본다.
    const onFocus = () => void run();
    window.addEventListener('focus', onFocus);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearInterval(beat);
      window.removeEventListener('focus', onFocus);
    };
  }, [room, fingerprint]);

  const makeRoom = async () => {
    setFormError(null);
    if (!isValidPin(pin)) {
      setFormError(`핀은 숫자 ${PIN_LENGTH}자리로 정해 주세요.`);
      return;
    }
    if (pin !== pinAgain) {
      setFormError('두 번 적으신 핀이 서로 달라요.');
      return;
    }
    const fresh = newRoom();
    const next: Room = { ...fresh, pin, joinedAt: new Date().toISOString() };
    if (!saveRoom(next)) {
      setFormError('이 브라우저는 저장을 막고 있어요. 일반 창으로 열어 주세요.');
      return;
    }
    bumpRoom();
    setMaking(false);
    setPin('');
    setPinAgain('');
    setLink(inviteLink(window.location.origin, window.location.pathname, fresh.roomId, fresh.roomSecret));
  };

  const joinRoom = async () => {
    if (!invite) return;
    setFormError(null);
    if (!isValidPin(pin)) {
      setFormError(`${partnerWord}에게 들은 숫자 ${PIN_LENGTH}자리를 넣어 주세요.`);
      return;
    }
    setStatus({ kind: 'syncing' });
    /*
      저장하기 전에 먼저 열어 본다. 핀이 틀린 채로 저장해 두면 그 뒤로 계속
      "안 맞아요"만 뜨고, 사장님은 무엇을 고쳐야 하는지 모르신다.
    */
    const key = await deriveKey(pin, invite.roomSecret, invite.roomId);
    const out = await syncOnce(invite.roomId, key, sideRef.current);
    if (out.state === 'pin') {
      setStatus({ kind: 'idle' });
      setFormError('핀이 안 맞아요. 다시 확인해 주세요.');
      return;
    }
    if (out.state === 'off') {
      setStatus({ kind: 'off' });
      return;
    }
    if (out.state !== 'ok') {
      setStatus({ kind: 'idle' });
      setFormError(out.state === 'busy' ? '잠시 뒤에 다시 시도해 주세요.' : out.message);
      return;
    }
    const next: Room = { ...invite, pin, joinedAt: new Date().toISOString() };
    if (!saveRoom(next)) {
      setFormError('이 브라우저는 저장을 막고 있어요. 일반 창으로 열어 주세요.');
      return;
    }
    keyRef.current = { roomId: invite.roomId, key };
    applyRef.current(out.side);
    bumpRoom();
    setPin('');
    dropHash();
    setStatus({ kind: 'ok', at: new Date().toISOString() });
  };

  /**
   * 연결을 끊는다.
   *
   * 두 갈래다. 이 기기만 빠지면 상대는 그대로 쓰시고, 서버까지 지우면 맡겨 둔
   * 덩어리가 없어진다. 어느 쪽이든 각 기기에 적어 둔 기록은 안 지워진다.
   * 그 말을 화면에 적어 두지 않으면 아무도 이 버튼을 못 누른다.
   */
  const leave = async (alsoServer: boolean) => {
    const was = room;
    if (alsoServer && was) await dropRoomOnServer(was.roomId);
    clearRoom();
    bumpRoom();
    keyRef.current = null;
    setConfirmLeave(false);
    setLink(null);
    setStatus({ kind: 'idle' });
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setFormError('복사가 막혀 있어요. 아래 글자를 직접 눌러 복사해 주세요.');
    }
  };

  const pinField = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-ink-soft">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={PIN_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
        placeholder="••••••"
        className="w-[140px] rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[16px] tracking-[0.3em] text-ink"
      />
    </label>
  );

  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface px-4 py-4">
      <h2 className="text-[15px] font-bold text-ink">둘이 같이 쓰기</h2>

      {/* ── 초대를 받은 쪽 ── */}
      {invite && !room && (
        <div className="flex flex-col gap-3 rounded-[8px] border border-brand-strong bg-brand-soft px-3.5 py-3">
          <p className="text-[13px] font-semibold leading-relaxed text-ink">
            초대를 받으셨어요. {partnerWord}에게 들은 핀 {PIN_LENGTH}자리를 넣으시면 두 분 가계부가
            하나로 합쳐집니다.
          </p>
          {pinField(pin, setPin, `핀 ${PIN_LENGTH}자리`)}
          <div>
            <button
              type="button"
              onClick={() => void joinRoom()}
              disabled={status.kind === 'syncing'}
              className="rounded-[8px] bg-brand-strong px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-deep disabled:bg-sunk disabled:text-ink-faint"
            >
              {status.kind === 'syncing' ? '맞추는 중…' : '합치기'}
            </button>
          </div>
        </div>
      )}

      {/* ── 아직 연결 안 함 ── */}
      {!room && !invite && !making && (
        <>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            한 분이 방을 만들고 핀 {PIN_LENGTH}자리를 정하시면, 그 뒤로는 두 분이 각자 적은 게
            자동으로 합쳐집니다. 올라가는 건 <strong className="font-semibold text-ink">잠근 덩어리</strong>라
            저희도 못 봅니다. 푸는 건 두 분 핸드폰뿐이에요.
          </p>
          <div>
            <button
              type="button"
              onClick={() => setMaking(true)}
              className="flex items-center gap-1.5 rounded-[8px] bg-brand-strong px-3.5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-deep"
            >
              <Icon name="lock" size={16} />
              커플 가계부 만들기
            </button>
          </div>
        </>
      )}

      {/* ── 방 만드는 중 ── */}
      {!room && making && (
        <div className="flex flex-col gap-3 rounded-[8px] bg-sunk px-3.5 py-3">
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            쓰실 핀 {PIN_LENGTH}자리를 정해 주세요. 이 숫자는 어디에도 안 보냅니다. 그래서{' '}
            <strong className="font-semibold text-ink">잊어버리면 저희도 못 찾아 드려요.</strong>{' '}
            생일처럼 둘 다 아는 숫자가 좋습니다.
          </p>
          <div className="flex flex-wrap gap-3">
            {pinField(pin, setPin, '핀')}
            {pinField(pinAgain, setPinAgain, '한 번 더')}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void makeRoom()}
              className="rounded-[8px] bg-brand-strong px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-deep"
            >
              정했어요
            </button>
            <button
              type="button"
              onClick={() => {
                setMaking(false);
                setPin('');
                setPinAgain('');
                setFormError(null);
              }}
              className="rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:border-line-strong"
            >
              그만두기
            </button>
          </div>
        </div>
      )}

      {/* ── 연결됨 ── */}
      {room && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                'rounded-full px-2.5 py-1 text-[12px] font-semibold ' +
                (status.kind === 'ok'
                  ? 'bg-good-soft text-good'
                  : status.kind === 'syncing'
                    ? 'bg-sunk text-ink-soft'
                    : status.kind === 'idle'
                      ? 'bg-sunk text-ink-soft'
                      : 'bg-alert-soft text-alert')
              }
            >
              {status.kind === 'ok'
                ? '맞춰져 있어요'
                : status.kind === 'syncing'
                  ? '맞추는 중…'
                  : status.kind === 'pin'
                    ? '핀이 안 맞아요'
                    : status.kind === 'off'
                      ? '서버 준비 중'
                      : status.kind === 'error'
                        ? '연결 안 됨'
                        : '곧 맞춥니다'}
            </span>
            {status.kind === 'ok' && (
              <span className="text-[12px] text-ink-faint">
                {new Date(status.at).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>

          {status.kind === 'pin' && (
            <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
              이 기기에 적힌 핀으로는 상대방 기록을 열 수 없어요. 두 분 핀이 다릅니다. 아래에서
              연결을 끊고 초대 링크를 다시 받아 주세요.
            </p>
          )}
          {status.kind === 'off' && (
            <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
              같이 쓰기 서버가 아직 준비되지 않았어요. 그동안 적으신 건 이 기기에 그대로 있고,
              준비되면 저절로 올라갑니다.
            </p>
          )}

          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            두 분이 적은 게 자동으로 합쳐지고 있어요. 상대가 적은 건 이 화면에 돌아오시면
            따라옵니다.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setLink(
                  inviteLink(
                    window.location.origin,
                    window.location.pathname,
                    room.roomId,
                    room.roomSecret,
                  ),
                )
              }
              className="flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:border-line-strong"
            >
              <Icon name="share" size={16} />
              초대 링크 보기
            </button>
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:border-line-strong"
            >
              연결 끊기
            </button>
          </div>

          {confirmLeave && (
            <div className="flex flex-col gap-2 rounded-[8px] bg-alert-soft px-3.5 py-3">
              <p className="text-[12.5px] leading-relaxed text-alert">
                어느 쪽을 고르셔도{' '}
                <strong className="font-semibold">이 기기에 적어 둔 기록은 안 지워집니다.</strong>
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void leave(false)}
                  className="rounded-[8px] border border-line bg-surface px-3.5 py-2 text-left text-[13px] font-semibold text-ink-soft"
                >
                  이 기기만 빠지기
                  <span className="block text-[11.5px] font-normal text-ink-faint">
                    {partnerWord}은 계속 쓰실 수 있어요
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void leave(true)}
                  className="rounded-[8px] bg-alert px-3.5 py-2 text-left text-[13px] font-semibold text-white"
                >
                  서버에 맡긴 것까지 지우기
                  <span className="block text-[11.5px] font-normal opacity-90">
                    둘이 같이 쓰기가 끝납니다. 되돌릴 수 없어요
                  </span>
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
        </>
      )}

      {link && (
        <div className="flex flex-col gap-2 rounded-[8px] bg-sunk px-3.5 py-3">
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            이 링크를 {partnerWord}에게 카톡으로 보내시고,{' '}
            <strong className="font-semibold text-ink">핀 {PIN_LENGTH}자리는 말로 알려 주세요.</strong>{' '}
            링크만 새거나 핀만 새면 안 열립니다. 둘 다 카톡에 적으시면 그 뜻이 없어져요.
          </p>
          <textarea
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            rows={3}
            className="w-full resize-none rounded-[6px] border border-line bg-surface px-2.5 py-2 text-[11px] leading-relaxed text-ink-soft"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:border-line-strong"
            >
              <Icon name="copy" size={16} />
              {copied ? '복사했어요' : '링크 복사'}
            </button>
            <button
              type="button"
              onClick={() => {
                setLink(null);
                setCopied(false);
              }}
              className="rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:border-line-strong"
            >
              닫기
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
