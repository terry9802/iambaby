import type { Entry } from './schema';

/**
 * 달마다 얼마 썼는지 세는 자리.
 *
 * 연말정산 코칭(ledger-summary)과 세는 대상이 다르다. 저쪽은 세금 계산에 들어가는
 * 몫만 세고 올해 것만 본다. 여기는 지갑에서 나간 돈을 전부, 적어 두신 모든 해를 센다.
 *
 * 둘을 일부러 다르게 둔다. "내가 얼마 썼나"와 "세금이 얼마나 줄었나"는 다른 질문이고,
 * 한 숫자로 합치면 목록을 눈으로 더한 값과 화면 숫자가 안 맞는다. 사장님이 전에
 * 그 차이로 헷갈려 하셔서, 화면에서도 이름을 다르게 적는다.
 */

export type Bucket = {
  /** YYYY-MM */
  month: string;
  /** 화면에 적을 이름. 해가 여럿이면 '25년 9월', 한 해뿐이면 '9월' */
  label: string;
  /** 짧은 이름. 막대 밑에 들어간다 */
  short: string;
  all: number;
  personal: number;
  couple: number;
  count: number;
};

export type Totals = { all: number; personal: number; couple: number; count: number };

export function totalsOf(entries: Entry[]): Totals {
  let all = 0;
  let personal = 0;
  let couple = 0;
  for (const e of entries) {
    all += e.amount;
    if (e.purse === 'group') couple += e.amount;
    else personal += e.amount;
  }
  return { all, personal, couple, count: entries.length };
}

function monthOf(date: string): string {
  return date.slice(0, 7);
}

/**
 * 달 이름. 해가 여럿 섞일 때만 연도를 붙인다.
 *
 * 기록이 없는 달도 이름이 필요하다. 집계에 안 잡힌 달을 고르셨을 때 화면이
 * 'undefined 모두'라고 적으면 안 되기 때문에, 집계와 따로 부를 수 있게 둔다.
 */
export function monthLabel(month: string, withYear: boolean): string {
  const m = Number(month.slice(5, 7));
  return withYear ? `${month.slice(2, 4)}년 ${m}월` : `${m}월`;
}

const labelFor = monthLabel;

/** 다음 달로 한 칸. '2026-12' → '2027-01' */
export function nextMonth(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 12
    ? `${y + 1}-01`
    : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * 기록이 있는 달만, 최근 달부터.
 *
 * 탭에 쓴다. 쓴 게 없는 달까지 탭으로 만들면 누를 거리가 없는 탭이 생긴다.
 */
export function monthBuckets(entries: Entry[]): Bucket[] {
  const byMonth = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = monthOf(e.date);
    const had = byMonth.get(key);
    if (had) had.push(e);
    else byMonth.set(key, [e]);
  }
  const months = [...byMonth.keys()].sort().reverse();
  const withYear = new Set(months.map((m) => m.slice(0, 4))).size > 1;
  return months.map((month) => ({
    month,
    label: labelFor(month, withYear),
    short: labelFor(month, false),
    ...totalsOf(byMonth.get(month) ?? []),
  }));
}

/**
 * 막대로 그릴 줄. 빈 달도 0으로 채워서 앞뒤로 이어 둔다.
 *
 * 비어 있는 달을 빼면 3월 막대 옆에 9월 막대가 붙어서, 안 쓴 달이 아예 없었던
 * 것처럼 읽힌다. 시간 순으로 그리는 그림은 빈 칸도 그려야 맞다.
 *
 * @param span 최근 몇 달까지 그릴지. 너무 길면 막대가 실처럼 얇아진다.
 */
export function monthSeries(entries: Entry[], asOf: string, span = 12): Bucket[] {
  if (entries.length === 0) return [];
  const buckets = new Map(monthBuckets(entries).map((b) => [b.month, b]));
  const last = monthOf(asOf);
  const earliest = [...buckets.keys()].sort()[0]!;

  /*
    끝은 오늘이 든 달로 둔다. 기록이 지난달에서 끊겼어도 이번 달 자리를 비워
    보여 줘야 "이번 달엔 아직 안 적었구나"가 보인다. 다만 앞으로 적어 둔 줄이
    있으면(미래 날짜) 그쪽을 끝으로 삼는다.
  */
  const latestEntry = [...buckets.keys()].sort().at(-1)!;
  const end = latestEntry > last ? latestEntry : last;

  const months: string[] = [];
  for (let m = earliest; m <= end; m = nextMonth(m)) {
    months.push(m);
    // 터무니없이 오래된 기록이 섞여도 멈춘다
    if (months.length > 600) break;
  }

  const withYear = new Set(months.map((m) => m.slice(0, 4))).size > 1;
  return months.slice(-span).map(
    (month) =>
      buckets.get(month) ?? {
        month,
        label: labelFor(month, withYear),
        short: labelFor(month, false),
        all: 0,
        personal: 0,
        couple: 0,
        count: 0,
      },
  );
}

/** 돈을 쓴 달만 세서 낸 평균. 안 쓴 달을 섞으면 평균이 실제보다 낮게 나온다. */
export function averagePerActiveMonth(entries: Entry[]): number {
  const months = monthBuckets(entries).filter((b) => b.all > 0);
  if (months.length === 0) return 0;
  return months.reduce((sum, b) => sum + b.all, 0) / months.length;
}
