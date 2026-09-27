import { describe, expect, it } from 'vitest';
import regionCodes from '@/rules/2026/region-codes.json';
import {
  AREA_BANDS,
  bandOf,
  filterByBand,
  median,
  summarizeByBand,
  summarizeByComplex,
  type Deal,
} from '@/lib/market/summary';

const deal = (area: number, amount: number, name = '가나아파트'): Deal => ({
  name,
  area,
  floor: 5,
  buildYear: 2010,
  dong: '어느동',
  amount,
  monthlyRent: 0,
  date: '2026-07-01',
  unitPrice: Math.round(amount / area),
});

describe('실거래가 집계', () => {
  it('중앙값은 짝수 개일 때 가운데 둘의 평균이다', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3); // (2+3)/2 = 2.5 → 반올림 3
    expect(median([])).toBe(0);
  });

  it('평균이 아니라 중앙값을 쓴다', () => {
    // 한 건의 특수관계 거래가 평균을 통째로 끌어올리는 일을 막는다.
    const deals = [deal(84, 5e8), deal(84, 5.2e8), deal(84, 5.1e8), deal(84, 50e8)];
    const band = summarizeByBand(deals)[0];
    expect(band.medianAmount).toBe(515000000);
    expect(band.maxAmount).toBe(5000000000);
  });

  it('전용면적대를 경계값에서 가른다', () => {
    expect(bandOf(59.9).key).toBe('under60');
    expect(bandOf(60).key).toBe('60to85');
    expect(bandOf(84.9).key).toBe('60to85');
    expect(bandOf(85).key).toBe('85to135');
    expect(bandOf(135).key).toBe('over135');
    expect(bandOf(300).key).toBe('over135');
  });

  it('거래가 없는 면적대는 아예 빼고 보여준다', () => {
    const bands = summarizeByBand([deal(59, 3e8), deal(84, 5e8)]);
    expect(bands.map((b) => b.key)).toEqual(['under60', '60to85']);
    expect(bands.length).toBeLessThan(AREA_BANDS.length);
  });

  it('㎡당 단가는 면적으로 나눈 값이다', () => {
    const bands = summarizeByBand([deal(100, 1e9)]);
    expect(bands[0].medianUnitPrice).toBe(10000000);
  });
});

describe('지역코드', () => {
  it('서울 25개, 경기 47개가 모두 5자리다', () => {
    const [seoul, gyeonggi] = regionCodes.values.sido;
    expect(seoul.sigungu.length).toBe(25);
    expect(gyeonggi.sigungu.length).toBe(47);
    for (const s of regionCodes.values.sido) {
      for (const g of s.sigungu) {
        expect(g.code, g.name).toMatch(/^\d{5}$/);
        expect(g.name.length, g.code).toBeGreaterThan(1);
      }
    }
  });

  it('코드가 겹치지 않는다', () => {
    const all = regionCodes.values.sido.flatMap((s) => s.sigungu.map((g) => g.code));
    expect(new Set(all).size).toBe(all.length);
  });

  it('화성시는 2026년에 나뉜 네 개 구로 들어가 있다', () => {
    // 옛 코드 41590으로는 한 건도 안 나온다. 되돌아가면 경기 최대 거래지역이 통째로 빈다.
    const gg = regionCodes.values.sido[1].sigungu;
    const hwaseong = gg.filter((g) => g.name.startsWith('화성시'));
    expect(hwaseong.map((g) => g.code).sort()).toEqual(['41591', '41593', '41595', '41597']);
    expect(gg.some((g) => g.code === '41590')).toBe(false);
  });

  it('어떻게 확인했는지가 룰 파일에 적혀 있다', () => {
    expect(regionCodes.meta.verifiedBy).toContain('API');
    expect(regionCodes.meta.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('단지별 묶기', () => {
  const d = (name: string, dong: string, area: number, amount: number, date = '2026-07-01') => ({
    name,
    area,
    floor: 5,
    buildYear: 2010,
    dong,
    jibun: '1',
    amount,
    monthlyRent: 0,
    date,
    unitPrice: Math.round(amount / area),
  });

  it('같은 이름이어도 동네가 다르면 다른 단지로 센다', () => {
    // 래미안·자이처럼 같은 브랜드가 여러 동네에 있다. 이름만으로 묶으면 엉뚱하게 섞인다.
    const out = summarizeByComplex([
      d('래미안', '잠실동', 84, 20e8),
      d('래미안', '가락동', 84, 10e8),
    ]);
    expect(out.length).toBe(2);
    expect(out.map((c) => c.dong).sort()).toEqual(['가락동', '잠실동']);
  });

  it('단지 값은 평균이 아니라 중앙값이다', () => {
    const out = summarizeByComplex([
      d('가나', '잠실동', 84, 20e8),
      d('가나', '잠실동', 84, 21e8),
      d('가나', '잠실동', 84, 90e8),
    ]);
    expect(out[0].count).toBe(3);
    expect(out[0].medianAmount).toBe(21e8);
    expect(out[0].maxAmount).toBe(90e8);
  });

  it('거래가 많은 단지가 앞에 온다', () => {
    const out = summarizeByComplex([
      d('적은곳', '잠실동', 84, 20e8),
      d('많은곳', '잠실동', 84, 20e8),
      d('많은곳', '잠실동', 84, 21e8),
    ]);
    expect(out[0].name).toBe('많은곳');
  });

  it('평형 필터가 전용면적대로 거른다', () => {
    const deals = [d('가', '잠실동', 59, 10e8), d('나', '잠실동', 84, 20e8)];
    expect(filterByBand(deals, '60to85').length).toBe(1);
    expect(filterByBand(deals, '60to85')[0].area).toBe(84);
    expect(filterByBand(deals, 'all').length).toBe(2);
    expect(filterByBand(deals, null).length).toBe(2);
  });

  it('지번을 들고 있어야 나중에 좌표를 붙일 수 있다', () => {
    const out = summarizeByComplex([d('가나', '잠실동', 84, 20e8)]);
    expect(out[0].jibun).toBe('1');
    expect(out[0].dong).toBe('잠실동');
  });
});
