'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { storageWorks } from '@/lib/ledger/storage';
import { mergeEntries, mergePreview } from '@/lib/ledger/merge';
import type { Entry } from '@/lib/ledger/schema';
import {
  decodeHandoff,
  encodeHandoff,
  handoffLink,
  HANDOFF_MAX_CHARS,
  readHandoffHash,
} from '@/lib/ledger/transfer';
import type { Profile } from '@/lib/profile/schema';
import { Icon } from '@/components/ui/Icon';

/*
  저장이 되는 기기인지는 한 번만 보면 된다. 쓰기가 막힌 브라우저가 열려 있는
  동안 갑자기 풀리지는 않기 때문이다. useSyncExternalStore는 같은 값을 돌려주는
  getSnapshot을 요구하므로 모듈에 한 번 적어 두고 그걸 돌려준다.
*/
let storageProbe: boolean | null = null;
const noSubscribe = () => () => {};
function readStorageProbe(): boolean {
  if (storageProbe === null) storageProbe = storageWorks();
  return storageProbe;
}

/**
 * 컴퓨터에 적은 걸 폰에서도 보게 하는 자리.
 *
 * 이 사이트는 적은 것을 서버로 보내지 않는다. 그래서 기기마다 저장 칸이 따로다.
 * 컴퓨터에 적은 줄이 폰에 없는 건 지워진 게 아니라 아직 안 건너온 것이다.
 * 사장님 눈에는 "저장이 안 됐다"로 보이므로, 그 말을 먼저 적고 건너오는 길을 준다.
 *
 * 길은 주소 뒤 #(우물 정) 조각이다. 브라우저가 서버로 보내지 않는 유일한 부분이라
 * 서버 없이 옮길 수 있다. 자세한 사정은 lib/ledger/transfer.ts에 적어 뒀다.
 */
export function DeviceHandoff({
  entries,
  profile,
  today,
  onMergeEntries,
  onProfile,
}: {
  entries: Entry[];
  profile: Profile;
  today: string;
  onMergeEntries: (next: Entry[]) => boolean;
  onProfile: (next: Profile) => void;
}) {
  /*
    저장이 실제로 되는 기기인지는 서버에서 알 수 없다. 서버 그림은 '된다'로 두고
    브라우저에서 한 번 써 봐서 아니면 그때 알린다. 서버에서부터 경고를 그리면
    대부분의 멀쩡한 기기에서 화면이 한 번 깜빡인다.
  */
  const storageOk = useSyncExternalStore(
    noSubscribe,
    readStorageProbe,
    () => true,
  );

  const [withProfile, setWithProfile] = useState(true);
  const [link, setLink] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const [copied, setCopied] = useState(false);
  const [incoming, setIncoming] = useState<{
    entries: Entry[];
    profile: Profile | null;
  } | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  /*
    주소에 옮기기 글자가 붙어 있으면 읽어 둔다. 바로 넣지 않고 몇 건인지 보여 주고
    누르게 한다. 남이 보낸 링크를 눌렀을 때 내 가계부가 조용히 바뀌어 있으면 안 된다.

    hashchange도 같이 듣는다. 이 화면을 이미 열어 둔 채로 카카오톡에서 같은 쪽 링크를
    누르면 브라우저가 쪽을 새로 읽지 않고 # 뒤만 갈아 끼운다. 그러면 들어올 때 한 번만
    보는 코드는 아무 일도 안 하고, 사장님 눈에는 링크를 눌렀는데 반응이 없는 것으로 보인다.
  */
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const token = readHandoffHash(window.location.hash);
      if (!token) return;
      const read = await decodeHandoff(token);
      if (!alive) return;
      if ('error' in read) {
        setMessage({ tone: 'bad', text: read.error });
        return;
      }
      setMessage(null);
      setIncoming({ entries: read.entries, profile: read.profile });
    };
    void pull();
    window.addEventListener('hashchange', pull);
    return () => {
      alive = false;
      window.removeEventListener('hashchange', pull);
    };
  }, []);

  /*
    몇 건이 새로 들어오는지는 그릴 때마다 지금 가계부로 다시 센다. 읽을 때 한 번
    세어 두면, 세고 나서 다른 줄을 적거나 두 번째 링크를 열었을 때 숫자가 옛것이 된다.
  */
  const preview = useMemo(
    () => (incoming ? mergePreview(entries, incoming.entries) : null),
    [entries, incoming],
  );

  /** 가져오거나 닫은 뒤에는 주소에서 글자를 뗀다. 새로 고쳐도 또 묻지 않게. */
  const clearHash = () => {
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      // 못 떼도 큰일은 아니다
    }
  };

  const make = async () => {
    setCopied(false);
    setMessage(null);
    const token = await encodeHandoff(entries, withProfile ? profile : null, today);
    if (token.length > HANDOFF_MAX_CHARS) {
      setTooBig(true);
      setLink(null);
      return;
    }
    setTooBig(false);
    setLink(handoffLink(window.location.origin, window.location.pathname, token));
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /*
        클립보드를 막는 브라우저가 있다. 그때는 글자를 띄워 두고 직접 긁어
        복사하게 한다. 복사 버튼이 아무 반응이 없는 것보다 낫다.
      */
      setMessage({ tone: 'bad', text: '복사가 막혀 있어요. 아래 글자를 직접 눌러 복사해 주세요.' });
    }
  };

  const take = () => {
    if (!incoming || !preview) return;
    // 내 다른 기기에서 온 것이므로 명의를 뒤집지 않고, 보낸 사람 이름도 붙이지 않는다.
    const ok = onMergeEntries(mergeEntries(entries, incoming.entries));
    if (!ok) {
      setMessage({ tone: 'bad', text: '저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.' });
      return;
    }
    const notes = [
      preview.added > 0
        ? `${preview.added}건을 가져왔어요.`
        : '새로 들어온 줄은 없었어요. 이미 다 있던 기록입니다.',
    ];
    if (preview.duplicate > 0) notes.push(`${preview.duplicate}건은 이미 있어서 건너뛰었습니다.`);
    if (incoming.profile && Object.keys(incoming.profile).length > 0) {
      onProfile(incoming.profile);
      notes.push('프로필도 같이 가져왔습니다.');
    }
    setIncoming(null);
    clearHash();
    setMessage({ tone: 'ok', text: notes.join(' ') });
  };

  const rowWord = entries.length > 0 ? `${entries.length}건` : '아직 없는 기록';

  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface px-4 py-4">
      <h2 className="text-[15px] font-bold text-ink">다른 기기에서 보기</h2>

      {!storageOk && (
        <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
          이 브라우저는 저장을 막아 두고 있어요. 지금 적으시는 건 화면을 닫으면 사라집니다.
          시크릿·프라이빗 모드면 일반 창으로 열어 주세요.
        </p>
      )}

      {incoming && preview && (
        <div className="flex flex-col gap-2 rounded-[8px] border border-brand-strong bg-brand-soft px-3.5 py-3">
          <p className="text-[13px] font-semibold leading-relaxed text-ink">
            다른 기기에서 보낸 기록 {preview.total}건이 링크에 담겨 왔어요.
            {preview.added > 0
              ? ` 이 기기에 없는 ${preview.added}건을 더합니다.`
              : ' 모두 이미 있는 기록이에요.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={take}
              className="rounded-[8px] bg-brand-strong px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-deep"
            >
              가져오기
            </button>
            <button
              type="button"
              onClick={() => {
                setIncoming(null);
                clearHash();
              }}
              className="rounded-[8px] border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft hover:border-line-strong"
            >
              안 가져오기
            </button>
          </div>
        </div>
      )}

      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        적으신 기록은 <strong className="font-semibold text-ink">이 기기의 이 브라우저에만</strong>{' '}
        남습니다. 서버로 보내지 않으니 아무도 볼 수 없는 대신, 컴퓨터에 적은 게 폰에 저절로
        따라오지 않아요. 지워진 게 아니라 아직 안 건너온 겁니다. 아래 링크로 건너오게 하세요.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void make()}
          disabled={entries.length === 0 && Object.keys(profile).length === 0}
          className={
            'flex items-center gap-1.5 rounded-[8px] px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors ' +
            (entries.length > 0 || Object.keys(profile).length > 0
              ? 'bg-brand-strong text-white hover:bg-brand-deep'
              : 'cursor-not-allowed bg-sunk text-ink-faint')
          }
        >
          <Icon name="devices" size={16} />
          옮기기 링크 만들기
        </button>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
          <input
            type="checkbox"
            checked={withProfile}
            onChange={(e) => {
              setWithProfile(e.target.checked);
              setLink(null);
              setTooBig(false);
            }}
            className="h-4 w-4 accent-brand-strong"
          />
          프로필(연봉 등)도 같이
        </label>
      </div>

      {tooBig && (
        <p className="rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
          기록이 많아서 링크 한 줄에 다 안 들어가요. 아래 &lsquo;합치기 파일 보내기&rsquo;로
          파일을 받아서 보내 주세요. 파일은 개수 제한이 없습니다.
        </p>
      )}

      {link && (
        <div className="flex flex-col gap-2 rounded-[8px] bg-sunk px-3.5 py-3">
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            {rowWord}이 담긴 링크예요. 복사해서 카카오톡 &lsquo;나와의 채팅&rsquo;으로 보내시고,
            폰에서 그 링크를 누르면 기록이 건너옵니다.
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
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            링크 안에 금액이 글자로 들어 있습니다. 서버로는 안 가지만, 카카오톡으로 보내시면 그
            대화방에는 남아요. 남한테 전달하지는 마세요.
          </p>
        </div>
      )}

      {message && (
        <p
          className={
            'rounded-[8px] px-3 py-2.5 text-[12.5px] leading-relaxed ' +
            (message.tone === 'ok' ? 'bg-good-soft text-good' : 'bg-alert-soft text-alert')
          }
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
