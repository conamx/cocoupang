/**
 * 수집 작업 실행기 — GitHub Actions(.github/workflows/sync.yml)에서 호출합니다.
 * Netlify 함수가 아니라 GitHub 러너에서 돌기 때문에 Netlify 크레딧을 쓰지 않습니다.
 *
 *   npm run sync:coupang   # 쿠팡 베스트·골드박스·검색 → 상품 등록 + 가격 갱신 (1일 1회)
 *   npm run sync:deals     # 커뮤니티 핫딜 RSS 수집 (1시간 간격)
 *
 * 필요한 환경변수: DATABASE_URL, COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY
 * 선택: NEXT_PUBLIC_SITE_URL + CRON_SECRET → 수집 후 사이트 캐시를 즉시 갱신
 */
import { syncCoupang } from '@/lib/sync/coupang-sync';
import { ingestDeals } from '@/lib/ingest';

async function revalidate(scope: 'coupang' | 'deals') {
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
  } else if (job === 'deals') {
    const r = await ingestDeals();
    console.log(JSON.stringify(r, null, 2));
    if (r.inserted > 0) await revalidate('deals');
  } else {
    console.error('usage: tsx scripts/sync.ts <coupang|deals>');
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
