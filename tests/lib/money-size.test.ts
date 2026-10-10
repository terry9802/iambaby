import { describe, expect, it } from 'vitest';
import { formatKRW } from '@/lib/format';
import { CAP, FLOOR, fitCqi, widthRatio } from '@/components/ui/Money';

/**
 * 금액이 칸 밖으로 삐져나가지 않는지, 폭을 계산해서 본다.
 *
 * Money는 글자 크기를 clamp(최소, N cqi, 최대)로 준다. 1cqi는 담긴 칸 폭의
 * 1%다. 그래서 '칸 폭 × N / 100'이 실제 글자 크기가 되고, 거기에 글의
 * 폭 배율을 곱하면 글이 차지하는 폭이 나온다. 그 값이 칸 폭을 넘지 않아야
 * 한다. 아래 계산이 브라우저가 하는 일과 같다.
 */
function usedWidth(text: string, boxWidth: number, size: 'hero' | 'tile'): number {
  const raw = (boxWidth * Number(fitCqi(text))) / 100;
  const fontSize = Math.min(Math.max(raw, FLOOR[size]), CAP[size]);
  return widthRatio(text) * fontSize;
}

describe('금액 폭 배율', () => {
  /*
    브라우저에서 실제로 잰 값과 맞는지 본다. 이 숫자가 틀어지면 화면에서
    삐져나가기 시작하므로, 글꼴이나 굵기를 건드렸을 때 여기서 걸려야 한다.
  */
  it('브라우저에서 잰 폭과 맞는다', () => {
    // 12px에서 95.75px을 쟀다 → 7.979배
    expect(widthRatio('1,981,508,714원')).toBeCloseTo(7.979, 1);
    // 12px에서 77.38px → 6.448배
    expect(widthRatio('49,239,170원')).toBeCloseTo(6.448, 1);
    // 12px에서 58.98px → 4.915배
    expect(widthRatio('261,190원')).toBeCloseTo(4.915, 1);
  });

  it('자릿수가 늘면 배율도 늘어난다', () => {
    expect(widthRatio(formatKRW(1_000))).toBeLessThan(widthRatio(formatKRW(1_000_000)));
    expect(widthRatio(formatKRW(1_000_000))).toBeLessThan(widthRatio(formatKRW(1_000_000_000)));
  });
});

describe('좁은 화면에서 칸을 안 넘는다', () => {
  /*
    320px 폰에서 대시보드가 두 칸으로 쪼개지면 한 칸의 글 넣을 폭이 88px이
    된다. 브라우저에서 잰 값이다. 제일 빡빡한 자리라 여기가 통과하면
    넓은 화면은 저절로 통과한다.
  */
  const NARROW = 88;

  it.each([261_190, 1_234_567, 49_239_170, 123_456_789, 1_981_508_714])(
    '%i원이 88px 칸에 들어간다',
    (amount) => {
      const text = formatKRW(amount);
      expect(usedWidth(text, NARROW, 'tile')).toBeLessThanOrEqual(NARROW);
    },
  );

  /*
    맨 위 요약은 글자가 더 크다. 320px 폰에서 그 칸이 둘로 쪼개지면 한 칸에
    115px이 남는다. 역시 브라우저에서 잰 값이다.
  */
  it('맨 위 요약도 좁은 칸에 들어간다', () => {
    for (const amount of [261_190, 49_239_170, 123_456_789, 1_981_508_714]) {
      expect(usedWidth(formatKRW(amount), 115, 'hero')).toBeLessThanOrEqual(115);
    }
  });

  it('짧은 금액은 최대 크기에서 멈춘다', () => {
    const text = formatKRW(19_500);
    const raw = (600 * Number(fitCqi(text))) / 100;
    expect(raw).toBeGreaterThan(CAP.hero);
  });
});
