import { describe, expect, it } from 'vitest';
import { isStale, loadRule, fallbackWarning, STALE_AFTER_MONTHS } from '@/lib/rules/loader';
import type { RuleMeta } from '@/lib/rules/types';

describe('룰 로더', () => {
  it('이벤트 날짜가 룰의 유효기간 안에 있으면 그 룰을 고른다', () => {
    const found = loadRule('parental-leave', '2026-05-01');
    expect(found.fallback).toBe(false);
    expect(found.rule.meta.ruleId).toBe('parental-leave');
  });

  it('수집된 룰보다 이른 날짜는 가장 오래된 룰로 대체하고 그 사실을 알린다', () => {
    const found = loadRule('parental-leave', '2019-01-01');
    expect(found.fallback).toBe(true);
    expect(fallbackWarning(found)[0]).toContain('이전이라');
  });

  it('유효기간에 걸리면 대체 경고를 만들지 않는다', () => {
    const found = loadRule('parental-leave', '2026-05-01');
    expect(fallbackWarning(found)).toEqual([]);
  });

  it(`verifiedAt이 ${STALE_AFTER_MONTHS}개월을 넘기면 확인 필요로 본다`, () => {
    const meta = { verifiedAt: '2026-01-01' } as RuleMeta;
    expect(isStale(meta, new Date(2026, 5, 30))).toBe(false); // 6개월 이내
    expect(isStale(meta, new Date(2026, 6, 2))).toBe(true);   // 6개월 초과
  });

  it('모든 룰 파일이 출처·검증일·유효 시작일을 갖춘다', () => {
    const ids = [
      'parental-leave',
      'parental-leave-couple',
      'maternity-leave',
      'birth-grants-national',
      'birth-grants-seoul',
    ] as const;
    for (const id of ids) {
      const meta = loadRule(id, '2026-05-01').rule.meta;
      expect(meta.source, id).toBeTruthy();
      expect(meta.sourceUrl, id).toMatch(/^https:\/\//);
      expect(meta.verifiedAt, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(meta.verifiedBy, id).toBeTruthy();
      expect(meta.effectiveFrom, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
