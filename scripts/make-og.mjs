/*
  공유 링크에 붙는 대표 이미지(1200×630)를 만든다.

  런타임에 그리지 않고 미리 PNG로 굽는다. 카카오톡·슬랙 같은 곳의 미리보기 수집기는
  느린 응답을 기다려 주지 않고, 이미지는 한 번 만들면 바뀔 일이 거의 없기 때문이다.
  글씨는 사이트와 같은 Pretendard를 쓴다 (public/fonts에 있는 것을 그대로 읽는다).

  실행:  node scripts/make-og.mjs
*/
import { chromium } from 'playwright-core';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'og');
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

/** 사이트의 @font-face 규칙을 file:// 경로로 바꿔서 그대로 쓴다 */
async function fontCss() {
  const css = await readFile(path.join(ROOT, 'app', 'pretendard.css'), 'utf8');
  return css.replaceAll('/fonts/pretendard/', `file://${path.join(ROOT, 'public', 'fonts', 'pretendard')}/`);
}

const CARDS = [
  {
    name: 'default',
    kicker: '처음 겪는 일 앞에서',
    headline: '몰라도 괜찮아요.\n뭘 모르는지 몰라도 괜찮아요.\n복잡한 세상에서 우린 아직 애기인거죠',
    tags: ['출산 · 육아', '내 결혼', '이직', '퇴직', '남의 경조사', '잘 쉬는 법'],
  },
  {
    name: 'childcare',
    kicker: '출산 · 육아',
    headline: '아이가 생겼는데\n뭘 언제 신청해야 하는지\n하나도 모르겠어요',
    tags: ['육아휴직 급여', '6+6 부모육아휴직', '출산 지원금', '휴가 일정'],
  },
  {
    name: 'marriage',
    kicker: '내 결혼',
    headline: '결혼하면 세금이랑\n지원이 어떻게\n달라지나요',
    tags: ['결혼세액공제 100만원', '신혼부부 전세자금대출'],
  },
  {
    name: 'jobchange',
    kicker: '이직',
    headline: '연봉 얼마를 불러야\n지금보다\n이득인가요',
    tags: ['실수령액 비교', '손익분기 연봉'],
  },
  {
    name: 'retirement',
    kicker: '퇴직',
    headline: '퇴직금이랑\n실업급여가\n얼마나 나오나요',
    tags: ['퇴직금', '실업급여', '수급 기간'],
  },
  {
    name: 'socialdues',
    kicker: '남의 경조사',
    headline: '이 사람 결혼식에\n얼마 내야\n실례가 아닌가요',
    tags: ['축의금', '조의금', '관계별 기준'],
  },
  {
    name: 'rest',
    kicker: '잘 쉬는 법',
    headline: '쉬는 데도 돈이 드는데\n나라에서 보태주는 게\n있나요',
    tags: ['근로자 휴가지원', '문화누리카드', '청년문화예술패스', '스포츠강좌이용권'],
  },
  {
    name: 'guide',
    kicker: '읽을거리',
    headline: '숫자만 던지지 않고\n왜 그 숫자인지까지\n적었어요',
    tags: ['법령 조문', '계산 과정', '확인한 날짜'],
  },
];

function html(card, css) {
  const lines = card.headline.split('\n').map((l) => `<span>${l}</span>`).join('');
  const tags = card.tags.map((t) => `<li>${t}</li>`).join('');
  return `<!doctype html><meta charset="utf-8"><style>
${css}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;background:#f4f6f8;font-family:'Pretendard Variable',sans-serif;
  -webkit-font-smoothing:antialiased;word-break:keep-all}
.card{position:absolute;inset:36px;background:#fff;border:1px solid #e3e6eb;border-radius:28px;
  padding:46px 60px;display:flex;flex-direction:column;overflow:hidden}
.brand{font-size:23px;letter-spacing:-.01em}
.brand b{font-weight:700;color:#14161a}
.brand span{font-weight:500;color:#8b93a1}
.kicker{margin-top:30px;align-self:flex-start;font-size:20px;font-weight:600;color:#00785a;
  background:#e4f5ee;border-radius:999px;padding:8px 18px}
h1{margin-top:22px;font-size:56px;font-weight:700;line-height:1.22;letter-spacing:-.025em;color:#14161a;
  display:flex;flex-direction:column}
.tags{margin-top:auto;display:flex;flex-wrap:wrap;gap:9px;list-style:none;padding-top:24px}
.tags li{font-size:19px;color:#59616e;border:1px solid #e3e6eb;border-radius:8px;padding:7px 13px}
.foot{margin-top:20px;padding-top:18px;border-top:1px solid #e3e6eb;display:flex;
  align-items:baseline;justify-content:space-between;gap:24px}
.foot p{font-size:19px;color:#8b93a1}
.foot b{font-size:19px;font-weight:600;color:#00785a}
</style>
<div class="card">
  <div class="brand"><b>난아직애긴데</b><span>세상이너무어려워요</span></div>
  <div class="kicker">${card.kicker}</div>
  <h1>${lines}</h1>
  <ul class="tags">${tags}</ul>
  <div class="foot">
    <p>계산 과정과 근거 조문까지 같이 보여드려요</p>
    <b>iambaby.vercel.app</b>
  </div>
</div>`;
}

const css = await fontCss();
const dir = await mkdtemp(path.join(tmpdir(), 'og-'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

for (const card of CARDS) {
  const file = path.join(dir, `${card.name}.html`);
  await writeFile(file, html(card, css), 'utf8');
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);
  const over = await page.evaluate(() => {
    const c = document.querySelector('.card');
    return Math.round(c.scrollHeight - c.clientHeight);
  });
  if (over > 0) throw new Error(`${card.name}: 카드 안에 내용이 ${over}px 넘칩니다. 글씨 크기나 여백을 줄이세요.`);
  await page.screenshot({ path: path.join(OUT, `${card.name}.png`) });
  console.log('만듦:', `public/og/${card.name}.png`);
}
await browser.close();
