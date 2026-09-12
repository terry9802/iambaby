import type { Metadata } from 'next';
import { BackButton } from '@/components/ui/BackButton';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description:
    '난 아직 애긴데 세상이 너무 어려워요의 개인정보처리방침. 프로필은 브라우저에만 저장되며 서버로 전송되지 않습니다.',
  alternates: { canonical: '/privacy' },
};

const UPDATED = '2026년 9월 10일';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[16px] font-bold text-ink">{title}</h2>
      <div className="flex flex-col gap-2 text-[13.5px] leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-6 px-4 pb-16 pt-6">
      <BackButton fallbackHref="/" label="홈" />

      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-bold leading-snug tracking-[-0.015em] text-ink">
          개인정보처리방침
        </h1>
        <p className="tnum text-[12.5px] text-ink-faint">마지막 개정 {UPDATED}</p>
      </header>

      <Section title="1. 우리가 수집하지 않는 것">
        <p>
          이 사이트는 회원가입이 없고 로그인도 없습니다. 계산기에 입력하신 통상임금, 자녀 생년월일,
          거주지 같은 값은 <strong className="font-semibold text-ink">서버로 전송되지 않습니다.</strong>{' '}
          모든 계산은 여러분의 브라우저 안에서 이뤄지고, 결과도 브라우저를 벗어나지 않습니다.
        </p>
        <p>
          이름, 연락처, 주민등록번호 같은 개인 식별 정보는 애초에 입력받지 않으며 수집하지도
          않습니다.
        </p>
      </Section>

      <Section title="2. 브라우저에 저장되는 것 (localStorage)">
        <p>
          &lsquo;내 프로필&rsquo;에 적으신 값은 브라우저의 localStorage에 저장됩니다. 이 저장소는
          여러분의 기기 안에만 있으며 사이트 운영자도 볼 수 없습니다. 브라우저의 사이트 데이터를
          지우거나 프로필 화면에서 &lsquo;전부 지우기&rsquo;를 누르면 즉시 사라집니다.
        </p>
        <p>다른 기기나 다른 브라우저에서는 공유되지 않습니다.</p>
      </Section>

      <Section title="3. 방문 통계 (Google Analytics)">
        <p>
          어떤 계산기가 많이 쓰이는지 파악하기 위해 Google Analytics 4를 사용합니다. 이 도구는
          쿠키를 통해 방문 페이지, 체류 시간, 대략적인 지역, 기기 종류 같은 정보를 수집하며 IP
          주소는 익명 처리(anonymize_ip)됩니다.
        </p>
        <p>
          <strong className="font-semibold text-ink">
            계산기에 입력한 값은 어떤 형태로도 분석 도구에 전송하지 않습니다.
          </strong>
        </p>
        <p>
          수집을 원하지 않으시면{' '}
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand-strong underline underline-offset-2"
          >
            Google Analytics 차단 브라우저 부가기능
          </a>
          을 설치하시면 됩니다.
        </p>
      </Section>

      <Section title="4. 광고 (Google AdSense)">
        <p>
          사이트 운영 비용을 충당하기 위해 Google AdSense 광고를 게재할 수 있습니다. Google을 포함한
          제3자 공급업체는 쿠키를 사용해 이용자의 이전 방문 기록을 바탕으로 광고를 게재합니다.
        </p>
        <p>
          <a
            href="https://myadcenter.google.com/personalizationoff"
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand-strong underline underline-offset-2"
          >
            Google 광고 설정
          </a>
          에서 맞춤 광고를 끌 수 있고,{' '}
          <a
            href="https://www.aboutads.info/choices/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand-strong underline underline-offset-2"
          >
            aboutads.info
          </a>
          에서 제3자 공급업체의 맞춤 광고를 일괄로 거부할 수 있습니다.
        </p>
        <p>
          광고는 계산 결과 영역 안에 넣지 않습니다. 계산 결과와 광고가 섞여 보이지 않도록 본문이
          끝난 자리에만 &lsquo;광고&rsquo; 표시를 달아 배치합니다.
        </p>
      </Section>

      <Section title="5. 정보의 제3자 제공">
        <p>
          수집하는 개인정보가 없으므로 제3자에게 제공하는 개인정보도 없습니다. 위에 적은 Google
          Analytics·AdSense의 쿠키 처리는 각 서비스의 개인정보처리방침을 따릅니다.
        </p>
      </Section>

      <Section title="6. 계산 결과에 대한 면책">
        <p>
          이 사이트의 계산 결과는 참고용입니다. 실제 지급액과 자격 여부는 고용센터, 주민센터 등
          관할 기관의 산정에 따릅니다. 기준값은 법령·고시 원문을 확인해 표기하고 확인일을 화면에
          함께 표시하지만, 제도 변경으로 실제와 다를 수 있습니다.
        </p>
      </Section>

      <Section title="7. 문의">
        <p>
          개인정보 처리에 관해 궁금한 점이나 잘못된 계산을 발견하셨다면 알려주세요. 계산 정확도가 이
          사이트의 유일한 자산이라 제보를 가장 중요하게 다룹니다.
        </p>
      </Section>
    </div>
  );
}
