'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  compareCoupleStrategies,
  summarizeLedger,
  type CoupleComparison,
} from '@/lib/calculators/ledger-summary';
import { formatKRW, toISODate } from '@/lib/format';
import { LedgerProvider, useLedger } from '@/lib/ledger/context';
import {
  CATEGORY_LABEL,
  holderLabel,
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
  const { entries, hydrated: ledgerReady, add, update, remove, replaceAll, reset } = useLedger();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const today = hydrated ? toISODate(new Date()) : fallbackToday;
  /*
    같이 쓰는 사람이 있는지는 혼인신고로 따지지 않는다. 예비부부도 커플통장으로
    데이트비를 쓰고, 그 돈이 누구 카드에서 나갔는지가 공제를 가른다.
    프로필에 배우자(예비 배우자) 소득이나 혼인신고일이 적혀 있으면 둘이 있는
    것으로 본다. 처음에 '기혼'으로만 묶어 뒀다가 예비부부에게 지갑 칸이
    아예 안 보이는 일이 있었다.
  */
  const married = hydrated && profile.maritalStatus === 'married';
  const hasPartner =
    hydrated &&
    (married ||
      !!profile.marriageDate ||
      (profile.spouse?.annualSalary ?? 0) > 0 ||
      (profile.spouse?.monthlyWage ?? 0) > 0);
  const mySalary = profile.income?.annualSalary ?? 0;
  /*
    혼인신고 전이어도 상대는 자기 소득에서 자기 카드로 공제받는다. 그래서
    합산(기혼 + 배우자 저소득) 여부와 상관없이 상대 몫은 따로 세어 준다.
  */
  const partnerSalary = hasPartner ? (profile.spouse?.annualSalary ?? 0) : 0;

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

  /*
    목록 옆에 보여 줄 합계. 올해 것만 세는 코칭과 달리 적어 둔 것 전부를 센다.
    눈앞에 보이는 줄의 합이라 그래야 눈으로 더해 본 것과 맞는다.
  */
  const totals = useMemo(
    () => ({
      all: entries.reduce((sum, e) => sum + e.amount, 0),
      personal: entries.filter((e) => e.purse === 'personal').reduce((sum, e) => sum + e.amount, 0),
      couple: entries.filter((e) => e.purse === 'couple').reduce((sum, e) => sum + e.amount, 0),
    }),
    [entries],
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

          <QuickAdd today={today} hasPartner={hasPartner} married={married} onAdd={add} />

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold text-ink">적어 둔 기록</h2>
              <span className="tnum text-[12.5px] text-ink-faint">{entries.length}건</span>
            </div>

            {/*
              얼마나 썼는지 보려고 들어오는 자리인데 그동안 건수만 적혀 있었다.
              총액과 개인·데이트 나눔을 바로 옆에 둔다.
            */}
            {entries.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 rounded-[8px] bg-sunk px-3.5 py-2.5">
                <Tally label="모두" amount={totals.all} strong />
                <Tally label="개인 생활비" amount={totals.personal} />
                <Tally label="커플 데이트비" amount={totals.couple} />
              </div>
            )}

            {entries.length === 0 ? (
              <p className="mt-2.5 rounded-[8px] bg-sunk px-3 py-3 text-[12.5px] leading-relaxed text-ink-soft">
                아직 없어요. 위에서 한 줄 적어 보세요. 커피 한 잔부터 적으셔도 됩니다.
              </p>
            ) : (
              <>
                <ul className="mt-2.5 flex flex-col divide-y divide-line">
                  {visible.map((e) => (
                    <Row
                      key={e.id}
                      entry={e}
                      hasPartner={hasPartner}
                      married={married}
                      onTogglePurse={() =>
                        update(e.id, { purse: e.purse === 'couple' ? 'personal' : 'couple' })
                      }
                      onRemove={() => remove(e.id)}
                    />
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
  hasPartner,
  married,
  onTogglePurse,
  onRemove,
}: {
  entry: Entry;
  hasPartner: boolean;
  married: boolean;
  onTogglePurse: () => void;
  onRemove: () => void;
}) {
  const couple = entry.purse === 'couple';
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="tnum text-[12px] text-ink-faint">{entry.date.slice(5)}</span>
          <span className="tnum text-[15px] font-bold text-ink">{formatKRW(entry.amount)}</span>
        </div>
        {/*
          지갑만 누르면 바로 바뀐다. 쓰시던 엑셀에는 데이트비 구분이 없어서
          가져오면 전부 개인 생활비로 들어온다. 그걸 고치러 줄마다 편집 화면을
          열게 하면 열일곱 줄에 서른네 번을 누르셔야 한다. 한 번이면 된다.
        */}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[12px] text-ink-soft">
          <button
            type="button"
            onClick={onTogglePurse}
            aria-label={`${formatKRW(entry.amount)} — ${couple ? '개인 생활비로' : '커플 데이트비로'} 바꾸기`}
            className={
              'rounded-full border px-2 py-0.5 text-[11.5px] font-medium transition-colors ' +
              (couple
                ? 'border-brand-strong bg-brand-strong text-white'
                : 'border-line bg-surface text-ink-soft hover:border-line-strong')
            }
          >
            {PURSE_LABEL[entry.purse]}
          </button>
          <span>·</span>
          {METHOD_LABEL[entry.method]}
          {(hasPartner || entry.purse === 'couple') && ` · ${holderLabel(entry.holder, married)}`}
          {entry.spend && ` · ${entry.spend}`}
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

/**
 * 코칭 카드.
 *
 * 쓰는 분이 알아야 할 건 세 가지고, 그 순서대로 둔다.
 *  1) 지금 어떤 카드를 꺼내야 하나   ← 제일 중요하다. 그래서 맨 위에 제일 크게.
 *  2) 내가 얼마 썼고, 얼마부터 혜택이 시작되나
 *  3) 지금까지 얼마나 돌려받게 되나
 *
 * 말은 쉽게 쓴다. '문턱', '공제', '최저사용금액'은 법에서 쓰는 말이지 사람이
 * 쓰는 말이 아니다. 처음엔 그 말을 그대로 썼다가 사장님께 어렵다고 들었다.
 */
function Coach({
  summary,
  year,
}: {
  summary: NonNullable<ReturnType<typeof summarizeLedger>>;
  year: string;
}) {
  /* 많이 쓰는 사람을 앞에 둔다. 적게 쓰는 사람 얘기가 먼저 나오면 헷갈린다. */
  const people = [...summary.holders].sort((a, b) => b.spent - a.spent);

  return (
    <section className="flex flex-col gap-4 rounded-[12px] border border-line-strong bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(20,22,26,0.04)]">
      <div className="flex flex-col gap-2.5">
        <p className="text-[13px] font-medium text-ink-soft">지금 쓰면 좋은 카드</p>
        {people.map((h) => (
          <div key={h.holder} className="rounded-[10px] bg-brand-soft px-4 py-3.5">
            {summary.holders.length > 1 && (
              <p className="text-[12px] font-semibold text-ink-soft">{h.label}</p>
            )}
            <p className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-brand">
              {h.nowUse === 'credit' ? '신용카드' : '체크카드 · 현금영수증'}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{h.nowWhy}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-3.5">
        <p className="text-[13px] font-medium text-ink-soft">얼마부터 세금이 줄어드나</p>
        {people.map((h) => (
          <div key={h.holder}>
            <div className="flex items-baseline justify-between gap-3">
              {/*
                그냥 '쓴 돈'이라고 하면 목록 합계(전액)와 숫자가 달라서 헷갈린다.
                여기 적히는 건 세금 계산에 들어가는 몫만이라, 그걸 이름에 밝힌다.
              */}
              <p className="text-[13px] text-ink">
                {summary.holders.length > 1 && <span className="font-semibold">{h.label} </span>}
                세금 계산에 들어간 돈
              </p>
              <p className="tnum text-[14px] font-bold text-ink">{formatKRW(h.spent)}</p>
            </div>
            <Bar spent={h.spent} threshold={h.threshold} />
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
              {h.toThreshold > 0 ? (
                <>
                  <strong className="tnum font-semibold text-ink">
                    {formatKRW(Math.round(h.threshold))}
                  </strong>
                  부터 세금이 줄기 시작해요. 아직{' '}
                  <strong className="tnum font-semibold text-ink">
                    {formatKRW(Math.round(h.toThreshold))}
                  </strong>{' '}
                  남았습니다.
                </>
              ) : (
                <>
                  <strong className="tnum font-semibold text-ink">
                    {formatKRW(Math.round(h.threshold))}
                  </strong>
                  을 넘기셔서, 지금 쓰는 돈부터 세금이 줄어듭니다.
                </>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3.5">
        <div>
          <p className="text-[13px] font-medium text-ink-soft">지금까지 돌려받을 세금</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">
            {year}년에 적어 두신 {summary.entryCount}건만으로 셉니다
          </p>
        </div>
        <p className="tnum shrink-0 text-[22px] font-bold tracking-[-0.02em] text-brand">
          {formatKRW(Math.round(summary.totalTaxSaved))}
        </p>
      </div>

      {summary.totalExcluded > 0 && (
        <p className="rounded-[8px] bg-sunk px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">
            세금이랑 상관없는 돈이 {formatKRW(summary.totalExcluded)} 있어요.
          </strong>{' '}
          계좌이체·월세·통신비·저축처럼 카드로 긁지 않았거나 법에서 빼 둔 것들입니다. 이 돈은 아무리
          써도 연말정산에는 도움이 안 돼요. 그래서 위 금액에서 빼고 셌습니다.
        </p>
      )}
    </section>
  );
}

/** 세금이 줄기 시작하는 금액까지 얼마나 왔는지. 숫자보다 길이가 먼저 읽힌다. */
function Bar({ spent, threshold }: { spent: number; threshold: number }) {
  const ratio = threshold > 0 ? Math.min(1, spent / threshold) : 0;
  return (
    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-band">
      <div
        className="h-full rounded-full bg-brand transition-[width]"
        style={{ width: `${ratio * 100}%` }}
      />
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

/** 목록 옆 합계 한 칸 */
function Tally({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <p className="text-[12px] leading-snug">
      <span className="text-ink-faint">{label} </span>
      <span className={'tnum ' + (strong ? 'font-bold text-ink' : 'font-semibold text-ink-soft')}>
        {formatKRW(amount)}
      </span>
    </p>
  );
}
