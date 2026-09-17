import type { SVGProps } from 'react';

/**
 * 이벤트 아이콘.
 * 이모지는 기기마다 모양과 색이 제멋대로라 브랜드가 흐트러진다.
 * 단색 라인 아이콘으로 통일하고 색은 currentColor로 넘겨받는다.
 */
export type IconName =
  | 'childcare'
  | 'marriage'
  | 'housing'
  | 'jobchange'
  | 'retirement'
  | 'inheritance'
  | 'socialdues'
  | 'rest'
  | 'share'
  | 'check'
  | 'close'
  | 'back'
  | 'copy'
  | 'phone';

const PATHS: Record<IconName, React.ReactNode> = {
  // 김이 오르는 잔 — 쉬는 시간
  rest: (
    <>
      <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
      <path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M8 6V4M12 6V4" />
    </>
  ),
  // 젖병
  childcare: (
    <>
      <path d="M9.5 3h5" />
      <path d="M10 3v2.3c0 .5-.2 1-.6 1.3l-.8.8c-.4.4-.6.9-.6 1.4V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8.8c0-.5-.2-1-.6-1.4l-.8-.8c-.4-.3-.6-.8-.6-1.3V3" />
      <path d="M8 11.5h8M8 15h8" />
    </>
  ),
  // 반지 두 개
  marriage: (
    <>
      <circle cx="9" cy="14" r="6" />
      <circle cx="15" cy="14" r="6" />
    </>
  ),
  // 집
  housing: (
    <>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  // 서류가방
  jobchange: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </>
  ),
  // 지평선 위의 해
  retirement: (
    <>
      <path d="M3 19.5h18" />
      <path d="M12 4v2.2M5.9 6.6l1.5 1.6M18.1 6.6l-1.5 1.6" />
      <path d="M7 15.5a5 5 0 0 1 10 0" />
    </>
  ),
  // 문서
  inheritance: (
    <>
      <path d="M6.5 3H13l5 5v12.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-17a.5.5 0 0 1 .5-.5Z" />
      <path d="M13 3v5h5" />
      <path d="M9 13h6M9 16.5h4" />
    </>
  ),
  // 봉투 (경조사비)
  socialdues: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.6 6.6 8.4 6 8.4-6" />
    </>
  ),
  // 링크
  share: (
    <>
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: (
    <>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1" />
    </>
  ),
  phone: (
    <path d="M6.5 3.5h3l1.5 3.5-2 1.2a11 11 0 0 0 4.8 4.8l1.2-2 3.5 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 5 5.1 1.5 1.5 0 0 1 6.5 3.5Z" />
  ),
};

export function Icon({
  name,
  size = 20,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
