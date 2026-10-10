'use client';

import { SCOPE_LABEL, SCOPES, type Scope } from '@/lib/ledger/scope';

/**
 * 전체 · 개인 · 그룹 버튼.
 *
 * 화면 여러 자리에 같은 버튼이 놓이고 하나를 누르면 다 같이 움직인다. 그림과
 * 목록이 따로 놀면 숫자가 안 맞는 것처럼 보이기 때문이다.
 *
 * 그룹은 아직 안 만드셨어도 자리를 비워 두지 않는다. 버튼이 아예 없으면 그런
 * 기능이 있는지 알 길이 없다. 눌러 보시면 어떻게 만드는지 알려 준다.
 */
export function ScopeTabs({
  scope,
  onScope,
  label = '볼 범위',
}: {
  scope: Scope;
  onScope: (next: Scope) => void;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 rounded-[8px] border border-line bg-sunk p-0.5"
    >
      {SCOPES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onScope(s)}
          aria-pressed={scope === s}
          className={
            'rounded-[6px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors ' +
            (scope === s
              ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(20,22,26,0.08)]'
              : 'text-ink-soft hover:text-ink')
          }
        >
          {SCOPE_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
