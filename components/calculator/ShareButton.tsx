'use client';

import { useState } from 'react';
import { absoluteShareUrl } from '@/lib/share';
import { Icon } from '@/components/ui/Icon';

/**
 * 결과 공유 버튼.
 * 입력값이 담긴 주소를 만들어 준다. 받는 사람은 같은 숫자로 같은 결과를 본다.
 */
export function ShareButton({ query, title }: { query: string; title: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const onShare = async () => {
    const url = absoluteShareUrl(query);

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // 사용자가 공유창을 닫은 경우도 여기로 온다. 조용히 넘어간다.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('failed');
    }
  };

  return (
    <section className="rounded-[12px] border border-line bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[13.5px] font-semibold text-ink">이 결과 그대로 공유하기</h2>
          <p className="text-[12px] leading-relaxed text-ink-faint">
            {state === 'copied'
              ? '주소를 복사했어요. 붙여넣기 하시면 됩니다.'
              : state === 'failed'
                ? '복사가 안 됐어요. 브라우저 주소창의 주소를 직접 복사해 주세요.'
                : '지금 넣은 숫자가 그대로 담긴 주소를 만들어 드려요.'}
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
      <p className="mt-2.5 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
        주소 안에 입력하신 금액이 들어 있어요. 링크를 받은 사람은 그 숫자를 볼 수 있으니, 아무나 볼
        수 있는 곳에는 올리지 말아 주세요.
      </p>
    </section>
  );
}
