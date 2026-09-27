/*
  앱 아이콘을 만든다.

  카카오 앱 등록, 홈 화면에 추가, 공유 미리보기 같은 데서 아주 작게 보인다.
  글씨를 넣으면 48px에서 뭉개지므로, 사진의 빨간 횡단보도만 남겼다.

  줄을 한 점에서 퍼지게 그리면 안 된다. 처음에 원근을 줘서 그렸더니 욱일기로
  읽혔다. 나란한 가로줄로 바꿨다. 횡단보도는 건너는 사람 앞을 가로지르는
  무늬이기도 해서 이쪽이 실제 모양에도 맞다.

  실행:  node scripts/make-icon.mjs
*/
import { chromium } from 'playwright-core';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'icon');
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const BRAND = '#cb2c26';
const SIZES = [512, 192, 180, 96];

/**
 * 나란한 흰 가로줄 세 개. 줄이 셋이면 48px로 줄여도 횡단보도로 읽히고,
 * 넷을 넘으면 뭉개진다.
 */
function html(size) {
  const bars = [0, 1, 2]
    .map((i) => {
      const band = 100 / 3;
      const top = band * i + band * 0.28;
      const h = band * 0.44;
      return `<div class="bar" style="top:${top}%;height:${h}%"></div>`;
    })
    .join('');
  return `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${size}px;height:${size}px;overflow:hidden}
.icon{position:relative;width:${size}px;height:${size}px;background:${BRAND};overflow:hidden}
.bar{position:absolute;left:11%;right:11%;background:#fff;border-radius:${size * 0.012}px}
</style>
<div class="icon">${bars}</div>`;
}

await mkdir(OUT, { recursive: true });
const dir = await mkdtemp(path.join(tmpdir(), 'icon-'));
const browser = await chromium.launch({ executablePath: EXEC });

for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const file = path.join(dir, `${size}.html`);
  await writeFile(file, html(size), 'utf8');
  await page.goto(`file://${file}`);
  await page.screenshot({ path: path.join(OUT, `app-${size}.png`), omitBackground: false });
  await page.close();
  console.log('만듦:', `public/icon/app-${size}.png`);
}
await browser.close();
