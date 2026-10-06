# 셰어인포 (shareinfo.co.kr)

뽐뿌·펨코 등 **커뮤니티 핫딜 + 쿠팡 최저가·가격 변동 추이**를 모아보는 정보 서비스.
딜바고(dealbago.com)형 구조를 **Next.js 15 (App Router)** 로 구현한 Phase 1 스캐폴드입니다.

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
    coupang/page.tsx        쿠팡 최저가 카테고리 (/coupang?cat=)
    coupang/[id]/page.tsx   ★상품 가격추적 상세(그래프·이력·Product JSON-LD·제휴버튼)
    deal/[id]/page.tsx      핫딜 상세
    blog/ , blog/[slug]     정보 콘텐츠(SEO 롱테일 보강)
    travel/ , travel/[slug] 할인코드(여행/쇼핑 제휴)
    search/page.tsx         통합 검색(noindex)
    sitemap.ts robots.ts    SEO
    feed.xml/route.ts       RSS
    api/cron/update-prices  가격추적 크론 훅
  components/               헤더·탭바·푸터·가격그래프·카드
  lib/
    data.ts                 ★데이터 접근 계층(시드 ↔ DB 교체 지점)
    coupang.ts              쿠팡 파트너스 Open API 클라이언트(서명 포함)
    seed/                   데모용 시드 데이터
  db/schema.ts              ★Drizzle(Postgres) 실제 데이터 모델
```

★ = 운영 전환 시 손대는 핵심 지점.

---

## 운영 전환 (시드 → 실데이터)

1. **DB 준비** (Supabase/Neon) → `.env` 의 `DATABASE_URL` 설정
   ```bash
   npm run db:generate && npm run db:migrate
   ```
2. **쿠팡 파트너스 키** 발급(partners.coupang.com) → `.env` 의
   `COUPANG_ACCESS_KEY` / `COUPANG_SECRET_KEY` 설정
3. `src/lib/data.ts` 의 각 함수를 `src/db/schema.ts` 기반 Drizzle 쿼리로 교체,
   `DATA_SOURCE=db` 로 전환 (UI는 그대로 동작)
4. **가격 추적 크론**: 스케줄러가 매일 아래를 호출
   ```
   GET /api/cron/update-prices
   Authorization: Bearer ${CRON_SECRET}
   ```
   `src/lib/coupang.ts` 의 `fetchProductPrice` 를 파트너스 상품 API로 구현

### 수집 파이프라인 로드맵
- **Phase 1 (현재)**: 쿠팡 상품 가격추적 + 핫딜/블로그/할인코드 UI
- **Phase 2**: 커뮤니티 핫딜 수집기(RSS/크롤 → `deals` 적재, 5~15분 주기)
- **Phase 3**: 할인코드 자동 갱신 + 기존 콘텐츠 이전
- **Phase 4**: 좋아요/댓글/가격알림/PWA (`reactions`·`priceAlerts` 테이블 이미 정의)

---

## SEO 설계 요점
- 상품 페이지마다 **Product/Offer + BreadcrumbList JSON-LD**, 레이아웃에 **WebSite SearchAction**
- `sitemap.xml` 자동 생성(상품/딜/글/브랜드 전체), `robots.txt`, RSS
- 상품 페이지 **ISR(revalidate 1h)** 로 가격 신선도 유지 → 롱테일 "상품명 최저가/가격추이" 공략
- 운영 시 `layout.tsx` 의 `verification` 에 구글/네이버 소유확인 값 입력 후
  서치콘솔·서치어드바이저에 사이트맵 제출 + 수집요청

## 배포 (Netlify)
`netlify.toml` 에 `@netlify/plugin-nextjs` 설정 포함 — Next.js SSR·ISR·API·next/og 모두 동작.

1. Netlify → **Add new site → Import an existing project** → `conamx/jnc`
2. **Branch to deploy** 를 `claude/confident-edison-vd8vp6` 로 지정하면 미리보기 배포 생성
   (main 머지 전까지 기존 라이브 사이트는 영향 없음)
3. env 없이도 시드 데이터로 바로 뜸. 운영 시 Site settings → Environment:
   `DATABASE_URL`, `COUPANG_ACCESS_KEY/SECRET_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`
4. 확인 후 PR #1을 main에 머지 → 기존 사이트 도메인에 반영

### 크론(가격추적·핫딜수집)
`vercel.json` 의 크론은 Vercel 전용입니다. Netlify에서는 둘 중 하나:
- **Netlify Scheduled Functions** 로 `/api/cron/*` 호출, 또는
- 외부 스케줄러(cron-job.org 등)가 `Authorization: Bearer ${CRON_SECRET}` 로 호출

## 법적 주의
- **쿠팡 파트너스 고지 문구는 필수** — 푸터·상품 페이지에 포함되어 있음(`lib/site.ts`).
- 커뮤니티 수집은 각 사이트 **robots/이용약관 준수**, 출처 표기, 레이트리밋. 공식 API·RSS 우선.
