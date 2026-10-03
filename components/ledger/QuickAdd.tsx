'use client';

import { useCallback, useRef, useState } from 'react';
import { formatKRW, toISODate } from '@/lib/format';
import {
  CATEGORY_LABEL,
  EXCLUDED_HINT,
  HOLDER_LABEL,
  METHOD_LABEL,
  PURSE_LABEL,
  type Category,
  type Entry,
  type Holder,
  type Method,
  type Purse,
} from '@/lib/ledger/schema';
import { Icon } from '@/components/ui/Icon';

/**
 * 하루치 지출을 몰아서 적는 자리.
 *
 * 가계부가 안 쓰이는 이유는 적기가 귀찮아서지, 기능이 모자라서가 아니다.
 * 그래서 줄 하나를 적는 데 드는 동작 수를 줄이는 데만 신경 썼다.
 *
 *  - 날짜·지갑·결제수단·명의는 바로 앞 줄 것을 그대로 물려받는다. 하루치를
 *    몰아서 적을 때 같은 값을 네 번 고르게 하지 않는다.
 *  - 금액만 치고 Enter를 누르면 다음 줄이 열리고 커서가 거기로 간다.
 *    장 본 영수증을 보고 숫자만 쭉 치면 된다.
 *  - 저장은 맨 끝에 한 번이다. 한 줄 적을 때마다 저장하면 중간에 실수한 걸
 *    되돌리기 어렵다.
 */

type Draft = {
  key: string;
  date: string;
  amount: string;
  purse: Purse;
  method: Method;
  holder: Holder;
  category: Category;
  memo: string;
};

const PURSES: Purse[] = ['personal', 'couple'];
const METHODS: Method[] = ['credit', 'check', 'cash'];
const CATEGORIES: Category[] = ['general', 'market', 'transit', 'culture', 'excluded'];

let seq = 0;
function emptyDraft(from: Partial<Draft>, today: string): Draft {
  seq += 1;
  return {
    key: `draft-${seq}`,
    date: from.date ?? today,
    amount: '',
    purse: from.purse ?? 'personal',
    method: from.method ?? 'credit',
    holder: from.holder ?? 'me',
    category: from.category ?? 'general',
    memo: '',
  };
}

function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] font-medium text-ink-faint">{label}</span>
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
                'rounded-full border px-2.5 py-1 text-[12.5px] transition-colors ' +
                (active
                  ? 'border-brand-strong bg-brand-strong font-semibold text-white'
                  : 'border-line bg-surface text-ink-soft hover:border-line-strong')
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function QuickAdd({
  today,
  married,
  onAdd,
}: {
  today: string;
  /** 기혼이 아니면 명의를 물을 이유가 없다. 커플통장도 마찬가지다. */
  married: boolean;
  onAdd: (rows: Omit<Entry, 'id'>[]) => boolean;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [failed, setFailed] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const amountRefs = useRef(new Map<string, HTMLInputElement | null>());

  const focusAmount = useCallback((key: string) => {
    window.requestAnimationFrame(() => amountRefs.current.get(key)?.focus());
  }, []);

  const addRow = useCallback(() => {
    setSavedCount(0);
    setDrafts((prev) => {
      const next = emptyDraft(prev[prev.length - 1] ?? {}, today);
      focusAmount(next.key);
      return [...prev, next];
    });
  }, [today, focusAmount]);

  const patch = (key: string, p: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...p } : d)));

  const removeRow = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const filled = drafts.filter((d) => Number(d.amount.replace(/[^0-9]/g, '')) > 0);

  const save = () => {
    if (filled.length === 0) return;
    const ok = onAdd(
      filled.map((d) => ({
        date: d.date,
        amount: Number(d.amount.replace(/[^0-9]/g, '')),
        purse: married ? d.purse : 'personal',
        method: d.method,
        holder: married ? d.holder : 'me',
        category: d.category,
        ...(d.memo.trim() ? { memo: d.memo.trim() } : {}),
      })),
    );
    if (ok) {
      setSavedCount(filled.length);
      setDrafts([]);
    }
    setFailed(!ok);
  };

  const total = filled.reduce((sum, d) => sum + Number(d.amount.replace(/[^0-9]/g, '')), 0);

  return (
    <section className="rounded-[12px] border border-line-strong bg-surface px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold text-ink">오늘 쓴 돈 적기</h2>
        {savedCount > 0 && (
          <span className="flex items-center gap-1 text-[12.5px] font-medium text-brand-strong">
            <Icon name="check" size={14} />
            {savedCount}건 저장했어요
          </span>
        )}
      </div>

      {drafts.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
          아래 버튼을 누르면 한 줄이 열려요. 금액을 치고 Enter를 누르면 다음 줄이 바로 열리니,
          영수증을 보고 숫자만 쭉 치시면 됩니다.
        </p>
      ) : (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
          날짜와 결제수단은 바로 앞 줄을 그대로 물려받아요. 달라진 것만 고치시면 됩니다.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2.5">
        {drafts.map((d, i) => (
          <div key={d.key} className="rounded-[10px] border border-line bg-sunk px-3 py-3">
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-[12px] font-semibold text-ink-faint">{i + 1}</span>
              <input
                ref={(el) => {
                  amountRefs.current.set(d.key, el);
                }}
                aria-label={`${i + 1}번째 줄 금액`}
                inputMode="numeric"
                placeholder="금액"
                className="tnum min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-3 py-2.5 text-right text-[16px] font-semibold text-ink focus:border-brand focus:outline-none"
                value={d.amount}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '');
                  patch(d.key, { amount: digits ? Number(digits).toLocaleString('ko-KR') : '' });
                }}
                onKeyDown={(e) => {
                  // 숫자만 치고 Enter — 가계부 적기의 거의 전부가 이 동작이다.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i === drafts.length - 1) addRow();
                    else focusAmount(drafts[i + 1].key);
                  }
                }}
              />
              <span className="shrink-0 text-[13px] text-ink-soft">원</span>
              <button
                type="button"
                aria-label={`${i + 1}번째 줄 지우기`}
                className="shrink-0 rounded-[8px] border border-line bg-surface p-2 text-ink-faint hover:border-line-strong"
                onClick={() => removeRow(d.key)}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2.5">
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-ink-faint">날짜</span>
                <input
                  type="date"
                  aria-label={`${i + 1}번째 줄 날짜`}
                  className="tnum rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink focus:border-brand focus:outline-none"
                  value={d.date}
                  max={today}
                  onChange={(e) => patch(d.key, { date: e.target.value })}
                />
              </label>

              {married && (
                <Chips<Purse>
                  label="어느 돈으로"
                  value={d.purse}
                  onChange={(purse) => patch(d.key, { purse })}
                  options={PURSES.map((v) => ({ value: v, label: PURSE_LABEL[v] }))}
                />
              )}

              <Chips<Method>
                label="결제수단"
                value={d.method}
                onChange={(method) => patch(d.key, { method })}
                options={METHODS.map((v) => ({ value: v, label: METHOD_LABEL[v] }))}
              />

              {married && (
                <Chips<Holder>
                  label="누구 명의 카드"
                  value={d.holder}
                  onChange={(holder) => patch(d.key, { holder })}
                  options={(['me', 'partner'] as Holder[]).map((v) => ({
                    value: v,
                    label: HOLDER_LABEL[v],
                  }))}
                />
              )}

              <Chips<Category>
                label="분류"
                value={d.category}
                onChange={(category) => patch(d.key, { category })}
                options={CATEGORIES.map((v) => ({ value: v, label: CATEGORY_LABEL[v] }))}
              />
            </div>

            {d.category === 'excluded' && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">{EXCLUDED_HINT}</p>
            )}

            <input
              aria-label={`${i + 1}번째 줄 메모`}
              placeholder="메모 (안 적으셔도 돼요)"
              className="mt-2.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-brand focus:outline-none"
              value={d.memo}
              maxLength={120}
              onChange={(e) => patch(d.key, { memo: e.target.value })}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line-strong bg-surface py-3 text-[14px] font-semibold text-brand-strong hover:bg-brand-soft"
      >
        <Icon name="plus" size={17} />
        {drafts.length === 0 ? '쓴 돈 적기' : '한 줄 더'}
      </button>

      {drafts.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-[13px] text-ink-soft">
            {filled.length > 0 ? (
              <>
                <strong className="font-semibold text-ink">{filled.length}건</strong> ·{' '}
                <strong className="tnum font-semibold text-ink">{formatKRW(total)}</strong>
              </>
            ) : (
              '금액을 적어주세요'
            )}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={filled.length === 0}
            className={
              'shrink-0 rounded-[8px] px-5 py-2.5 text-[14px] font-semibold transition-colors ' +
              (filled.length > 0
                ? 'bg-brand-strong text-white hover:bg-brand-deep'
                : 'cursor-not-allowed bg-sunk text-ink-faint')
            }
          >
            저장하기
          </button>
        </div>
      )}

      {failed && (
        <p className="mt-2.5 rounded-[8px] bg-alert-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-alert">
          저장하지 못했어요. 브라우저 저장 공간이 꽉 찼을 수 있습니다. 엑셀로 내려받아 두신 뒤
          오래된 기록을 지워 주세요.
        </p>
      )}
    </section>
  );
}

export const TODAY_FALLBACK = toISODate(new Date());
