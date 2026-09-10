import Script from 'next/script';

/**
 * GA4. 측정 ID가 없으면 아무것도 렌더링하지 않는다.
 * 프로필 값은 절대 이벤트 파라미터로 보내지 말 것 — 서버로 안 보낸다는 약속이 깨진다.
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
