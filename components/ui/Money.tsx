import { formatKRW } from '@/lib/format';

/**
 * 큰 금액 한 줄.
 *
 * 금액은 절대 줄바꿈되면 안 된다. '49,239,' 다음 줄에 '170원'이 오면 숫자가
 * 두 개인 것처럼 읽힌다. 사장님 화면에서 실제로 그렇게 보였다.
 *
 * 그래서 두 가지를 같이 건다.
 *  - 줄바꿈 금지. 좁아도 안 꺾인다.
 *  - 글자 크기를 '담길 칸의 폭'과 '적힌 자릿수'에 맞춰 줄인다. 안 꺾이게만
 *    하면 이번엔 칸 밖으로 삐져나가므로, 길면 작아져야 한다.
 *
 * 화면 폭(vw)이 아니라 칸 폭(cqi)을 본다. 같은 폰이라도 금액이 한 칸에
 * 들어갈 때와 두 칸으로 쪼개질 때 쓸 수 있는 폭이 다르다. 화면 폭으로 재면
 * 그 차이를 못 보고, 실제로 320px 화면의 두 칸 배치에서 삐져나갔다.
 */

type Size = 'hero' | 'tile';

/*
  글자 하나가 글자 크기의 몇 배를 차지하는가.

  눈대중이 아니라 브라우저에서 실제 폭을 재서 구한 값이다. 이 글꼴·굵기
  (700, letter-spacing -0.02em, font-feature-settings "tnum")에서 폭은 글자
  크기에 정확히 비례했고, 세 종류로만 갈렸다.

    숫자 0.635 · 쉼표 0.265 · '원' 0.837

  검산: '1,981,508,714원'은 10×0.635 + 3×0.265 + 0.837 = 7.982배.
  글자 크기 12px에서 95.75px을 쟀으므로 95.75 / 12 = 7.979. 맞는다.
*/
const DIGIT = 0.635;
const COMMA = 0.265;
const WON = 0.837;

/** 이 글이 글자 크기의 몇 배 폭을 먹는가. */
export function widthRatio(text: string): number {
  return [...text].reduce((sum, ch) => {
    if (ch === ',') return sum + COMMA;
    if (ch === '원') return sum + WON;
    /* 숫자와 음수 기호는 같은 폭으로 본다(tnum이라 자릿수가 다 같다). */
    return sum + DIGIT;
  }, 0);
}

/*
  칸을 꽉 채우지 않고 2%를 남긴다. 글꼴이 바뀌거나 브라우저가 소수점을
  올림하면 딱 맞춘 글자는 1px 때문에 삐져나간다.
*/
const SAFETY = 0.98;

/* 아무리 길어도 이보다 작게는 안 줄인다. 안 보이는 숫자는 없는 숫자다. */
export const FLOOR: Record<Size, number> = { hero: 14, tile: 11 };
/* 넓은 화면에서 끝없이 커지지 않게 멈추는 자리. */
export const CAP: Record<Size, number> = { hero: 28, tile: 20 };

/**
 * 칸 폭의 몇 %가 한 글자 크기에 해당하는지. 자릿수가 많으면 작아진다.
 * 1cqi가 칸 폭의 1%이므로, 이 값을 글자 크기로 주면 글이 칸을 꽉 채운다.
 */
export function fitCqi(text: string): string {
  return ((100 * SAFETY) / widthRatio(text)).toFixed(2);
}

export function Money({
  value,
  size = 'tile',
  tone = 'ink',
  fitTo,
}: {
  value: number;
  size?: Size;
  tone?: 'ink' | 'brand';
  /*
    나란히 놓인 금액끼리 크기를 맞출 때 쓴다. 옆칸에 든 금액 중 제일 긴 것을
    넘겨주면, 짧은 쪽도 그 금액에 맞춰 줄어든다.

    이게 없으면 '1,981,508,714원'은 14px, 옆의 '990,000원'은 28px이 되어
    한 줄에 크기가 두 배 다른 숫자가 나란히 앉는다. 실제로 그렇게 보였고,
    큰 쪽이 더 중요한 숫자처럼 읽혀서 뜻이 틀어진다.
  */
  fitTo?: number[];
}) {
  const text = formatKRW(value);
  /* 같이 맞출 금액이 있으면 그중 제일 넓은 것을 기준으로 삼는다. */
  const gauge = (fitTo ?? []).reduce(
    (widest, other) => {
      const candidate = formatKRW(other);
      return widthRatio(candidate) > widthRatio(widest) ? candidate : widest;
    },
    text,
  );
  const fit = fitCqi(gauge);
  return (
    /*
      여기가 '칸'이다. cqi는 이 상자의 폭을 기준으로 센다. 바깥 칸이
      반으로 쪼개지면 이 상자도 같이 좁아지므로 글자가 알아서 줄어든다.
    */
    <div className="[container-type:inline-size]">
      <p
        /*
          clamp를 Tailwind 글자 크기로 못 적는다. 자릿수에 따라 값이
          달라져서 미리 만들어 둘 수 없다. 그래서 style로 직접 준다.
          cqi를 모르는 옛 브라우저에서는 이 줄이 통째로 무시되고
          아래 text-[...] 가 남는다.
        */
        style={{ fontSize: `clamp(${FLOOR[size]}px, ${fit}cqi, ${CAP[size]}px)` }}
        className={
          'tnum whitespace-nowrap font-bold leading-tight tracking-[-0.02em] ' +
          (size === 'hero' ? 'text-[19px] ' : 'text-[15px] ') +
          (tone === 'brand' ? 'text-brand' : 'text-ink')
        }
      >
        {text}
      </p>
    </div>
  );
}
