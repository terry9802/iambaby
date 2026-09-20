import type { Metadata } from 'next';
import { BackButton } from '@/components/ui/BackButton';
import { ProfileForm } from '@/components/profile/ProfileForm';

export const metadata: Metadata = {
  title: '내 프로필',
  description: '한 번 적어두면 모든 계산기가 자동으로 채워집니다. 브라우저에만 저장돼요.',
  robots: { index: false, follow: true },
};

export default function ProfilePage() {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-4 px-4 pb-16 pt-6">
      <BackButton fallbackHref="/" label="홈" />
      <header className="flex flex-col gap-2">
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
          한 번만 알려주세요
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">
          여기 적어두시면 계산기마다 같은 걸 다시 여쭤보지 않아요. 전부 브라우저에만 저장되고 서버로
          보내지 않습니다.
        </p>
      </header>
      <ProfileForm />
    </div>
  );
}
