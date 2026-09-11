'use client';

import { rememberEntry } from '@/lib/ui/nav-history';

// 이 파일이 브라우저에 처음 불러와지는 때가 곧 앱이 시작하는 때다.
rememberEntry();

/** 화면에는 아무것도 그리지 않는다. 앱이 시작한 시점을 기록하기 위해 존재한다. */
export function AppHistoryTracker() {
  return null;
}
