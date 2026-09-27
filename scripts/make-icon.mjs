/*
  사이트 아이콘을 만든다.

  원본은 assets/icon-source.png (사장님이 그린 마크)이고, 여기서 필요한 크기를
  뽑는다. 원본은 건드리지 않는다.

  애플 아이콘만 다르게 만든다. 원본은 모서리가 투명한 둥근 사각형인데,
  iOS는 투명한 곳을 검게 칠해 버린다. 그래서 애플용은 브랜드색으로 꽉 채운
  네모로 굽고, 둥글리는 건 iOS에 맡긴다.

  실행:  node scripts/make-icon.mjs
*/
import { chromium } from 'playwright-core';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'assets', 'icon-source.png');
const OUT = path.join(ROOT, 'public', 'icon');
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const BRAND = '#cb2c26';

/** 투명 배경 그대로 쓰는 것들. 브라우저 탭과 안드로이드 홈 화면. */
const PLAIN = [512, 192, 96, 48, 32, 16];
/** iOS 홈 화면. 투명한 곳이 검게 나오므로 브랜드색으로 채운다. */
const APPLE = [180];

await mkdir(OUT, { recursive: true });
const dataUrl = `data:image/png;base64,${(await readFile(SRC)).toString('base64')}`;
const dir = await mkdtemp(path.join(tmpdir(), 'icon-'));
const browser = await chromium.launch({ executablePath: EXEC });

async function bake(size, { filled }) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const file = path.join(dir, `${size}-${filled ? 'f' : 'p'}.html`);
  await writeFile(
    file,
    `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0}
body{width:${size}px;height:${size}px;${filled ? `background:${BRAND};` : ''}}
img{width:100%;height:100%;display:block;${filled ? 'transform:scale(1.18)' : ''}}
</style><img src="${dataUrl}" alt="">`,
    'utf8',
  );
  await page.goto(`file://${file}`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const name = filled ? `apple-${size}.png` : `app-${size}.png`;
  await page.screenshot({ path: path.join(OUT, name), omitBackground: !filled });
  await page.close();
  console.log('만듦:', `public/icon/${name}`);
}

for (const size of PLAIN) await bake(size, { filled: false });
for (const size of APPLE) await bake(size, { filled: true });
await browser.close();

/*
  app/favicon.ico 는 Next가 다른 아이콘 설정보다 먼저 쓴다. 여기 기본값이
  들어 있으면 메타데이터로 아무리 지정해도 그게 보인다. 실제로 그래서 한동안
  Vercel 아이콘이 떠 있었다. 여러 크기를 한 파일에 담아 덮어쓴다.
*/
console.log('남은 일: app/favicon.ico 는 scripts/make-favicon.py 가 굽는다');
