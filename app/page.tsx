import type { Metadata } from 'next';
import Image from 'next/image';
import { ARTICLES } from '@/content/index';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { HomeTabs } from '@/components/home/HomeTabs';
import { AdSlot } from '@/components/analytics/AdSense';
import { SiteJsonLd } from '@/components/seo/JsonLd';

/*
  홈은 레이아웃의 metadata를 그대로 쓰느라 canonical이 비어 있었다.
  가장 많이 들어오는 자리인데 정식 주소 표시가 없으면, 같은 내용을 가진
  vercel.app 주소와 검색에서 경쟁하게 된다. 여기만 따로 박아 둔다.
*/
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  // 글 본문까지 브라우저로 내려보낼 필요는 없으니 목록에 쓸 것만 추린다.
  const articles = ARTICLES.map((a) => ({
    slug: a.slug,
    event: a.event as string,
    question: a.question,
    title: a.title,
  }));

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-5 px-4 pb-16 pt-0">
      <SiteJsonLd />
      {/*
        첫 화면에서 가장 큰 그림이라 priority를 준다. 미리 받아두지 않으면
        글보다 늦게 떠서 화면이 한 번 밀린다.
      */}
      <div className="edge-fade -mx-4">
        <Image
          src="/img/hero-2.jpg"
          alt="빨간 횡단보도를 나란히 건너는 아이들"
          width={1600}
          height={462}
          priority
          sizes="(max-width: 680px) 100vw, 680px"
          className="h-auto w-full"
        />
      </div>
      <header className="flex flex-col gap-2.5 pt-1">
        <h1 className="text-[22px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
          몰라도 괜찮아요.
          <br />
          뭘 모르는지 몰라도 괜찮아요.
          <br />
          <span className="text-ink-soft">복잡한 세상에서 우린 아직 애기인거죠</span>
        </h1>
        <p className="text-[14.5px] leading-relaxed text-ink-soft">
          결혼, 출산, 내 집 마련처럼 처음 겪는 일 앞에서 필요한 계산과 정보를 한곳에 모읍니다.
          숫자만 던지지 않고 어떻게 나온 숫자인지, 어느 조문에 근거한 건지 함께 보여드려요.
        </p>
      </header>

      <ProfileBanner />

      <HomeTabs articles={articles} />

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} />
    </div>
  );
}
