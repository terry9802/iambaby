/**
 * 로고 — iam__baby.
 *
 * 가운데 빈칸은 iamstillbaby.com 의 still 자리다.
 * 나중에 strong · smart · no 처럼 갈아 끼우는 마케팅을 하실 예정이라 비워 두고,
 * 글자가 아니라 막대로 그린다. 글꼴 크기에 비례하도록 em으로만 잡아서
 * 어디에 놓든 같은 비율로 따라온다.
 */
export function Logo({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-label="iam baby"
      className={`inline-flex items-end font-extrabold leading-none tracking-[-0.03em] text-brand ${className}`}
      style={{ fontSize: size }}
    >
      <span aria-hidden>iam</span>
      <span
        aria-hidden
        className="inline-block rounded-[1px] bg-current"
        style={{ width: '0.45em', height: '0.13em', margin: '0 0.03em 0.02em' }}
      />
      <span aria-hidden>baby</span>
    </span>
  );
}
