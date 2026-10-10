'use client';

import { useState, useSyncExternalStore } from 'react';
import { PIN_MAX, PIN_MIN, pinProblem } from '@/lib/account/schema';
import { sayFail } from '@/lib/account/transport';
import { joinGroup } from '@/lib/group/client';
import {
  dropInvite,
  inviteSnapshot,
  serverInviteSnapshot,
  subscribeInvite,
} from '@/lib/group/invite';
import {
  bumpGroup,
  groupSnapshot,
  saveGroup,
  serverGroupSnapshot,
  subscribeGroup,
  type GroupSession,
} from '@/lib/group/session';
import { bumpGroupLog, saveGroupLog } from '@/lib/group/store';
import { Icon } from '@/components/ui/Icon';

/**
 * 초대받고 들어온 분이 맨 처음 보는 자리.
 *
 * 링크를 누르면 여기가 화면 맨 위에 뜬다. 받는 분은 링크를 누른 것 말고는
 * 아무것도 모르므로, '쓴 돈 적기'를 찾아 들어가서 '그룹 참여하기'를 누르고
 * 아이디를 받아 적으라고 할 수 없다. 그래서 아이디는 링크가 들고 오고,
 * 여기서는 핀만 받는다.
 *
 * 로그인이 먼저다. 그룹에 누가 적었는지 보여 주려면 내 아이디가 있어야 한다.
 * 그 경우에는 "먼저 로그인해 주세요"라고 말하고 초대는 그대로 들고 기다린다.
 */
export function GroupInvite({ myId }: { myId: string | null }) {
  const invited = useSyncExternalStore(subscribeInvite, inviteSnapshot, serverInviteSnapshot);
  /* 그룹 값은 그룹 쪽을 구독해서 읽는다. 초대 쪽을 구독하면 그룹이 바뀌어도 안 따라온다. */
  const group = useSyncExternalStore(subscribeGroup, groupSnapshot, serverGroupSnapshot);

  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* 초대가 없거나, 이미 그 그룹에 들어가 있으면 보여 줄 일이 없다. */
  if (!invited) return null;
  if (group?.id === invited) return null;

  const join = async () => {
    setError(null);
    const bad = pinProblem(pin);
    if (bad) return setError(bad.replace('핀', '그룹 핀'));

    setBusy(true);
    try {
      const out = await joinGroup(invited, pin);
      if ('kind' in out) {
        setError(
          out.kind === 'wrong'
            ? '핀이 맞지 않아요. 초대하신 분께 다시 여쭤봐 주세요.'
            : sayFail(out),
        );
        return;
      }
      const next: GroupSession = {
        ...out.auth,
        ...(out.vault.name ? { name: out.vault.name } : {}),
        since: new Date().toISOString(),
      };
      if (!saveGroup(next)) {
        setError('이 브라우저는 저장을 막고 있어요. 일반 창으로 열어 주세요.');
        return;
      }
      saveGroupLog(out.vault, new Date().toISOString());
      bumpGroup();
      bumpGroupLog();
      dropInvite();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-[12px] border-2 border-brand-strong bg-brand-soft px-5 py-5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-brand-strong">
          <Icon name="share" size={20} />
        </span>
        <div>
          <h2 className="text-[16px] font-bold text-ink">그룹 가계부에 초대받으셨어요</h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
            <strong className="font-semibold text-ink">{invited}</strong> 그룹이에요. 들어가시면
            멤버들이 적은 돈을 같이 보고 같이 적을 수 있습니다.
          </p>
        </div>
      </div>

      {myId === null ? (
        <p className="rounded-[8px] bg-surface px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">먼저 내 가계부에 로그인해 주세요.</strong> 아래
          칸에서 아이디와 핀을 넣으시면 됩니다. 처음이시면 &lsquo;만들기&rsquo;로 하나 지으세요.
          로그인하시면 이 자리에서 바로 그룹에 들어가실 수 있어요.
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] font-medium text-ink-soft">
              초대하신 분께 들은 그룹 핀 (숫자 {PIN_MIN}자리 이상)
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={PIN_MAX}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void join();
              }}
              placeholder="••••••"
              className="w-[180px] rounded-[8px] border border-line bg-surface px-3 py-3 text-[18px] tracking-[0.3em] text-ink"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void join()}
              disabled={busy}
              className="rounded-[8px] bg-brand-strong px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-deep disabled:bg-sunk disabled:text-ink-faint"
            >
              {busy ? '들어가는 중…' : '그룹 들어가기'}
            </button>
            <button
              type="button"
              onClick={dropInvite}
              className="rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[13px] font-semibold text-ink-soft hover:border-line-strong"
            >
              나중에
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
          {error}
        </p>
      )}

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        핀은 링크에 들어 있지 않아요. 링크만 봐서는 열리지 않습니다.
      </p>
    </section>
  );
}
