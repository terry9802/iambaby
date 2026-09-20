import type { Metadata } from 'next';
import Link from 'next/link';
import { BackButton } from '@/components/ui/BackButton';
import { CONTACT_EMAIL } from '@/lib/contact';
import { SITE_NAME, ogMeta } from '@/lib/site';

export const metadata: Metadata = {
  title: '문의 — 틀린 숫자를 발견하셨다면',
  description:
    '잘못된 계산, 낡은 기준값, 빠진 제도를 알려주세요. 계산 정확도가 이 사이트의 유일한 자산이라 제보를 가장 먼저 처리합니다.',
  alternates: { canonical: '/contact' },
  ...ogMeta({
    path: '/contact',
    title: '문의 — 틀린 숫자를 발견하셨다면',
    description: '잘못된 계산과 낡은 기준값 제보를 가장 먼저 처리합니다.',
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

export default function ContactPage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-6 px-4 pb-16 pt-6">
      <BackButton fallbackHref="/" label="홈" />

      <header className="flex flex-col gap-2">
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">문의</h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">
          틀린 숫자를 발견하셨다면 알려주세요. 가장 먼저 처리합니다.
        </p>
      </header>

      <section className="rounded-[12px] border border-line-strong bg-surface px-5 py-5">
        <p className="text-[13px] font-medium text-ink-soft">이메일</p>
        {CONTACT_EMAIL ? (
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-1 block break-all text-[20px] font-bold tracking-[-0.01em] text-brand-strong hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        ) : (
          <p className="mt-1 text-[16px] font-bold text-ink-faint">준비 중입니다</p>
        )}
        <p className="mt-2.5 border-t border-line pt-2.5 text-[12.5px] leading-relaxed text-ink-faint">
          보통 며칠 안에 답장드립니다. 개인이 운영하는 사이트라 조금 늦어질 수 있어요.
        </p>
      </section>

      <Section title="이런 제보가 가장 도움이 됩니다">
        <ul className="flex flex-col gap-2">
          {[
            '계산 결과가 실제 받은 금액과 다르다 — 어떤 계산기에서 어떤 값을 넣었을 때 얼마가 나왔는지 함께 적어주시면 바로 확인할 수 있습니다.',
            '기준값이 낡았다 — 법이나 고시가 바뀌었는데 화면이 그대로인 경우입니다. 원문 링크를 같이 주시면 빠릅니다.',
            '우리 지자체 지원금이 빠져 있다 — 공식 안내 페이지 주소를 알려주시면 확인해서 넣겠습니다.',
            '설명이 이해가 안 된다 — 어느 문장에서 막혔는지 알려주시면 다시 씁니다. 이것도 오류로 봅니다.',
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
      </Section>

      <Section title="답변드리기 어려운 것">
        <p>
          <strong className="font-semibold text-ink">개인 상담은 어렵습니다.</strong> 이 사이트는
          계산 도구이지 상담 창구가 아닙니다. 내 경우가 해당되는지, 얼마를 받을 수 있는지 같은 판단은
          관할 기관이 해야 정확합니다.
        </p>
        <p>
          각 계산기 화면에 물어볼 곳의 전화번호를 적어두었습니다. 육아휴직과 실업급여는 고용노동부
          고객상담센터(1350), 세금은 국세청 세미래 콜센터(126), 지자체 지원금은 정부 대표 민원
          상담(110)이 가장 정확합니다.
        </p>
      </Section>

      <Section title="개인정보 관련 문의">
        <p>
          이 사이트는 입력값을 서버로 보내지 않으므로 삭제를 요청하실 개인정보 자체가 없습니다.
          브라우저에 저장된 프로필은{' '}
          <Link href="/me" className="font-medium text-brand-strong hover:underline">
            내 프로필
          </Link>{' '}
          화면에서 직접 지우실 수 있습니다. 자세한 내용은{' '}
          <Link href="/privacy" className="font-medium text-brand-strong hover:underline">
            개인정보처리방침
          </Link>
          을 봐주세요.
        </p>
      </Section>

      <p className="border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-faint">
        {SITE_NAME}는 개인이 만들어 운영하는 사이트입니다. 어떤 기관이나 회사와도 관련이 없습니다.
      </p>
    </div>
  );
}
