import type { Metadata } from 'next';
import Link from 'next/link';
import { BackButton } from '@/components/ui/BackButton';
import { ARTICLES } from '@/content/index';
import { EVENTS, TOOLS } from '@/lib/tools';
import { SITE_NAME, ogMeta } from '@/lib/site';

export const metadata: Metadata = {
  title: '소개 — 이 사이트가 뭐하는 곳인가요',
  description:
    '처음 겪는 일 앞에서 필요한 계산을 모은 곳입니다. 숫자만 던지지 않고 계산 과정과 근거 조문, 확인한 날짜까지 함께 보여드립니다.',
  alternates: { canonical: '/about' },
  ...ogMeta({
    path: '/about',
    title: '소개 — 이 사이트가 뭐하는 곳인가요',
    description: '계산 과정과 근거 조문, 확인한 날짜까지 함께 보여주는 생활 계산기 모음입니다.',
  }),
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[16px] font-bold text-ink">{title}</h2>
      <div className="flex flex-col gap-2.5 text-[13.5px] leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}

export default function AboutPage() {
  const liveEvents = EVENTS.filter((e) => e.status === 'live');

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-6 px-4 pb-16 pt-6">
      <BackButton fallbackHref="/" label="홈" />

      <header className="flex flex-col gap-2">
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
          이 사이트가 뭐하는 곳인가요
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">
          처음 겪는 일 앞에서 필요한 계산을 한곳에 모았습니다.
        </p>
      </header>

      <Section title="왜 만들었나">
        <p>
          육아휴직 급여가 얼마인지, 퇴직금이 얼마 나오는지, 축의금을 얼마 내야 하는지 — 살면서 한
          번은 부딪히지만 아무도 미리 가르쳐주지 않는 것들이 있습니다. 검색하면 글은 많은데, 대부분
          언제 적 기준인지 알 수 없고 근거도 적혀 있지 않습니다.
        </p>
        <p>
          그래서 <strong className="font-semibold text-ink">숫자 하나만 던지지 않는</strong> 계산기를
          만들었습니다. 얼마인지뿐 아니라 그 숫자가 어떻게 나왔는지, 어느 법 몇 조에 근거하는지,
          그 기준값을 언제 확인했는지까지 같은 화면에 놓습니다.
        </p>
      </Section>

      <Section title="지금 있는 것">
        <ul className="flex flex-col gap-1.5">
          {liveEvents.map((e) => (
            <li key={e.key} className="flex gap-2">
              <span
                aria-hidden
                className="mt-[8px] h-[3px] w-[3px] shrink-0 rounded-full bg-ink-faint"
              />
              <span>
                <Link href={`/${e.key}`} className="font-semibold text-ink hover:underline">
                  {e.title}
                </Link>{' '}
                — {e.lead}
              </span>
            </li>
          ))}
        </ul>
        <p className="tnum">
          계산기 {TOOLS.length}개, 설명 글 {ARTICLES.length}편이 있습니다. &lsquo;내 집 마련&rsquo;과
          &lsquo;상속 · 증여&rsquo;는 준비 중입니다. 하나를 제대로 만드는 편이 여러 개를
          어중간하게 만드는 것보다 낫다고 생각해서 순서대로 채우고 있습니다.
        </p>
      </Section>

      <Section title="숫자를 다루는 원칙">
        <p>
          <strong className="font-semibold text-ink">1. 출처를 확인하지 않은 숫자는 쓰지 않습니다.</strong>{' '}
          모든 기준값은 법령 원문, 부처 보도자료, 공공기관 공식 안내에서 확인한 것만 씁니다.
          블로그나 카페에 도는 숫자는 근거로 삼지 않고, 원문을 찾는 실마리로만 씁니다.
        </p>
        <p>
          <strong className="font-semibold text-ink">2. 확정되지 않은 것은 계산에 넣지 않습니다.</strong>{' '}
          예산안이나 입법예고 단계의 제도는 계산기에 넣지 않고, &lsquo;아직 확정 아님&rsquo;이라고
          밝힌 별도 안내로만 보여드립니다.
        </p>
        <p>
          <strong className="font-semibold text-ink">3. 모르는 건 모른다고 적습니다.</strong>{' '}
          확인하지 못한 값은 지어내지 않습니다. 대신 예상치를 보여드리고, 직접 고칠 수 있게 하고,
          물어볼 곳의 전화번호를 함께 놓습니다.
        </p>
        <p>
          <strong className="font-semibold text-ink">4. 기준값이 낡으면 화면에 표시합니다.</strong>{' '}
          확인한 지 6개월이 지난 기준값에는 &lsquo;기준값 확인 필요&rsquo; 표시가 자동으로 붙습니다.
          매달 1일에 제도가 바뀌었는지 다시 확인해 고치고 있습니다.
        </p>
      </Section>

      <Section title="입력한 값은 어디로도 가지 않습니다">
        <p>
          통상임금이나 자녀 생년월일 같은 값은{' '}
          <strong className="font-semibold text-ink">서버로 전송되지 않습니다.</strong> 회원가입도
          로그인도 없고, 모든 계산은 여러분의 브라우저 안에서 끝납니다. 프로필을 저장해도 그
          브라우저에만 남습니다.
        </p>
        <p>
          자세한 내용은{' '}
          <Link href="/privacy" className="font-medium text-brand-strong hover:underline">
            개인정보처리방침
          </Link>
          에 적어두었습니다.
        </p>
      </Section>

      <Section title="한계도 말씀드립니다">
        <p>
          이 사이트의 계산 결과는 <strong className="font-semibold text-ink">참고용</strong>입니다.
          실제 지급액과 자격 여부는 관할 기관의 산정에 따릅니다. 개인마다 다른 공제나 예외가 있어서,
          중요한 결정 전에는 담당 기관에 확인하시기를 권합니다. 각 계산기 화면에 물어볼 곳의
          전화번호를 함께 적어둔 이유입니다.
        </p>
        <p>
          자세한 이용 조건은{' '}
          <Link href="/terms" className="font-medium text-brand-strong hover:underline">
            이용약관
          </Link>
          을 봐주세요.
        </p>
      </Section>

      <Section title="틀린 것을 발견하셨다면">
        <p>
          계산 정확도가 이 사이트의 유일한 자산입니다. 잘못된 숫자나 낡은 기준을 발견하시면{' '}
          <Link href="/contact" className="font-medium text-brand-strong hover:underline">
            문의
          </Link>
          로 알려주세요. 가장 먼저 처리합니다.
        </p>
      </Section>

      <p className="border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-faint">
        {SITE_NAME}는 개인이 만들어 운영하는 사이트입니다. 어떤 기관이나 회사와도 관련이 없습니다.
      </p>
    </div>
  );
}
