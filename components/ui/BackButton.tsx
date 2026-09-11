'use client';

import { useRouter } from 'next/navigation';
import { canGoBackInApp } from '@/lib/ui/nav-history';
import { Icon } from './Icon';

/**
 * 뒤로 가기.
 *
 * 사이트 안에서 눌러 들어온 경우에만 브라우저 기록을 되돌린다.
 * 검색이나 링크로 바로 들어온 사람에게 back()을 쓰면 사이트 밖으로 나가버리므로,
 * 그때는 한 단계 위 화면으로 보낸다.
 */
export function BackButton({ fallbackHref, label }: { fallbackHref: string; label: string }) {
  const router = useRouter();

  const goBack = () => {
    if (canGoBackInApp()) router.back();
    else router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="-ml-1.5 flex items-center gap-1 rounded-[8px] px-1.5 py-1 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
    >
      <Icon name="back" size={17} />
      {label}
    </button>
  );
}
