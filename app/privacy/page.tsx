import type { Metadata } from 'next';
import Link from 'next/link';
import { BackButton } from '@/components/ui/BackButton';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description:
    '난 아직 애긴데 세상이 너무 어려워요의 개인정보처리방침. 프로필은 브라우저에만 저장되며 서버로 전송되지 않습니다. 가계부는 로그인하신 경우에만 암호화해서 저장됩니다.',
  alternates: { canonical: '/privacy' },
};

const UPDATED = '2026년 10월 5일'; // 가계부 계정 도입

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
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
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
        <p>
          딱 하나 예외가 있습니다. &lsquo;쓴 돈 적기&rsquo;에서{' '}
          <strong className="font-semibold text-ink">가계부 계정을 만들어 로그인</strong>하신
          경우에만 가계부가 저희 서버에 저장됩니다. 이때도 내용은 여러분 브라우저에서 핀으로 잠근
          뒤 올라가며, 저희는 그 안을 볼 수 없습니다. 아래 3번에 자세히 적었습니다.
        </p>
      </Section>

      <Section title="2. 브라우저에 저장되는 것 (localStorage)">
        <p>
          &lsquo;내 프로필&rsquo;에 적으신 값은 브라우저의 localStorage에 저장됩니다. 이 저장소는
          여러분의 기기 안에만 있으며 사이트 운영자도 볼 수 없습니다. 브라우저의 사이트 데이터를
          지우거나 프로필 화면에서 &lsquo;전부 지우기&rsquo;를 누르면 즉시 사라집니다.
        </p>
        <p>
          프로필은 다른 기기와 저절로 공유되지 않습니다. 사람마다 다른 값이라 계정에 싣지 않습니다.
          옮기고 싶으시면 &lsquo;프로필 옮기기&rsquo; 링크를 쓰시면 됩니다.
        </p>
      </Section>

      <Section title="3. 가계부 계정 (만드신 경우에만)">
        <p>
          &lsquo;쓴 돈 적기&rsquo;에서 아이디와 핀으로 계정을 만드시면, 적으신 가계부가 저희 서버에
          저장되어 어느 기기에서든 같은 내용이 보입니다. 계정을 안 만드시면 아무것도 올라가지
          않습니다.
        </p>
        <p>
          올라가는 내용은{' '}
          <strong className="font-semibold text-ink">
            여러분 브라우저에서 핀으로 잠근(암호화한) 덩어리
          </strong>
          입니다. <strong className="font-semibold text-ink">핀은 저희 서버로 보내지 않습니다.</strong>{' '}
          핀을 30만 번 되풀이해 만든 확인용 값만 보내고, 그 값도 서버에서 한 번 더 변환해 둡니다.
          저희는 금액도, 내역도, 날짜도 볼 수 없습니다.
        </p>
        <p>
          서버에 남는 것은 아이디를 되돌릴 수 없게 변환한 값, 핀 확인용 값, 잠긴 덩어리뿐입니다.
          이름, 연락처, 이메일은 받지 않습니다. 1년 넘게 쓰지 않으시면 저장된 가계부는 저절로
          지워집니다.
        </p>
        <p>
          <strong className="font-semibold text-ink">솔직히 밝혀 둘 한계가 있습니다.</strong> 핀이
          숫자 6자리면 경우의 수가 백만 가지입니다. 저희 서버의 저장소와 서버 설정값이{' '}
          <em>둘 다</em> 외부에 유출되는 경우, 시간을 들이면 잠금이 풀릴 수 있습니다. 바깥에서
          핀을 찍어 보는 것은 횟수 제한으로 막고 있고, 저장소만 유출되어서는 풀 수 없게 열쇠
          조각을 나눠 두었지만, 6자리라는 한계 자체는 남습니다. 핀을 길게(최대 12자리) 쓰실수록
          안전해집니다.
        </p>
        <p>
          언제든 &lsquo;쓴 돈 적기&rsquo; 화면의 &lsquo;로그아웃 → 계정을 아예 지우기&rsquo;를
          누르시면 계정과 저장된 가계부가 즉시 삭제됩니다. 기기에 적어 두신 기록은 그대로 남습니다.
        </p>
        <p>
          핀을 잊으시면 저희도 열어 드릴 수 없습니다. 열쇠를 갖고 있지 않기 때문입니다. 계정을 새로
          만드셔야 하고, 기기에 남아 있는 기록은 그대로 쓰실 수 있습니다.
        </p>
      </Section>

      <Section title="4. 방문 통계 (Google Analytics)">
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

      <Section title="5. 광고 (Google AdSense)">
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

      <Section title="6. 정보의 제3자 제공">
        <p>
          수집하는 개인정보가 없으므로 제3자에게 제공하는 개인정보도 없습니다. 위에 적은 Google
          Analytics·AdSense의 쿠키 처리는 각 서비스의 개인정보처리방침을 따릅니다.
        </p>
        <p>
          가계부 계정의 잠긴 덩어리는 클라우드 저장소(Upstash)에 맡겨 둡니다. 맡기는 것은 잠긴
          덩어리와 되돌릴 수 없게 변환한 값뿐이고, 그 업체도 저희와 마찬가지로 안을 볼 수 없습니다.
        </p>
      </Section>

      <Section title="7. 계산 결과에 대한 면책">
        <p>
          이 사이트의 계산 결과는 참고용입니다. 실제 지급액과 자격 여부는 고용센터, 주민센터 등
          관할 기관의 산정에 따릅니다. 기준값은 법령·고시 원문을 확인해 표기하고 확인일을 화면에
          함께 표시하지만, 제도 변경으로 실제와 다를 수 있습니다.
        </p>
      </Section>

      <Section title="8. 문의">
        <p>
          개인정보 처리에 관해 궁금한 점이나 잘못된 계산을 발견하셨다면 알려주세요. 계산 정확도가 이
          사이트의 유일한 자산이라 제보를 가장 중요하게 다룹니다.
        </p>
        <p>
          연락처는{' '}
          <Link href="/contact" className="font-medium text-brand-strong hover:underline">
            문의
          </Link>{' '}
          페이지에 있습니다. 계산기에 넣으신 값은 서버로 가지 않으므로 삭제를 요청하실 것이
          없고, 가계부 계정은 그 화면에서 직접 지우실 수 있습니다 (위 3번). 브라우저에 저장된
          프로필은{' '}
          <Link href="/me" className="font-medium text-brand-strong hover:underline">
            내 프로필
          </Link>{' '}
          화면에서 직접 지우실 수 있습니다.
        </p>
      </Section>
    </div>
  );
}
