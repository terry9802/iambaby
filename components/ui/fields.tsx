'use client';

import { useId, type ReactNode } from 'react';
import { formatManwon } from '@/lib/format';

/** 입력 한 칸의 공통 껍데기. 라벨 · 도움말 · 자동채움 표시를 한 자리에서 관리한다. */
function FieldFrame({
  id,
  label,
  hint,
  autofilled,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  autofilled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
        {label}
        {autofilled && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
            프로필에서 가져옴
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-[12.5px] leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}

const inputClass =
  'w-full rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[15px] text-ink ' +
  'placeholder:text-ink-faint focus:border-brand focus:outline-none';

export function MoneyField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  autofilled,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  placeholder?: string;
  autofilled?: boolean;
}) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} autofilled={autofilled}>
      <div className="relative">
        <input
          id={id}
          className={`${inputClass} tnum pr-10 text-right`}
          inputMode="numeric"
          value={value === undefined ? '' : value.toLocaleString('ko-KR')}
          placeholder={placeholder}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, '');
            onChange(digits === '' ? undefined : Number(digits));
          }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-faint">
          원
        </span>
      </div>
      {value !== undefined && value > 0 && (
        <p className="tnum text-right text-[12.5px] text-ink-soft">{formatManwon(value)}</p>
      )}
    </FieldFrame>
  );
}

export function NumberField({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 99,
  unit,
  autofilled,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  min?: number;
  max?: number;
  unit?: string;
  autofilled?: boolean;
}) {
  const id = useId();
  const step = (delta: number) => {
    const base = value ?? min;
    onChange(Math.max(min, Math.min(max, base + delta)));
  };
  return (
    <FieldFrame id={id} label={label} hint={hint} autofilled={autofilled}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label={`${label} 줄이기`}
          className="w-11 shrink-0 rounded-[8px] border border-line bg-surface text-[18px] text-ink-soft hover:border-line-strong"
          onClick={() => step(-1)}
        >
          −
        </button>
        <div className="relative flex-1">
          <input
            id={id}
            className={`${inputClass} tnum text-center`}
            inputMode="numeric"
            value={value === undefined ? '' : String(value)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, '');
              onChange(digits === '' ? undefined : Math.min(max, Number(digits)));
            }}
          />
          {unit && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-faint">
              {unit}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={`${label} 늘리기`}
          className="w-11 shrink-0 rounded-[8px] border border-line bg-surface text-[18px] text-ink-soft hover:border-line-strong"
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
    </FieldFrame>
  );
}

export function DateField({
  label,
  hint,
  value,
  onChange,
  autofilled,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  autofilled?: boolean;
}) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} autofilled={autofilled}>
      <input
        id={id}
        type="date"
        className={`${inputClass} tnum`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </FieldFrame>
  );
}

export function SegmentedField<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
  autofilled,
}: {
  label: string;
  hint?: string;
  value: T | undefined;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  autofilled?: boolean;
}) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} autofilled={autofilled}>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={
                'rounded-[8px] border px-3 py-2 text-[14px] transition-colors ' +
                (active
                  ? 'border-brand bg-brand font-semibold text-white'
                  : 'border-line bg-surface text-ink-soft hover:border-line-strong')
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </FieldFrame>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
  placeholder,
  autofilled,
}: {
  label: string;
  hint?: string;
  value: T | undefined;
  onChange: (next: T | undefined) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  autofilled?: boolean;
}) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} autofilled={autofilled}>
      <select
        id={id}
        className={inputClass}
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
      >
        <option value="">{placeholder ?? '선택해 주세요'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 rounded-[8px] border border-line bg-surface px-3 py-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1b3a8f]"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[14px] font-semibold text-ink">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-faint">{hint}</span>
        )}
      </label>
    </div>
  );
}

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}
