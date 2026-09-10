# 난 아직 애긴데 세상이 너무 어려워요

인생의 주요 이벤트마다 필요한 계산과 정보를 한곳에서 해결해주는 사이트.
Phase 1은 **출산·육아** 하나만 끝까지 다룹니다.

## 무엇이 다른가

- 프로필을 한 번 입력하면 모든 계산기가 자동으로 채워집니다.
- 결과 숫자만 던지지 않고 **계산 과정을 단계별로 펼쳐서** 보여줍니다.
- 모든 숫자에 **근거 조문과 기준일**이 붙습니다.
- 계산만이 아니라 **판정**(자격 여부)과 **최적화**(최선의 선택)까지 합니다.

## 개인정보

프로필은 브라우저의 localStorage에만 저장되고 **서버로 전송되지 않습니다.**
모든 계산은 브라우저 안에서 끝납니다. 이 약속을 깨는 코드(프로필을 fetch·서버액션에 싣는 코드)를 추가하지 마세요.

## 구조

```
/app                    라우트
/components             UI (계산기 셸, 타임라인, 프로필)
/lib/calculators        순수 함수. UI를 import하지 않는다.
/lib/rules              룰 로더 (이벤트 날짜 기준 연도 선택)
/lib/profile            프로필 스키마 + localStorage
/rules/<연도>/*.json    기준값. 로직 파일에 숫자를 하드코딩하지 않는다.
/tests                  모든 계산기는 테스트 필수
```

### 글을 추가할 때

`/content/childcare/<slug>.ts` 에 `Article` 하나를 export 하고 `content/index.ts` 배열에 넣으면
목록·본문·사이트맵에 자동으로 붙습니다. 본문은 블록 배열이고 인라인 표기는 `**굵게**` 와
`[글자](주소)` 만 씁니다.

글에 숫자를 적을 때는 계산기와 같은 근거를 `basisRuleIds` 에 적어 두세요. 글 하단에 근거 조문과
확인일이 자동으로 붙습니다.

### 기준값을 고칠 때

세법·고시는 매년 바뀝니다. `/rules/<연도>/` 에 새 JSON을 추가하고 `lib/rules/loader.ts`의
레지스트리에 한 줄 더하면 끝입니다. 계산 로직은 건드리지 않습니다.

모든 룰 파일은 `meta`에 `effectiveFrom` / `source` / `sourceUrl` / `verifiedAt` / `verifiedBy`를
반드시 갖습니다. `verifiedAt`이 6개월을 넘기면 결과 화면에 "기준값 확인 필요" 배지가 자동으로 뜹니다.

## 개발

```bash
pnpm install
pnpm dev
pnpm test        # 계산 로직 테스트
pnpm typecheck
```

## 배포와 외부 연결

`.env.example`을 복사해 값을 채웁니다. 값이 비어 있으면 해당 스크립트를 아예 넣지 않으므로,
로컬 개발 중에는 전부 비워둬도 됩니다.

| 환경변수 | 쓰임 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | sitemap.xml, robots.txt, canonical, OG 태그의 기준 도메인. 비우면 Vercel 배포 주소를 자동으로 씁니다 |
| `NEXT_PUBLIC_GA_ID` | GA4 측정 ID. 없으면 GA 스크립트를 넣지 않음 |
| `NEXT_PUBLIC_GSC_VERIFICATION` | Search Console HTML 태그 인증값 |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | AdSense 퍼블리셔 ID. 넣으면 `/ads.txt`가 자동 생성됨 |
| `NEXT_PUBLIC_ADSENSE_SLOT_HOME` / `_HUB` | 광고 단위 슬롯 ID. 비우면 그 자리에 광고가 안 나옴 |

### Vercel

1. 저장소를 Vercel에 연결하면 별도 설정 없이 빌드됩니다 (`pnpm build`).
2. Project Settings → Environment Variables에 위 값들을 넣습니다.
3. 도메인을 연결한 뒤 `NEXT_PUBLIC_SITE_URL`을 그 도메인으로 바꿉니다. 이 값이 틀리면
   sitemap과 canonical이 전부 엉뚱한 주소를 가리킵니다.

### Google Analytics 4

측정 ID(`G-`로 시작)를 `NEXT_PUBLIC_GA_ID`에 넣으면 끝입니다. IP는 익명 처리되고,
**계산기에 입력한 값은 어떤 형태로도 이벤트에 싣지 않습니다.** 이 원칙을 깨는 코드를 넣지 마세요.

### Search Console

- **DNS 인증**을 쓰면 코드 변경 없이 도메인 소유권만 확인하면 됩니다.
- **HTML 태그 인증**을 쓴다면 `<meta name="google-site-verification" content="...">`의
  content 값만 `NEXT_PUBLIC_GSC_VERIFICATION`에 넣습니다.
- 등록 후 `https://<도메인>/sitemap.xml`을 제출합니다. `/me`는 개인 설정 화면이라
  robots.txt에서 크롤링을 막아뒀습니다.

### AdSense 심사

심사 전에 확인할 것:

1. `NEXT_PUBLIC_ADSENSE_CLIENT`를 넣고 배포한 뒤 `https://<도메인>/ads.txt`가 열리는지 확인합니다.
2. 개인정보처리방침(`/privacy`)이 접속 가능한지 확인합니다. 쿠키·GA·AdSense 항목이 이미 들어 있습니다.
3. 슬롯 ID는 승인 후에 발급됩니다. 그 전까지 `_SLOT_` 변수는 비워두면 광고 자리가 렌더링되지 않습니다.

광고는 계산 결과 영역 안에 넣지 않습니다. 결과와 광고가 섞이면 이 사이트가 파는 유일한 것,
곧 신뢰가 사라지기 때문입니다.
