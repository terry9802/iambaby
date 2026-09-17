'use client';

import { useEffect, useRef } from 'react';

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

/**
 * AdSense 로더. 퍼블리셔 ID가 없으면 아무것도 넣지 않는다.
 *
 * next/script의 afterInteractive를 쓰면 처음 내려가는 HTML에는
 * <link rel="preload">만 남고 진짜 <script> 태그는 하이드레이션 뒤에야 생긴다.
 * 구글이 사이트를 확인할 때 HTML에서 이 태그를 찾으므로, 그때 없으면
 * "코드를 찾을 수 없습니다"로 심사가 막힌다. 그래서 평범한 script 태그로 둔다.
 * async라 그리는 것을 막지 않는다. 반드시 <head> 안에서 렌더링할 것.
 */
export function AdSenseScript() {
  if (!CLIENT) return null;
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`}
      crossOrigin="anonymous"
    />
  );
}

/**
 * 광고 자리.
 * 계산 결과 카드와 광고가 섞여 보이면 신뢰를 잃는다. 결과 영역 안에는 두지 않고,
 * 본문이 끝난 뒤에만 '광고' 라벨을 달아 배치한다.
 */
export function AdSlot({ slot }: { slot?: string }) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!CLIENT || !slot || pushed.current) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
      pushed.current = true;
    } catch {
      // 광고 차단기가 있으면 조용히 넘어간다.
    }
  }, [slot]);

  if (!CLIENT || !slot) return null;

  return (
    <aside className="flex flex-col gap-1" aria-label="광고">
      <span className="text-[11px] text-ink-faint">광고</span>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
