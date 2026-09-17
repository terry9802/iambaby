import { ARTICLES } from '@/content/index';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { HomeTabs } from '@/components/home/HomeTabs';
import { AdSlot } from '@/components/analytics/AdSense';
import { SiteJsonLd } from '@/components/seo/JsonLd';

export default function HomePage() {
  // 글 본문까지 브라우저로 내려보낼 필요는 없으니 목록에 쓸 것만 추린다.
  const articles = ARTICLES.map((a) => ({
    slug: a.slug,
    event: a.event as string,
    question: a.question,
    title: a.title,
  }));

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-5 px-4 pb-16 pt-6">
      <SiteJsonLd />
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[26px] font-bold leading-snug tracking-[-0.015em] text-ink">
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
