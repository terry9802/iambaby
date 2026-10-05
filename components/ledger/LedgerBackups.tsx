'use client';

import { useState } from 'react';
import { formatKRW } from '@/lib/format';
import type { Snapshot } from '@/lib/ledger/backup';
import { Icon } from '@/components/ui/Icon';

/**
 * 되살리기.
 *
 * 줄이 줄어드는 저장이 일어나기 직전마다 그 전 모습을 떠 둔다. 무엇이 줄였든
 * — 한 줄 지우기든, 전부 지우기든, 다른 기기와 맞추다 줄었든 — 직전으로
 * 돌아올 수 있다.
 *
 * 되살리기는 덮어쓰기가 아니라 합치기다. 떠 둔 모습에만 있던 줄을 지금 것에
 * 더한다. 덮어쓰면 백업 뜬 뒤에 적으신 줄이 사라져서, 되살리려다 또 잃는다.
 */
export function LedgerBackups({
  backups,
  onRestore,
}: {
  backups: Snapshot[];
  onRestore: (at: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  if (backups.length === 0) return null;

  const restore = (shot: Snapshot) => {
    const ok = onRestore(shot.at);
    setMessage(
      ok
        ? { tone: 'ok', text: `${shot.count}건을 되살렸어요. 그 사이 적으신 줄도 그대로 있습니다.` }
        : { tone: 'bad', text: '되살리지 못했어요. 브라우저 저장 공간을 확인해 주세요.' },
    );
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[13px] font-semibold text-ink">
          되살리기 <span className="tnum font-normal text-ink-faint">{backups.length}개</span>
        </span>
        <Icon name={open ? 'close' : 'plus'} size={14} />
      </button>

      <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
        기록이 줄어들기 직전 모습을 자동으로 떠 둬요. 잘못 지우셨거나 갑자기 줄었으면 여기서
        되돌리시면 됩니다.
      </p>

      {open && (
        <>
          <ul className="mt-2.5 flex flex-col divide-y divide-line">
            {backups.map((shot) => (
              <li key={shot.at} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="tnum text-[13px] font-semibold text-ink">
                    {shot.count}건 · {formatKRW(shot.total)}
                  </p>
                  <p className="tnum mt-0.5 text-[11.5px] text-ink-faint">{when(shot.at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => restore(shot)}
                  className="shrink-0 rounded-[8px] border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink-soft hover:border-line-strong"
                >
                  되살리기
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-2 rounded-[8px] bg-sunk px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-faint">
            이 백업도 이 브라우저 안에 있습니다. 브라우저에서 사이트 데이터를 통째로 지우면 백업도
            같이 사라져요. 그것까지 막으시려면 가끔{' '}
            <strong className="font-semibold text-ink-soft">엑셀로 받아</strong> 두시거나{' '}
            <strong className="font-semibold text-ink-soft">둘이 같이 쓰기</strong>를 켜 두세요.
          </p>
        </>
      )}

      {message && (
        <p
          className={
            'mt-2 rounded-[8px] px-3 py-2.5 text-[12.5px] leading-relaxed ' +
            (message.tone === 'ok' ? 'bg-good-soft text-good' : 'bg-alert-soft text-alert')
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

function when(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
