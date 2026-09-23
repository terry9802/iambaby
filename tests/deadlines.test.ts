import { describe, expect, it } from 'vitest';
import {
  findDeadline,
  listDeadlines,
  shareTextFor,
  statusOf,
  urgentDeadlines,
} from '@/lib/calculators/deadlines';

describe('마감 임박 캠페인', () => {
  it('마감일까지 남은 날을 센다', () => {
    const d = findDeadline('gyeonggi-sanhujoribi');
    if (!d) throw new Error('캠페인을 못 찾음');
    expect(statusOf(d, '2026-09-23').dDay).toBe(7);
    expect(statusOf(d, '2026-09-30').dDay).toBe(0);
  });

  it('마감이 지나면 급한 목록에서 빠진다', () => {
    // 사이트맵과 홈 띠가 이 목록을 쓴다. 끝난 지원이 남아 있으면 헛걸음을 만든다.
    expect(urgentDeadlines('2026-09-23').length).toBeGreaterThan(0);
    expect(urgentDeadlines('2026-10-01').length).toBe(0);

    const d = findDeadline('gyeonggi-sanhujoribi');
    if (!d) throw new Error('캠페인을 못 찾음');
    expect(statusOf(d, '2026-10-01').passed).toBe(true);
  });

  it('아직 먼 마감은 띄우지 않는다', () => {
    const d = findDeadline('gyeonggi-sanhujoribi');
    if (!d) throw new Error('캠페인을 못 찾음');
    // 45일보다 멀면 급하지 않다. 매번 띄우면 띠가 배경이 된다.
    expect(statusOf(d, '2026-07-01').urgent).toBe(false);
    expect(statusOf(d, '2026-09-01').urgent).toBe(true);
  });

  it('남은 날에 따라 공유 문구가 달라진다', () => {
    const d = findDeadline('gyeonggi-sanhujoribi');
    if (!d) throw new Error('캠페인을 못 찾음');
    expect(shareTextFor(statusOf(d, '2026-09-23'))).toContain('7일 남았습니다');
    expect(shareTextFor(statusOf(d, '2026-09-30'))).toContain('오늘이 마지막 날');
    expect(shareTextFor(statusOf(d, '2026-10-05'))).toContain('마감됐어요');
  });

  it('캠페인마다 출처와 확인 날짜가 붙어 있다', () => {
    for (const d of listDeadlines()) {
      expect(d.verifiedAt, d.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.verifiedBy.length, d.slug).toBeGreaterThan(10);
      expect(d.applyUrl, d.slug).toMatch(/^https:\/\//);
      // 마감일만 있고 얼마인지 없으면 클릭할 이유가 없다.
      expect(d.amount, d.slug).toBeGreaterThan(0);
    }
  });
});
