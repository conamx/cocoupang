# 셰어인포 (shareinfo.co.kr)

뽐뿌·펨코 등 **커뮤니티 핫딜 + 쿠팡 최저가·가격 변동 추이**를 모아보는 정보 서비스.
딜바고(dealbago.com)형 구조를 **Next.js 15 (App Router)** 로 구현한 사이트입니다.

> 이전 Astro 정적 블로그는 전면 교체되었습니다.

---

## 빠른 시작

```bash
npm install
cp .env.example .env        # 값은 비워도 시드 데이터로 동작
npm run dev                 # http://localhost:3000
npm run build && npm start  # 프로덕션 빌드
```

키/DB가 없으면 `src/lib/seed/*` 의 **시드 데이터**로 그대로 돌아갑니다(데모 모드).

---

## 구조

```
src/
  app/
    layout.tsx              공통 레이아웃 · Organization/WebSite JSON-LD · 다크모드
    page.tsx                핫딜 피드 + 역대최저가 (/)
    coupang/page.tsx        쿠팡 최저가 전체 (/coupang)
    coupang/category/[cat]  카테고리별 인기·최저가 (정적)
    deal/page.tsx           핫딜 모음 (/deal)
    coupang/[id]/page.tsx   ★상품 가격추적 상세(그래프·이력·Product JSON-LD·제휴버튼)
    deal/[id]/page.tsx      핫딜 상세
    blog/ , blog/[slug]     정보 콘텐츠(SEO 롱테일 보강)
    travel/ , travel/[slug] 할인코드(여행/쇼핑 제휴)
    search/page.tsx         통합 검색(noindex)
    sitemap.ts robots.ts    SEO
    feed.xml/route.ts       RSS
    api/revalidate          수집 후 캐시 갱신 훅
  components/               헤더·탭바·푸터·가격그래프·카드
  lib/
    data.ts                 ★데이터 접근 계층(시드 ↔ DB 교체 지점)
    coupang.ts              쿠팡 파트너스 Open API 클라이언트(서명 포함)
    sync/                   ★쿠팡 수집·가격 갱신, 검색 키워드 목록
    seed/                   데모용 시드 데이터
  db/schema.ts              ★Drizzle(Postgres) 실제 데이터 모델
```

★ = 운영 전환 시 손대는 핵심 지점.

---

## 운영 전환 (시드 → 실데이터)

1. **DB 준비** (Supabase 무료, 서울 리전) → SQL Editor 에 `drizzle/supabase-init.sql` 붙여넣고 Run
   (여러 번 실행해도 안전). `DATABASE_URL` 은 Connect → Direct → **Transaction pooler**(6543) 주소
2. **쿠팡 파트너스 키** 발급(partners.coupang.com) → `COUPANG_ACCESS_KEY` / `COUPANG_SECRET_KEY`
3. Netlify 환경변수: `DATA_SOURCE=db`, `DATABASE_URL`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`
4. GitHub 저장소 **Settings → Secrets and variables → Actions** 에 `DATABASE_URL`,
   `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL` 등록
5. Actions 탭 → **Sync** → Run workflow(coupang) 로 첫 수집 → 상품 수백 개 자동 등록

### 수동 등록 (API 키 발급 전)
`/admin` (환경변수 `ADMIN_PASSWORD` 로 로그인) 에 붙여넣으면 표로 정리 → 확인 후 등록.
- 쿠팡 파트너스 **HTML 코드**(링크·이미지·상품명 자동), 엑셀/구글시트 행 복사, `상품명↵가격↵링크` 줄 단위 모두 인식
- 이미 등록된 상품은 **링크 + 가격**만 붙여넣으면 가격 갱신 → 가격 이력·전일대비 %·역대 최저/최고 자동 계산
- 같은 상품을 나중에 API가 수집하면 같은 상품 ID로 이어서 추적

### 수집 구조 (Netlify 크레딧을 쓰지 않음)
```
GitHub Actions (.github/workflows/sync.yml)
  ├ 매일 07:40  npm run sync:coupang  쿠팡 베스트 15개 카테고리 × 50 + 골드박스 + 키워드 검색
  │                                   → 신규 상품 자동 등록, 가격·역대최저/최고·이력 갱신
  └ 매시 7분    npm run sync:deals    커뮤니티 핫딜 RSS
        ↓ 끝나면 POST /api/revalidate (CRON_SECRET) → 바뀐 페이지만 재생성
Netlify: 정적/ISR 페이지 서빙만 (상품·카테고리 1일, 홈·핫딜 1시간 캐시)
```
- 파트너스 API에는 "상품 ID로 현재가 조회"가 없어서, **베스트·골드박스·검색 결과를 매일 받아 갱신**합니다.
- 노출할 키워드는 `src/lib/sync/keywords.ts`, 카테고리는 `src/lib/site.ts` 에서 추가.
- 구매 링크는 API가 주는 수수료 추적 링크(`affiliateUrl`)를 그대로 사용합니다.

### 무료 플랜 비용 가이드
| 항목 | 어디서 | 비용 |
|---|---|---|
| 가격·핫딜 수집 | GitHub Actions | 공개 저장소 무료 / 비공개는 월 2,000분 무료 중 약 750분 사용 |
| DB | Supabase·Neon 무료 | 상품 1,000개 × 1년 이력 ≈ 수십 MB |
| 페이지 서빙 | Netlify(월 300크레딧) | 배포 1회 15 · 대역폭 1GB당 10 · 요청 1만 건당 3 · 함수 실행 GB-시간당 5 |

- **배포가 가장 비쌉니다(1회 15크레딧 → 월 20회면 소진).** 데이터는 DB로 들어가므로
  가격이 바뀌어도 재배포가 필요 없습니다. main 머지는 몰아서 하세요.
- 이미지는 쿠팡 CDN에서 직접 로드(Netlify 대역폭 미사용).
- 크레딧이 모자라기 시작하면(트래픽 증가 = 좋은 신호) Netlify 유료 플랜 또는 Cloudflare 이전을 검토.

## SEO 설계 요점
- 상품 페이지마다 **Product/Offer + BreadcrumbList JSON-LD**, 레이아웃에 **WebSite SearchAction**
- `sitemap.xml` 자동 생성(상품/딜/글/브랜드 전체), `robots.txt`, RSS
- 상품 페이지 **ISR(revalidate 1h)** 로 가격 신선도 유지 → 롱테일 "상품명 최저가/가격추이" 공략
- 운영 시 `layout.tsx` 의 `verification` 에 구글/네이버 소유확인 값 입력 후
  서치콘솔·서치어드바이저에 사이트맵 제출 + 수집요청

## 배포 (Netlify)
`netlify.toml` 에 `@netlify/plugin-nextjs` 설정 포함 — Next.js SSR·ISR·API·next/og 모두 동작.

1. Netlify → **Add new site → Import an existing project** → `conamx/cocoupang`
   (이미 있는 Netlify 사이트라면 Site configuration → Build & deploy → **Manage repository** 에서 `conamx/cocoupang` 으로 다시 연결)
2. **Production branch 는 `main`** 으로 두고, Branch deploys 에 작업 브랜치를 추가
   → 작업 브랜치 push 는 무료 미리보기(branch deploy), 크레딧(15)은 main 머지 때만 소모
   ⚠ 작업 브랜치를 Production branch 로 지정하면 push 할 때마다 15크레딧이 나갑니다.
3. env 없이도 시드 데이터로 바로 뜸. 운영 시 Site settings → Environment
   (스코프: All deploy contexts — 미리보기에도 적용되도록):
   `DATA_SOURCE=db`, `DATABASE_URL`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_PASSWORD`
   환경변수를 바꾼 뒤에는 재배포해야 반영됩니다.
   (쿠팡 키는 GitHub Actions 에만 있으면 됨)

### 크론(가격추적·핫딜수집)
GitHub Actions 가 담당합니다(위 "수집 구조" 참고). **schedule 은 main 브랜치에 머지된 뒤부터** 동작하며,
그 전에는 Actions 탭에서 수동 실행할 수 있습니다.

## 법적 주의
- **쿠팡 파트너스 고지 문구는 필수** — 푸터·상품 페이지에 포함되어 있음(`lib/site.ts`).
- 커뮤니티 수집은 각 사이트 **robots/이용약관 준수**, 출처 표기, 레이트리밋. 공식 API·RSS 우선.
