'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

type Gtag = (...args: unknown[]) => void;

/**
 * 주소가 바뀔 때마다 조회수를 보낸다.
 *
 * App Router는 링크를 눌러도 페이지를 새로 받지 않아서, gtag의 자동 집계로는
 * 처음 들어온 한 장만 세어진다. 계산기를 눌러 들어간 것이 전부 누락된다.
 *
 * 그리고 더 중요한 것: 공유 링크 주소에는 사용자가 넣은 금액이 들어 있다.
 * (?wage=3700000 같은 것) 자동 집계는 주소를 통째로 보내므로 그 숫자가 구글로 넘어간다.
 * 이 사이트는 입력값을 서버로 보내지 않는다고 약속했으므로, 물음표 뒤는 잘라내고
 * 경로만 보낸다. 그래서 자동 집계를 끄고(send_page_view: false) 여기서 직접 보낸다.
 */
function PageViews() {
  const pathname = usePathname();

  useEffect(() => {
    if (!GA_ID) return;
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (!gtag) return;
    gtag('event', 'page_view', {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_title: document.title,
    });
  }, [pathname]);

  return null;
}

/**
 * GA4. 측정 ID가 없으면 아무것도 렌더링하지 않는다.
 * 프로필 값은 절대 이벤트 파라미터로 보내지 말 것 — 서버로 안 보낸다는 약속이 깨진다.
 */
export function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true, send_page_view: false });
        `}
      </Script>
      <PageViews />
    </>
  );
}
