'use client';

import { useState } from 'react';
import { absoluteShareUrl } from '@/lib/share';
import { Icon } from '@/components/ui/Icon';

/**
 * 결과 공유 버튼.
 *
 * 주소만 보내면 받는 사람 입장에서는 "계산기 링크"일 뿐이라 누를 이유가 없다.
 * 그래서 지금 화면에 나온 숫자를 한 문장으로 앞에 붙여 보낸다.
 * 과장하지 않고, 방금 계산된 값을 그대로 옮긴다 — 열어보면 같은 숫자가 나와야 하니까.
 */
export function ShareButton({
  query,
  title,
  text,
}: {
  query: string;
  title: string;
  /** 금액·기간이 들어간 한 문장. 없으면 주소만 보낸다. */
  text?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const onShare = async () => {
    const url = absoluteShareUrl(query);
    const body = text ? `${text}\n${url}` : url;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        // text와 url을 따로 넘기면 카카오톡에서 말풍선이 두 개로 쪼개진다.
        // (문구 한 개, 주소 한 개) 한 덩어리로 보내야 문구와 링크가 붙어서 간다.
        await navigator.share({ title, text: body });
      } catch {
        // 사용자가 공유창을 닫은 경우도 여기로 온다. 조용히 넘어간다.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(body);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('failed');
    }
  };

  return (
    <section className="rounded-[12px] border border-line bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[13.5px] font-semibold text-ink">이 결과 그대로 공유하기</h2>
          <p className="text-[12px] leading-relaxed text-ink-faint">
            {state === 'copied'
              ? '문구와 주소를 복사했어요. 붙여넣기 하시면 됩니다.'
              : state === 'failed'
                ? '복사가 안 됐어요. 브라우저 주소창의 주소를 직접 복사해 주세요.'
                : '아래 문구와 함께, 지금 넣은 숫자가 담긴 주소를 보냅니다.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onShare}
          className="flex shrink-0 items-center gap-1.5 rounded-[8px] bg-brand-strong px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-deep"
        >
          <Icon name={state === 'copied' ? 'check' : 'share'} size={16} />
          {state === 'copied' ? '복사됨' : '공유'}
        </button>
      </div>

      {text && (
        <p className="mt-3 rounded-[8px] bg-sunk px-3 py-2.5 text-[13px] leading-relaxed text-ink">
          {text}
        </p>
      )}

      <p className="mt-2.5 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
        문구와 주소 안에 입력하신 금액이 들어 있어요. 링크를 받은 사람은 그 숫자를 볼 수 있으니,
        아무나 볼 수 있는 곳에는 올리지 말아 주세요.
      </p>
    </section>
  );
}
