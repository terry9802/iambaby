import type { Metadata } from 'next';
import Link from 'next/link';
import { BackButton } from '@/components/ui/BackButton';
import { SITE_NAME, ogMeta } from '@/lib/site';

export const metadata: Metadata = {
  title: '이용약관 — 계산 결과를 어디까지 믿어야 하나',
  description:
    '이 사이트의 계산 결과는 참고용입니다. 실제 지급액과 자격 여부는 관할 기관의 산정에 따릅니다. 이용 조건과 책임 범위를 정리했습니다.',
  alternates: { canonical: '/terms' },
  ...ogMeta({
    path: '/terms',
    title: '이용약관 — 계산 결과를 어디까지 믿어야 하나',
    description: '계산 결과는 참고용이며 실제 지급액은 관할 기관의 산정에 따릅니다.',
  }),
};

const UPDATED = '2026년 9월 17일';

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

export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-6 px-4 pb-16 pt-6">
      <BackButton fallbackHref="/" label="홈" />

      <header className="flex flex-col gap-2">
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
          이용약관
        </h1>
        <p className="tnum text-[12.5px] text-ink-faint">마지막 개정 {UPDATED}</p>
      </header>

      <Section title="1. 이 사이트는 무엇인가">
        <p>
          {SITE_NAME}(이하 &lsquo;이 사이트&rsquo;)는 출산·육아, 결혼, 이직, 퇴직처럼 처음 겪는 일에
          필요한 계산을 돕는 도구입니다. 회원가입이 없고, 이용료를 받지 않습니다.
        </p>
        <p>
          개인이 만들어 운영합니다. 정부기관, 금융기관, 어떤 회사와도 관련이 없고 그들을 대리하지도
          않습니다.
        </p>
      </Section>

      <Section title="2. 계산 결과는 참고용입니다">
        <p>
          <strong className="font-semibold text-ink">
            이 사이트의 계산 결과는 법적 효력이 없습니다.
          </strong>{' '}
          실제 지급액과 자격 여부는 고용노동부, 국세청, 지방자치단체 등 관할 기관의 산정과 심사에
          따릅니다.
        </p>
        <p>계산 결과가 실제와 달라질 수 있는 이유는 이렇습니다.</p>
        <ul className="flex flex-col gap-1.5">
          {[
            '개인마다 다른 공제 항목과 예외 규정을 전부 반영할 수 없습니다.',
            '법령과 고시는 수시로 바뀌고, 바뀐 것이 화면에 반영되기까지 시차가 있습니다.',
            '입력하신 값이 실제와 다르면 결과도 달라집니다. 통상임금처럼 회사 규정에 따라 정해지는 값은 특히 그렇습니다.',
            '관할 기관이 같은 조문을 다르게 해석하는 경우가 있습니다.',
          ].map((text, i) => (
            <li key={i} className="flex gap-2">
              <span
                aria-hidden
                className="mt-[8px] h-[3px] w-[3px] shrink-0 rounded-full bg-ink-faint"
              />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <p>
          그래서 중요한 결정 전에는 담당 기관에 확인하시기를 권합니다. 각 계산기 화면에 물어볼 곳의
          전화번호를 함께 적어둔 이유입니다.
        </p>
      </Section>

      <Section title="3. 기준값과 근거">
        <p>
          모든 기준값은 법령 원문, 부처 보도자료, 공공기관 공식 안내에서 확인한 것만 씁니다. 각
          계산 결과 아래에 어느 법 몇 조에 근거했는지와 그 값을 언제 확인했는지를 함께 표시합니다.
        </p>
        <p>
          확인한 지 6개월이 지난 기준값에는 &lsquo;기준값 확인 필요&rsquo; 표시가 자동으로 붙습니다.
          그 표시가 보이면 관할 기관에 다시 확인해 주세요.
        </p>
        <p>
          예산안이나 입법예고 단계처럼{' '}
          <strong className="font-semibold text-ink">확정되지 않은 제도</strong>는 계산에 넣지 않고,
          &lsquo;아직 확정 아님&rsquo;이라고 밝힌 별도 안내로만 보여드립니다.
        </p>
      </Section>

      <Section title="4. 책임의 범위">
        <p>
          이 사이트를 이용해 내린 판단과 그 결과에 대한 책임은 이용자에게 있습니다. 운영자는 계산
          결과의 정확성을 최선을 다해 관리하지만, 그 결과에 의존해 발생한 손해에 대해 법적 책임을
          지지 않습니다.
        </p>
        <p>
          다만 이것이 오류를 방치하겠다는 뜻은 아닙니다. 잘못된 숫자를 알려주시면 가장 먼저
          고칩니다.{' '}
          <Link href="/contact" className="font-medium text-brand-strong hover:underline">
            문의
          </Link>
          로 알려주세요.
        </p>
      </Section>

      <Section title="5. 입력한 값의 처리">
        <p>
          계산기에 입력하신 값은 서버로 전송되지 않고 브라우저 안에서만 처리됩니다. 자세한 내용은{' '}
          <Link href="/privacy" className="font-medium text-brand-strong hover:underline">
            개인정보처리방침
          </Link>
          에 있습니다.
        </p>
        <p>
          공유 링크에는 입력하신 금액이 주소 안에 담깁니다. 링크를 받은 사람은 그 숫자를 볼 수
          있으니, 아무나 볼 수 있는 곳에 올리지 말아 주세요.
        </p>
      </Section>

      <Section title="6. 저작권">
        <p>
          이 사이트의 설명 글과 화면 구성에 대한 권리는 운영자에게 있습니다. 개인적으로 읽고
          참고하시는 것은 자유이고, 링크를 공유하시는 것도 환영합니다.
        </p>
        <p>
          다만 글 전체를 옮겨 싣거나 상업적으로 이용하실 때는 미리 알려주세요. 인용하실 때는 출처와
          링크를 함께 밝혀주시면 됩니다.
        </p>
        <p>
          법령 조문과 정부 공식 안내의 내용 자체는 공공저작물이며, 이 사이트가 권리를 주장하지
          않습니다.
        </p>
      </Section>

      <Section title="7. 광고">
        <p>
          운영 비용을 충당하기 위해 광고를 게재할 수 있습니다. 광고는 계산 결과 영역 안에 넣지 않고,
          본문이 끝난 자리에 &lsquo;광고&rsquo; 표시를 달아 배치합니다. 계산 결과와 광고가 섞여
          보이면 이 사이트의 쓸모가 사라진다고 생각하기 때문입니다.
        </p>
        <p>
          광고의 내용은 운영자가 고르지 않으며, 광고에 나온 상품이나 서비스를 추천하지 않습니다.
        </p>
      </Section>

      <Section title="8. 약관의 변경">
        <p>
          이 약관은 필요에 따라 바뀔 수 있습니다. 바뀌면 이 페이지의 개정일이 함께 바뀝니다.
        </p>
      </Section>
    </div>
  );
}
