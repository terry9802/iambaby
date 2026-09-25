'use client';

import { useCallback, useMemo, useState } from 'react';
import { formatKRW } from '@/lib/format';
import type { Tool } from '@/lib/tools';
import { BackButton } from '@/components/ui/BackButton';
import { FieldGroup, SegmentedField, SelectField } from '@/components/ui/fields';

type Band = {
  key: string;
  label: string;
  count: number;
  medianUnitPrice: number;
  medianAmount: number;
  minAmount: number;
  maxAmount: number;
};
type Deal = {
  name: string;
  area: number;
  floor: number | null;
  buildYear: number | null;
  dong: string;
  amount: number;
  monthlyRent: number;
  date: string;
  unitPrice: number;
};
type Result = {
  region: { code: string; name: string; sido: string };
  dataset: string;
  months: number;
  monthsCovered: string[];
  missingMonths: string[];
  total: number;
  byBand: Band[];
  medianUnitPrice: number;
  rent: {
    jeonse: { count: number; medianDeposit: number; medianUnitPrice: number };
    wolse: { count: number; medianDeposit: number; medianMonthlyRent: number };
  } | null;
  complex: {
    query: string;
    count: number;
    names: string[];
    medianUnitPrice: number;
    recent: Deal[];
  } | null;
};

const DATASETS = [
  { value: 'aptTrade', label: '아파트 매매' },
  { value: 'aptRent', label: '아파트 전월세' },
  { value: 'offiTrade', label: '오피스텔 매매' },
];

/** ㎡를 평으로. 사람들이 아직 평으로 생각한다. */
const pyeong = (sqm: number) => (sqm / 3.3058).toFixed(1);

export function MarketCheckTool({
  tool,
  sido,
  sigunguBySido,
  coverageNote,
  checklist,
}: {
  tool: Tool;
  sido: { code: string; name: string }[];
  sigunguBySido: Record<string, { code: string; name: string }[]>;
  coverageNote: string;
  checklist: { title: string; body: string }[];
}) {
  const [sidoCode, setSidoCode] = useState(sido[0]?.code ?? 'seoul');
  const [lawd, setLawd] = useState(sigunguBySido[sido[0]?.code ?? 'seoul']?.[0]?.code ?? '');
  const [dataset, setDataset] = useState('aptTrade');
  const [months, setMonths] = useState('6');
  const [complex, setComplex] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const sigungu = useMemo(() => sigunguBySido[sidoCode] ?? [], [sigunguBySido, sidoCode]);

  const run = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const q = new URLSearchParams({ lawd, dataset, months });
      if (complex.trim()) q.set('complex', complex.trim());
      const res = await fetch(`/api/market?${q}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? '조회에 실패했어요.');
        setState('failed');
        return;
      }
      setResult(body);
      setState('done');
    } catch {
      setError('조회에 실패했어요. 잠시 뒤에 다시 시도해 주세요.');
      setState('failed');
    }
  }, [lawd, dataset, months, complex]);

  const isRent = result?.dataset === 'aptRent';

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-5 px-4 pb-16 pt-4">
      <BackButton fallbackHref="/housing" label="내 집 마련" />

      <header className="flex flex-col gap-2.5">
        <span className="self-start rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft">
          조회기
        </span>
        <h1 className="text-[21px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
          {tool.question}
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">{tool.lead}</p>
      </header>

      {/*
        이 사이트가 하지 않는 일을 먼저 밝힌다. 적정가를 알려주는 서비스로
        오해한 채 숫자를 보면 없는 말을 읽게 된다.
      */}
      <section className="rounded-[12px] border border-line bg-sunk px-4 py-3.5">
        <p className="text-[13px] leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">얼마가 적정한 가격인지는 알려드리지 않습니다.</strong>{' '}
          그건 법이나 고시에 답이 없는 판단이라, 근거를 대며 숫자를 드리는 이 사이트가 다룰 수 있는
          문제가 아니에요. 여기서 보여드리는 건 <strong className="font-semibold text-ink">실제로
          이 가격들에 거래됐다</strong>는 사실과, 그 사실끼리의 비교뿐입니다.
        </p>
      </section>

      <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
        <FieldGroup>
          <SegmentedField<string>
            label="시 · 도"
            hint={coverageNote}
            value={sidoCode}
            onChange={(next: string) => {
              setSidoCode(next);
              setLawd(sigunguBySido[next]?.[0]?.code ?? '');
              setState('idle');
            }}
            options={sido.map((s) => ({
              value: s.code,
              label: s.name.replace(/(특별시|광역시|도)$/, ''),
            }))}
          />
          <SelectField<string>
            label="시 · 군 · 구"
            value={lawd}
            onChange={(next) => {
              setLawd(next ?? '');
              setState('idle');
            }}
            options={sigungu.map((g) => ({ value: g.code, label: g.name }))}
          />
          <SegmentedField<string>
            label="무엇을 볼까요"
            value={dataset}
            onChange={(next) => {
              setDataset(next);
              setState('idle');
            }}
            options={DATASETS}
          />
          <SegmentedField<string>
            label="기간"
            hint="거래가 적은 동네는 기간을 늘려야 표본이 쌓입니다."
            value={months}
            onChange={(next) => {
              setMonths(next);
              setState('idle');
            }}
            options={[
              { value: '3', label: '3개월' },
              { value: '6', label: '6개월' },
              { value: '12', label: '12개월' },
            ]}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="complex"
              className="text-[13.5px] font-semibold text-ink"
            >
              단지 이름 (선택)
            </label>
            <input
              id="complex"
              type="text"
              value={complex}
              onChange={(e) => setComplex(e.target.value)}
              placeholder="예: 래미안"
              className="min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
            />
            <p className="text-[12.5px] leading-relaxed text-ink-faint">
              넣으면 그 단지 거래만 따로 보여드리고, 구 전체와 견줘 드립니다. 일부만 적어도 찾아요.
            </p>
          </div>
        </FieldGroup>

        <button
          type="button"
          onClick={run}
          disabled={state === 'loading' || !lawd}
          className="mt-4 w-full rounded-[8px] bg-brand px-4 py-3 text-[14.5px] font-bold text-white disabled:opacity-50"
        >
          {state === 'loading' ? '국토교통부에서 받아오는 중…' : '실거래가 보기'}
        </button>
        {state === 'loading' && (
          <p className="mt-2 text-center text-[12.5px] text-ink-faint">
            여러 달치를 한꺼번에 받느라 십여 초 걸릴 수 있어요.
          </p>
        )}
        {state === 'failed' && (
          <p className="mt-2 text-center text-[13px] text-alert">{error}</p>
        )}
      </section>

      {state === 'done' && result && (
        <>
          <section className="rounded-[12px] border border-line bg-surface px-4 py-5">
            <p className="text-[13px] font-semibold text-ink-soft">
              {result.region.sido} {result.region.name} · 최근 {result.months}개월
            </p>
            {result.total === 0 ? (
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink">
                이 기간에 신고된 거래가 없어요. 기간을 늘리거나 다른 종류로 바꿔 보세요.
              </p>
            ) : (
              <>
                <p className="tnum mt-1.5 text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-brand">
                  {result.total.toLocaleString('ko-KR')}건
                </p>
                {result.rent && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13.5px] font-semibold text-ink">
                        전세 <span className="tnum text-[12px] font-normal text-ink-faint">
                          {result.rent.jeonse.count}건
                        </span>
                      </span>
                      <span className="tnum text-[14px] font-bold text-ink">
                        {formatKRW(result.rent.jeonse.medianDeposit)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13.5px] font-semibold text-ink">
                        월세 <span className="tnum text-[12px] font-normal text-ink-faint">
                          {result.rent.wolse.count}건
                        </span>
                      </span>
                      <span className="tnum text-[14px] font-bold text-ink">
                        보증금 {formatKRW(result.rent.wolse.medianDeposit)} / 월{' '}
                        {formatKRW(result.rent.wolse.medianMonthlyRent)}
                      </span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-ink-faint">
                      월세는 보증금이 작아 섞으면 어느 쪽도 아닌 값이 나옵니다. 아래 면적대별
                      집계는 전세만으로 냈어요.
                    </p>
                  </div>
                )}
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                  {isRent ? '전세 보증금' : '거래가'} 기준 ㎡당 중앙값{' '}
                  <strong className="tnum font-semibold text-ink">
                    {formatKRW(result.medianUnitPrice)}
                  </strong>
                  {' '}(평당 약{' '}
                  <strong className="tnum font-semibold text-ink">
                    {formatKRW(Math.round(result.medianUnitPrice * 3.3058))}
                  </strong>
                  )
                </p>
                {result.missingMonths.length > 0 && (
                  <p className="mt-2 rounded-[8px] bg-alert-soft px-3 py-2 text-[12.5px] leading-relaxed text-ink">
                    {result.missingMonths.length}개월치를 못 받았어요. 국토교통부 쪽 응답이 끊긴
                    경우라 잠시 뒤 다시 보시면 채워집니다.
                  </p>
                )}
              </>
            )}
          </section>

          {result.byBand.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[16px] font-bold text-ink">전용면적대별</h2>
              <p className="text-[13px] leading-relaxed text-ink-soft">
                같은 동네여도 평수마다 ㎡당 단가가 다릅니다. 묶어서 평균 내면 어느 평수가 많이
                거래된 달인지에 따라 값이 흔들려요.
              </p>
              <div className="flex flex-col gap-2">
                {result.byBand.map((b) => (
                  <div key={b.key} className="rounded-[12px] border border-line bg-surface px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] font-bold text-ink">{b.label}</span>
                      <span className="tnum text-[12.5px] text-ink-faint">{b.count}건</span>
                    </div>
                    <p className="tnum mt-1.5 text-[15px] font-semibold text-ink">
                      중앙값 {formatKRW(b.medianAmount)}
                    </p>
                    <p className="tnum mt-0.5 text-[12.5px] text-ink-soft">
                      ㎡당 {formatKRW(b.medianUnitPrice)} · 최저 {formatKRW(b.minAmount)} ~ 최고{' '}
                      {formatKRW(b.maxAmount)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {result.complex && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[16px] font-bold text-ink">
                &lsquo;{result.complex.query}&rsquo; 거래
              </h2>
              {result.complex.count === 0 ? (
                <p className="rounded-[12px] border border-line bg-surface px-4 py-4 text-[13.5px] leading-relaxed text-ink-soft">
                  이 기간에 이 이름으로 신고된 거래가 없어요. 이름을 짧게 넣거나 기간을 늘려
                  보세요.
                </p>
              ) : (
                <>
                  <div className="rounded-[12px] border border-line bg-surface px-4 py-4">
                    <p className="text-[13px] text-ink-soft">
                      {result.complex.count}건 · {result.complex.names.join(', ')}
                    </p>
                    <p className="tnum mt-1.5 text-[15px] font-semibold text-ink">
                      ㎡당 중앙값 {formatKRW(result.complex.medianUnitPrice)}
                    </p>
                    {/*
                      비교는 사실끼리만 한다. 몇 퍼센트 높다·낮다까지가 사실이고,
                      그래서 싸다·비싸다는 읽는 사람이 판단할 몫이다.
                    */}
                    {result.medianUnitPrice > 0 && (
                      <p className="mt-2 rounded-[8px] bg-sunk px-3 py-2.5 text-[13px] leading-relaxed text-ink">
                        {result.region.name} 전체 ㎡당 중앙값(
                        {formatKRW(result.medianUnitPrice)})보다{' '}
                        <strong className="tnum font-bold text-ink">
                          {Math.abs(
                            Math.round(
                              (result.complex.medianUnitPrice / result.medianUnitPrice - 1) * 1000,
                            ) / 10,
                          ).toFixed(1)}
                          %
                        </strong>{' '}
                        {result.complex.medianUnitPrice >= result.medianUnitPrice
                          ? '높습니다'
                          : '낮습니다'}
                        . 연식·역세권·학군이 다르면 차이가 나는 게 당연해서, 이 숫자만으로 좋고
                        나쁨을 가를 수는 없어요.
                      </p>
                    )}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {result.complex.recent.map((d, i) => (
                      <li
                        key={`${d.name}-${d.date}-${d.floor}-${i}`}
                        className="rounded-[12px] border border-line bg-surface px-4 py-3"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[13.5px] font-semibold text-ink">{d.name}</span>
                          <span className="tnum text-[12px] text-ink-faint">{d.date}</span>
                        </div>
                        <p className="tnum mt-1 text-[14.5px] font-bold text-ink">
                          {formatKRW(d.amount)}
                          {d.monthlyRent > 0 && (
                            <span className="text-[13px] font-semibold text-ink-soft">
                              {' '}/ 월 {formatKRW(d.monthlyRent)}
                            </span>
                          )}
                        </p>
                        <p className="tnum mt-0.5 text-[12.5px] text-ink-soft">
                          {d.dong} · 전용 {d.area}㎡ ({pyeong(d.area)}평)
                          {d.floor !== null && ` · ${d.floor}층`}
                          {d.buildYear !== null && ` · ${d.buildYear}년식`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          <section className="rounded-[12px] border border-alert/25 bg-alert-soft px-4 py-4">
            <h2 className="text-[13.5px] font-semibold text-alert">숫자만 보고 가면 놓치는 것</h2>
            <ul className="mt-2.5 flex flex-col gap-3">
              {checklist.map((c) => (
                <li key={c.title} className="rounded-[8px] bg-surface px-3 py-2.5">
                  <p className="text-[13.5px] font-semibold text-ink">{c.title}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{c.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-[12px] leading-relaxed text-ink-faint">
            국토교통부 실거래가 공개시스템 자료입니다. 계약이 해제된 거래는 빼고 셌어요. 신고
            기한이 계약일로부터 30일이라 최근 한두 달치는 아직 덜 쌓여 있을 수 있습니다.
          </p>
        </>
      )}
    </div>
  );
}
