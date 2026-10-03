'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  compareCoupleStrategies,
  summarizeLedger,
  type CoupleComparison,
} from '@/lib/calculators/ledger-summary';
import { formatKRW, formatManwon, toISODate } from '@/lib/format';
import { LedgerProvider, useLedger } from '@/lib/ledger/context';
import {
  CATEGORY_LABEL,
  HOLDER_LABEL,
  METHOD_LABEL,
  PURSE_LABEL,
  type Entry,
} from '@/lib/ledger/schema';
import { useProfile } from '@/lib/profile/context';
import { findEvent, type Tool } from '@/lib/tools';
import { BackButton } from '@/components/ui/BackButton';
import { Icon } from '@/components/ui/Icon';
import { InlineText } from '@/components/ui/InlineText';
import { LedgerShare } from '@/components/ledger/LedgerShare';
import { QuickAdd } from '@/components/ledger/QuickAdd';

/**
 * 가계부 본체.
 *
 * 카드 배분 계산기가 "한 해에 이만큼 쓸 건데 어떻게 나눌까"를 미리 묻는다면,
 * 이쪽은 "지금까지 이렇게 썼는데 남은 기간엔 뭘 써야 하나"를 묻는다.
 * 계획은 어차피 틀어지므로, 실제로 쓴 돈을 보고 다시 말해 주는 쪽이 쓸모 있다.
 *
 * 계산기 공통 껍데기(CalcShell)를 쓰지 않는다. 저 껍데기는 "값을 넣으면 답이
 * 하나 나온다"는 모양인데, 가계부는 적는 일이 주고 답은 곁들이라 결이 다르다.
 */
/*
  가계부 저장소는 이 화면에서만 쓴다. 뿌리 레이아웃에 두면 사이트의 모든 쪽에서
  쓰지도 않을 기록을 읽어 오게 되므로, 필요한 자리에서만 감싼다.
*/
export function LedgerTool(props: { tool: Tool; fallbackToday: string }) {
  return (
    <LedgerProvider>
      <LedgerBody {...props} />
    </LedgerProvider>
  );
}

function LedgerBody({ tool, fallbackToday }: { tool: Tool; fallbackToday: string }) {
  const { profile, hydrated } = useProfile();
  const { entries, hydrated: ledgerReady, add, remove, replaceAll, reset } = useLedger();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const today = hydrated ? toISODate(new Date()) : fallbackToday;
  const married = hydrated && profile.maritalStatus === 'married';
  const mySalary = profile.income?.annualSalary ?? 0;
  const partnerSalary = married ? (profile.spouse?.annualSalary ?? 0) : 0;

  /*
    올해 쓴 것만 센다. 연말정산은 한 해 단위라 작년 줄을 섞으면 답이 틀어진다.
    작년 기록은 지우지 않고 그대로 두되, 계산에서만 뺀다.
  */
  const year = today.slice(0, 4);
  const thisYear = useMemo(() => entries.filter((e) => e.date.startsWith(year)), [entries, year]);

  const summary = useMemo(
    () =>
      mySalary > 0
        ? summarizeLedger({
            entries: thisYear,
            mySalary,
            partnerSalary,
            partnerLabel: '배우자',
            asOf: today,
          })
        : null,
    [thisYear, mySalary, partnerSalary, today],
  );

  const couple = useMemo(
    () =>
      mySalary > 0
        ? compareCoupleStrategies({
            entries: thisYear,
            mySalary,
            partnerSalary,
            asOf: today,
          })
        : null,
    [thisYear, mySalary, partnerSalary, today],
  );

  const visible = showAll ? entries : entries.slice(0, 20);

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-4 px-4 pb-16 pt-4">
      <BackButton fallbackHref={`/${tool.event}`} label={findEvent(tool.event)?.title ?? '뒤로'} />

      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft">
          가계부
        </span>
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
          {tool.question}
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">{tool.lead}</p>
      </header>

      {!ledgerReady ? (
        <div className="h-48 rounded-[12px] border border-line bg-surface" aria-hidden />
      ) : (
        <>
          {summary && summary.entryCount > 0 && <Coach summary={summary} year={year} />}
          {couple && <CoupleCompare couple={couple} />}

          {mySalary <= 0 && entries.length > 0 && (
            <p className="rounded-[12px] border border-line bg-brand-soft px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-soft">
              <strong className="font-semibold text-ink">연봉을 적어주시면</strong> 지금까지 쓰신
              금액으로 연말정산이 어떻게 되고 있는지 세어 드려요.{' '}
              <Link
                href="/me"
                className="font-semibold text-brand-strong underline underline-offset-2"
              >
                내 프로필
              </Link>
              에서 한 번만 적어두시면 됩니다.
            </p>
          )}

          <QuickAdd today={today} married={married} onAdd={add} />

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold text-ink">적어 둔 기록</h2>
              <span className="tnum text-[12.5px] text-ink-faint">{entries.length}건</span>
            </div>

            {entries.length === 0 ? (
              <p className="mt-2.5 rounded-[8px] bg-sunk px-3 py-3 text-[12.5px] leading-relaxed text-ink-soft">
                아직 없어요. 위에서 한 줄 적어 보세요. 커피 한 잔부터 적으셔도 됩니다.
              </p>
            ) : (
              <>
                <ul className="mt-2.5 flex flex-col divide-y divide-line">
                  {visible.map((e) => (
                    <Row key={e.id} entry={e} married={married} onRemove={() => remove(e.id)} />
                  ))}
                </ul>
                {entries.length > visible.length && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="mt-3 w-full rounded-[8px] border border-line bg-surface py-2.5 text-[13px] font-medium text-ink-soft hover:border-line-strong"
                  >
                    나머지 {entries.length - visible.length}건 더 보기
                  </button>
                )}
              </>
            )}
          </section>

          <LedgerShare
            entries={entries}
            today={today}
            partnerLabel={married ? '배우자' : '상대방'}
            onMerge={replaceAll}
          />

          <section className="rounded-[12px] border border-line bg-sunk px-4 py-4">
            <h2 className="text-[13px] font-semibold text-ink">이 기록은 어디에 저장되나요</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
              적으신 금액은 지금 쓰고 계신 <strong>이 브라우저 안에만</strong> 저장돼요. 서버로
              보내는 코드가 아예 없어서 저희도 볼 수 없습니다. 대신 브라우저 기록을 지우면 함께
              사라지니, 가끔 엑셀로 받아 두시는 걸 권해요.
            </p>
            {confirmReset ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-[8px] bg-brand px-3 py-2 text-[13px] font-semibold text-white"
                  onClick={() => {
                    reset();
                    setConfirmReset(false);
                  }}
                >
                  정말 지울게요
                </button>
                <button
                  type="button"
                  className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink-soft"
                  onClick={() => setConfirmReset(false)}
                >
                  그만두기
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-3 rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink-soft hover:border-line-strong"
                onClick={() => setConfirmReset(true)}
                disabled={entries.length === 0}
              >
                기록 전부 지우기
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Row({
  entry,
  married,
  onRemove,
}: {
  entry: Entry;
  married: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="tnum text-[12px] text-ink-faint">{entry.date.slice(5)}</span>
          <span className="tnum text-[15px] font-bold text-ink">{formatKRW(entry.amount)}</span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-ink-soft">
          {married && `${PURSE_LABEL[entry.purse]} · `}
          {METHOD_LABEL[entry.method]}
          {married && ` · ${HOLDER_LABEL[entry.holder]}`}
          {entry.category !== 'general' && ` · ${CATEGORY_LABEL[entry.category]}`}
          {entry.memo && ` · ${entry.memo}`}
          {entry.source && ` · ${entry.source}`}
        </p>
      </div>
      <button
        type="button"
        aria-label={`${entry.date} ${formatKRW(entry.amount)} 지우기`}
        className="shrink-0 rounded-[8px] border border-line bg-surface p-2 text-ink-faint hover:border-line-strong"
        onClick={onRemove}
      >
        <Icon name="trash" size={14} />
      </button>
    </li>
  );
}

function Coach({
  summary,
  year,
}: {
  summary: NonNullable<ReturnType<typeof summarizeLedger>>;
  year: string;
}) {
  return (
    <section className="flex flex-col gap-3.5 rounded-[12px] border border-line-strong bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(20,22,26,0.04)]">
      <div>
        <p className="text-[13px] font-medium text-ink-soft">
          {year}년에 적어 두신 것으로 지금까지 줄어든 세금
        </p>
        <p className="tnum text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-brand">
          {formatKRW(Math.round(summary.totalTaxSaved))}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          여기 적어 두신 {summary.entryCount}건만으로 셉니다. 1월부터 다 적지 않으셨으면 실제보다
          적게 나와요.
        </p>
      </div>

      {summary.holders.map((h) => (
        <div key={h.holder} className="rounded-[10px] bg-sunk px-3.5 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-bold text-ink">{h.label}</p>
            <p className="tnum text-[12px] text-ink-faint">
              쓴 돈 {formatManwon(h.spent)} · 공제 {formatManwon(h.deduction)}
            </p>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{h.advice}</p>
          <Bar
            spent={h.spent}
            threshold={h.threshold}
            label={
              h.toThreshold > 0
                ? `문턱 ${formatManwon(h.threshold)}`
                : `문턱 ${formatManwon(h.threshold)} 넘김`
            }
          />
        </div>
      ))}

      {summary.totalExcluded > 0 && (
        <p className="border-t border-line pt-3 text-[12.5px] leading-relaxed text-ink-soft">
          공제가 안 되는 지출로 적어 두신 금액이{' '}
          <strong className="tnum font-semibold text-ink">
            {formatKRW(summary.totalExcluded)}
          </strong>{' '}
          있어요. 문턱을 세는 데는 안 들어갑니다.
        </p>
      )}
    </section>
  );
}

/** 문턱까지 얼마나 왔는지 한 줄로. 숫자보다 길이가 먼저 읽힌다. */
function Bar({ spent, threshold, label }: { spent: number; threshold: number; label: string }) {
  const ratio = threshold > 0 ? Math.min(1, spent / threshold) : 0;
  return (
    <div className="mt-2.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-band">
        <div
          className="h-full rounded-full bg-brand transition-[width]"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="tnum mt-1 text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}

/**
 * 커플 데이트비를 한 사람 신용카드로 몰아 쓰는 게 이득인지 보여 주는 자리.
 *
 * 먼저 짚어야 할 것이 있다. 커플통장에서 카드값을 갚는 건 연말정산과 상관이 없다.
 * 공제는 '무엇으로 긁었나'와 '누구 명의인가'로만 갈린다. 이걸 모르고 통장을
 * 나눠 두면 공제가 나뉘는 줄 아시는 분이 많아서, 숫자보다 이 말을 먼저 적는다.
 */
function CoupleCompare({ couple }: { couple: CoupleComparison }) {
  const max = Math.max(...couple.scenarios.map((s) => s.taxSaved), 1);
  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface px-4 py-4">
      <div>
        <h2 className="text-[15px] font-bold text-ink">데이트비를 신용카드로 몰면 이득일까요</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          커플 데이트비{' '}
          <strong className="tnum font-semibold text-ink">{formatKRW(couple.coupleSpent)}</strong>
          {couple.coupleOnCredit > 0 && (
            <>
              {' '}
              중{' '}
              <strong className="tnum font-semibold text-ink">
                {formatKRW(couple.coupleOnCredit)}
              </strong>
              을 신용카드로 긁으셨어요.
            </>
          )}
        </p>
      </div>

      <p className="rounded-[8px] bg-brand-soft px-3.5 py-3 text-[13px] leading-relaxed text-ink">
        <InlineText text={couple.verdict} />
      </p>

      <ul className="flex flex-col gap-2.5">
        {couple.scenarios.map((s) => {
          const best = s.key === couple.best.key;
          return (
            <li key={s.key}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] text-ink">
                  {s.label}
                  {s.key === 'asRecorded' && (
                    <span className="ml-1.5 text-[11.5px] text-ink-faint">지금</span>
                  )}
                </p>
                <p
                  className={
                    'tnum shrink-0 text-[13.5px] font-bold ' + (best ? 'text-brand' : 'text-ink')
                  }
                >
                  {formatKRW(Math.round(s.taxSaved))}
                </p>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-band">
                <div
                  className={'h-full rounded-full ' + (best ? 'bg-brand' : 'bg-line-strong')}
                  style={{ width: `${(s.taxSaved / max) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[11.5px] text-ink-faint">{s.note}</p>
            </li>
          );
        })}
      </ul>

      <p className="rounded-[8px] bg-sunk px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
        <strong className="font-semibold text-ink">통장은 공제와 상관이 없습니다.</strong>{' '}
        커플통장에서 카드값을 갚든 내 통장에서 갚든 공제는 똑같아요. 공제는 어느 통장에서 돈이
        나갔는지가 아니라, 무엇으로 긁었고 누구 명의 카드였는지로만 갈립니다. 그래서 한 사람 카드로
        몰면 그 사람 한 명에게만 공제가 붙고, 한도도 그 한 사람 몫만 씁니다.
      </p>
    </section>
  );
}
