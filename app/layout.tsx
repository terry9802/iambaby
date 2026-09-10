import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { ProfileProvider } from '@/lib/profile/context';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { AdSenseScript } from '@/components/analytics/AdSense';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · 출산·육아 계산기`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    '몰라도 괜찮아요. 뭘 모르는지 몰라도 괜찮아요. 복잡한 세상에서 우린 아직 애기인거죠. 육아휴직 급여, 6+6 부모육아휴직 조합, 출산 지원금, 휴가 일정을 계산 과정과 근거 조문까지 함께 보여드립니다.',
  keywords: [
    '육아휴직 급여 계산기',
    '6+6 부모육아휴직제',
    '출산전후휴가',
    '출산 지원금',
    '부모급여',
    '첫만남이용권',
  ],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${SITE_NAME} · 출산·육아 계산기`,
    description:
      '몰라도 괜찮아요. 뭘 모르는지 몰라도 괜찮아요. 복잡한 세상에서 우린 아직 애기인거죠.',
  },
  robots: { index: true, follow: true },
  verification: process.env.NEXT_PUBLIC_GSC_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f4f6f8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">
        <ProfileProvider>
          <div className="flex min-h-dvh flex-col">
            <header className="sticky top-0 z-10 border-b border-line bg-ground/90 backdrop-blur">
              <div className="mx-auto flex w-full max-w-[680px] items-center justify-between gap-3 px-4 py-3">
                <Link href="/" className="text-[14px] font-bold tracking-[-0.01em] text-ink">
                  난아직애긴데
                  <span className="font-medium text-ink-faint">세상이너무어려워요</span>
                </Link>
                <Link
                  href="/me"
                  className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-line-strong"
                >
                  내 프로필
                </Link>
              </div>
            </header>

            <main className="flex-1">{children}</main>

            <footer className="border-t border-line bg-surface">
              <div className="mx-auto flex w-full max-w-[680px] flex-col gap-2 px-4 py-8">
                <p className="text-[13px] font-semibold text-ink">{SITE_NAME}</p>
                <p className="text-[12.5px] leading-relaxed text-ink-soft">
                  입력한 값은 이 브라우저에만 저장되고 서버로 전송되지 않습니다. 계산은 전부
                  브라우저 안에서 이뤄집니다.
                </p>
                <p className="text-[12px] leading-relaxed text-ink-faint">
                  이 사이트의 계산 결과는 참고용이며, 실제 지급액과 자격 여부는 관할 기관의 산정에
                  따릅니다. 기준값은 법령·고시 원문을 확인해 표기하며 확인일이 오래되면 화면에
                  표시합니다.
                </p>
                <nav className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                  <Link href="/childcare" className="text-ink-soft hover:text-ink">
                    출산 · 육아
                  </Link>
                  <Link href="/guide" className="text-ink-soft hover:text-ink">
                    읽을거리
                  </Link>
                  <Link href="/me" className="text-ink-soft hover:text-ink">
                    내 프로필
                  </Link>
                  <Link href="/privacy" className="text-ink-soft hover:text-ink">
                    개인정보처리방침
                  </Link>
                </nav>
              </div>
            </footer>
          </div>
        </ProfileProvider>
        <GoogleAnalytics />
        <AdSenseScript />
      </body>
    </html>
  );
}
