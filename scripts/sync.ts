/**
 * 수집 작업 실행기 — GitHub Actions(.github/workflows/sync.yml)에서 호출합니다.
 * Netlify 함수가 아니라 GitHub 러너에서 돌기 때문에 Netlify 크레딧을 쓰지 않습니다.
 *
 *   npm run sync:coupang   # 쿠팡 베스트·골드박스·검색 → 상품 등록 + 가격 갱신 (1일 1회)
 *   npm run sync:search    # 매시간: 쿠팡 인기 키워드 검색 (COUPANG_SEARCH_PER_RUN 개)
 *
 * 필요한 환경변수: DATABASE_URL, COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY
 * 선택: NEXT_PUBLIC_SITE_URL + CRON_SECRET → 수집 후 사이트 캐시를 즉시 갱신
 */
import { syncCoupang, syncCoupangSearch } from '@/lib/sync/coupang-sync';

async function revalidate(scope: 'coupang') {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) return console.log('↷ revalidate 건너뜀 (NEXT_PUBLIC_SITE_URL/CRON_SECRET 없음)');
  const res = await fetch(`${site}/api/revalidate?scope=${scope}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });
  console.log(`↻ revalidate(${scope}):`, res.status);
}

async function main() {
  const job = process.argv[2];
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL 미설정 — 수집을 건너뜁니다.');
    return;
  }
  process.env.DATA_SOURCE = 'db';

  if (job === 'coupang') {
    const r = await syncCoupang();
    console.log(JSON.stringify(r, null, 2));
    if (r.upserted > 0) await revalidate('coupang');
    if (r.collected === 0 && r.errors.length) process.exitCode = 1;
  } else if (job === 'search' || job === 'deals') {
    // 매시간 쿠팡 검색 수집 ('deals' 는 예전 작업 이름 — 커뮤니티 핫딜 수집은 없앰)
    // 사이트 캐시 갱신은 하지 않음 — 새 상품 페이지는 첫 방문 때 바로 만들어지고,
    // 목록은 다음 날 아침 coupang 수집 때 함께 갱신됩니다 (Netlify 사용량 절약).
    const s = await syncCoupangSearch();
    console.log(JSON.stringify(s, null, 2));
  } else {
    console.error('usage: tsx scripts/sync.ts <coupang|search>');
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
