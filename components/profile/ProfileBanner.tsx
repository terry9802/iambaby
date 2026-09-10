'use client';

import Link from 'next/link';
import { useProfile } from '@/lib/profile/context';
import { profileCompletion } from '@/lib/profile/schema';

/** 홈에서 "한 번 채우면 전부 자동으로 채워진다"는 이 사이트의 약속을 실감하게 하는 자리. */
export function ProfileBanner() {
  const { profile, hydrated } = useProfile();
  const { filled, total } = profileCompletion(profile);

  if (!hydrated) {
    return <div className="h-[86px] rounded-[12px] border border-line bg-surface" aria-hidden />;
  }

  const empty = filled === 0;

  return (
    <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[14px] font-semibold text-ink">
            {empty ? '한 번만 알려주시면 다시 안 여쭤봐요' : `프로필 ${filled}/${total} 채움`}
          </h2>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            {empty
              ? '통상임금과 아이 생일 같은 걸 한 번 적어두면, 모든 계산기가 알아서 채워집니다.'
              : '적어두신 값으로 계산기들이 자동으로 채워져요.'}
          </p>
        </div>
        <Link
          href="/me"
          className="shrink-0 rounded-[8px] bg-brand-strong px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-deep"
        >
          {empty ? '채우기' : '고치기'}
        </Link>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sunk">
        <div
          className="h-full rounded-full bg-brand transition-[width]"
          style={{ width: `${(filled / total) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-[11.5px] text-ink-faint">
        브라우저에만 저장돼요. 서버로 보내지 않습니다.
      </p>
    </section>
  );
}
