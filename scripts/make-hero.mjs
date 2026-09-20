/*
  대표 사진의 스튜디오 배경을 사이트 바탕색(#eceeed)으로 바꾼다.

  원본 사진의 배경은 #d4d6d5 쯤 되는 회색이라, 페이지에 얹으면 사진이
  놓인 네모가 그대로 보인다. 배경만 바탕색으로 올려 주면 아이들과 횡단보도만
  페이지 위에 떠 있는 것처럼 보인다.

  아이들 옷에도 회색이 있어서 "회색이면 배경"으로 고르면 옷까지 밝아진다.
  그래서 위쪽 가장자리에서 홍수 채우기로 **이어진 배경 덩어리**만 고르고,
  그 안에서 배경색에 가까운 정도를 알파로 삼아 부드럽게 올린다. 이렇게 하면
  아이 윤곽의 반투명한 픽셀도 비례해서 올라가 테두리가 남지 않는다.

  원본은 assets/ 에 두고 건드리지 않는다. 결과만 public/img/ 로 나간다.

  내보내는 파일 이름에 번호를 붙인다. next/image 로 내보낸 사진은 CDN이
  기본 4시간 동안 쥐고 있어서(Next 16의 images.minimumCacheTTL), 같은 이름으로
  덮어쓰면 배포한 뒤에도 한참 옛날 사진이 보인다. 사진을 새로 손볼 때마다
  뒤 번호를 올리고 app/page.tsx 의 경로도 같이 바꾼다.

  실행:  node scripts/make-hero.mjs
*/
import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

/** app/globals.css 의 --color-ground */
const GROUND = [0xec, 0xee, 0xed];

const JOBS = [
  { from: 'assets/hero-source.jpg', to: 'public/img/hero-2.jpg' },
  { from: 'assets/hero-og-source.jpg', to: 'public/img/hero-og.jpg' },
];

/** 브라우저 안에서 도는 코드. 캔버스 픽셀을 직접 만진다. */
function recolor({ dataUrl, ground }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('사진을 못 읽었습니다'));
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, w, h);
      const p = d.data;
      const at = (x, y) => (y * w + x) * 4;

      // 1) 배경색: 맨 윗줄 몇 줄의 중앙값
      const chan = [[], [], []];
      for (let y = 0; y < 6; y++)
        for (let x = 0; x < w; x += 3) {
          const i = at(x, y);
          for (let c = 0; c < 3; c++) chan[c].push(p[i + c]);
        }
      const bg = chan.map((v) => v.sort((a, b) => a - b)[v.length >> 1]);
      const dist = (i) =>
        Math.max(Math.abs(p[i] - bg[0]), Math.abs(p[i + 1] - bg[1]), Math.abs(p[i + 2] - bg[2]));

      // 2) 위쪽 가장자리에서 홍수 채우기 — 배경과 이어진 덩어리만 고른다.
      //    옷의 회색은 배경과 안 붙어 있으니 여기서 걸러진다.
      const TOL = 22;
      const region = new Uint8Array(w * h);
      const stack = [];
      for (let x = 0; x < w; x++) {
        if (dist(at(x, 0)) <= TOL) {
          region[x] = 1;
          stack.push(x);
        }
      }
      while (stack.length) {
        const q = stack.pop();
        const x = q % w;
        const y = (q / w) | 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (region[n]) continue;
          if (dist(n * 4) > TOL) continue;
          region[n] = 1;
          stack.push(n);
        }
      }

      // 3) 덩어리를 몇 픽셀 넓힌다. 아이 윤곽의 반투명한 띠까지 들어와야
      //    거기만 옛 회색으로 남아 테두리가 생기는 일이 없다.
      const R = 4;
      const grow = (src) => {
        const tmp = new Uint8Array(w * h);
        const out = new Uint8Array(w * h);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            let v = 0;
            for (let k = -R; k <= R && !v; k++) {
              const nx = x + k;
              if (nx >= 0 && nx < w && src[y * w + nx]) v = 1;
            }
            tmp[y * w + x] = v;
          }
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            let v = 0;
            for (let k = -R; k <= R && !v; k++) {
              const ny = y + k;
              if (ny >= 0 && ny < h && tmp[ny * w + x]) v = 1;
            }
            out[y * w + x] = v;
          }
        return out;
      };
      const wide = grow(region);

      // 4) 배경색에 가까울수록 1에 가까운 알파. 윤곽의 섞인 픽셀은
      //    섞인 만큼만 올라간다.
      const SOFT = 46;
      const alpha = new Float32Array(w * h);
      for (let n = 0; n < w * h; n++) {
        if (!wide[n]) continue;
        alpha[n] = Math.max(0, Math.min(1, 1 - dist(n * 4) / SOFT));
      }

      // 5) 알파를 살짝 뭉갠다. 경계에서 계단이 지는 걸 막는다.
      const blur = (src) => {
        const tmp = new Float32Array(w * h);
        const out = new Float32Array(w * h);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            let s = 0;
            let c = 0;
            for (let k = -1; k <= 1; k++) {
              const nx = x + k;
              if (nx < 0 || nx >= w) continue;
              s += src[y * w + nx];
              c++;
            }
            tmp[y * w + x] = s / c;
          }
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            let s = 0;
            let c = 0;
            for (let k = -1; k <= 1; k++) {
              const ny = y + k;
              if (ny < 0 || ny >= h) continue;
              s += tmp[ny * w + x];
              c++;
            }
            out[y * w + x] = s / c;
          }
        return out;
      };
      const a2 = blur(blur(alpha));

      // 6) 배경색 → 바탕색만큼 밀어 올린다.
      const delta = [ground[0] - bg[0], ground[1] - bg[1], ground[2] - bg[2]];
      for (let n = 0; n < w * h; n++) {
        const a = a2[n];
        if (a <= 0) continue;
        const i = n * 4;
        for (let c = 0; c < 3; c++)
          p[i + c] = Math.max(0, Math.min(255, Math.round(p[i + c] + a * delta[c])));
      }
      ctx.putImageData(d, 0, 0);
      resolve({ url: cv.toDataURL('image/jpeg', 0.92), bg, size: [w, h] });
    };
    img.src = dataUrl;
  });
}

const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage();
await page.goto('about:blank');

for (const job of JOBS) {
  const src = await readFile(path.join(ROOT, job.from));
  const dataUrl = `data:image/jpeg;base64,${src.toString('base64')}`;
  const out = await page.evaluate(recolor, { dataUrl, ground: GROUND });
  const buf = Buffer.from(out.url.split(',')[1], 'base64');
  await writeFile(path.join(ROOT, job.to), buf);
  console.log(
    `만듦: ${job.to}  ${out.size[0]}×${out.size[1]}  배경 rgb(${out.bg.join(',')}) → #eceeed  ${Math.round(buf.length / 1024)}KB`,
  );
}
await browser.close();
