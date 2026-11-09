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
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { refreshStale, syncCoupang, syncCoupangSearch } from '@/lib/sync/coupang-sync';
import { repairSearchPrices } from './repair-search-prices';
import { repairOptions } from './repair-options';
import { insertPosts } from './insert-posts';
import { stats } from './stats';
import { fillDescriptions } from './fill-descriptions';
import { inspect } from './inspect';
import { repairPrelock } from './repair-prelock';
import { fetchGoldboxRaw, searchProducts } from '@/lib/coupang';

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

const kstDate = (d = new Date()) => new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);

async function lastDailyDate(): Promise<string | null> {
  await db().execute(sql`CREATE TABLE IF NOT EXISTS sync_state (key text PRIMARY KEY, value text, updated_at timestamptz DEFAULT now())`);
  const r = (await db().execute(sql`SELECT value FROM sync_state WHERE key = 'daily_done'`)) as unknown as { value: string }[];
  return r[0]?.value ?? null;
}

/** 매일 아침 수집: 베스트·골드박스 + 오늘 정보글 + 홈·목록 갱신. 한국 시간 7:35 이후 하루 한 번 */
async function runDaily(force: boolean) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  const due = kst.getUTCHours() * 60 + kst.getUTCMinutes() >= 7 * 60 + 35;
  if (!force && (!due || (await lastDailyDate()) === kstDate(now))) return;
  const r = await syncCoupang();
  console.log(JSON.stringify(r, null, 2));
  if (r.skipped) return;
  await db().execute(sql`
    INSERT INTO sync_state (key, value, updated_at) VALUES ('daily_done', ${kstDate(now)}::text, now())
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()`);
  // 오늘 공개할 정보글이 있으면 넣기 (상품 카드는 지금까지 모인 상품으로)
  try {
    const p = await insertPosts(true);
    if (p.posts.length) console.log('정보글:', JSON.stringify(p.posts));
  } catch (e) {
    console.error('정보글 넣기 실패:', (e as Error).message);
  }
  if (r.upserted > 0) await revalidate('coupang');
  if (r.collected === 0 && r.errors.length) process.exitCode = 1;
}

/**
 * 매시간 수집: 인기 키워드 검색 + 오래 확인 못 한 상품 재확인.
 * 사이트 캐시 갱신은 하지 않음 — 새 상품 페이지는 첫 방문 때 바로 만들어지고, 목록은 다음 날 아침 수집 때 갱신.
 */
async function runHourly() {
  const s = await syncCoupangSearch();
  console.log(JSON.stringify(s, null, 2));
  console.log('재확인:', JSON.stringify(await refreshStale()));
  // 소개글 없는 상품 채우기 (제미나이, 한 번에 3개씩 · 무료 사용량 안에서)
  try {
    const d = await fillDescriptions(Number(process.env.DESC_PER_HOUR ?? 10), true);
    console.log('소개글:', JSON.stringify({ saved: d.saved, skipped: d.skipped, calls: d.calls, stopped: d.stopped, errors: d.errors.slice(0, 3) }));
  } catch (e) {
    console.error('소개글 실패:', (e as Error).message);
  }
}

async function main() {
  const job = process.argv[2];
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL 미설정 — 수집을 건너뜁니다.');
    return;
  }
  process.env.DATA_SOURCE = 'db';

  if (job === 'coupang') {
    // 매일 아침 수집 (예약 실행이 늦게 와서 오늘 이미 돌았으면 건너뜀, 수동 실행은 항상)
    await runDaily(process.env.GITHUB_EVENT_NAME === 'workflow_dispatch');
  } else if (job === 'search' || job === 'deals') {
    await runHourly();
  } else if (job === 'loop') {
    // 이어달리기: GitHub 예약 실행은 바쁠 때 몇 시간씩 빠져서(하루 24번 중 6번만 온 날도 있음)
    // 한 번 실행되면 약 5시간 반 동안 켜져 있으면서 매시간 직접 수집 → 끝날 때 다음 실행을 스스로 예약(워크플로).
    const end = Date.now() + Number(process.env.LOOP_MINUTES ?? 330) * 60_000;
    for (let round = 1; ; round++) {
      const started = Date.now();
      console.log(`\n===== ${round}회차 ${new Date().toISOString()} =====`);
      try {
        await runDaily(false); // 아침 수집 시간이 지났는데 오늘 아직 안 돌았으면
        await runHourly();
      } catch (e) {
        console.error('이번 회차 실패:', (e as Error).message);
      }
      const next = started + 60 * 60_000;
      if (next + 5 * 60_000 > end) break;
      await new Promise((r) => setTimeout(r, Math.max(0, next - Date.now())));
    }
  } else if (job === 'revalidate') {
    // 배포 직후: 빌드 때 빈 틀로 만들어진 홈·목록·사이트맵을 실제 데이터로 다시 만들기
    await revalidate('coupang');
  } else if (job === 'goldbox-raw') {
    // 골드박스 API 가 주는 가격 칸 확인 (호출 1번) + 같은 상품을 검색 API 로 찾았을 때 가격 비교 (최대 3번)
    const raw = (await fetchGoldboxRaw()) as Record<string, unknown>[];
    console.log('골드박스', raw.length, '개, 칸:', Object.keys(raw[0] ?? {}).join(', '));
    console.log(JSON.stringify(raw.slice(0, 3), null, 2));
    for (const r of raw.slice(0, 3)) {
      const name = String(r.productName ?? '').slice(0, 30);
      const hit = (await searchProducts(name))?.find((x) => x.productId === String(r.productId));
      console.log(`비교: ${name} | 골드박스 ${r.productPrice} | 검색 ${hit ? hit.price : '(검색 결과에 없음)'}`);
      await new Promise((res) => setTimeout(res, 1200));
    }
  } else if (job === 'inspect') {
    console.log(JSON.stringify(await inspect(), null, 2));
  } else if (job === 'desc-sample') {
    // 소개글 샘플 (저장 안 함)
    console.log(JSON.stringify(await fillDescriptions(1, false), null, 2));
  } else if (job === 'stats') {
    console.log(JSON.stringify(await stats(), null, 2));
  } else if (job === 'posts-dry' || job === 'posts') {
    // 정보글 넣기 (posts-dry = 확인만). 발행일이 지난 글은 바로, 나머지는 그날 오전 9시에 자동 공개
    // posts: 24시간 안에 공개할 글만 넣음 / posts-dry: 앞으로 30일 치를 미리 확인
    const r = await insertPosts(job === 'posts', job === 'posts' ? 24 : 24 * 30);
    console.log(JSON.stringify(r, null, 2));
    if (job === 'posts') await revalidate('coupang');
  } else if (job === 'repair-dry' || job === 'repair') {
    // 1회성 데이터 정리 (repair-dry = 바꿀 개수만 확인) — 옵션 섞임 정리 (repair-search-prices 는 이미 적용됨)
    void repairSearchPrices;
    void repairOptions;
    const r = await repairPrelock(job === 'repair'); // 현재 정리 작업: 옵션 고정 전 섞인 기록
    console.log(JSON.stringify(r, null, 2));
    if (job === 'repair') await revalidate('coupang');
  } else {
    console.error('usage: tsx scripts/sync.ts <loop|coupang|search|stats|inspect|revalidate|posts|goldbox-raw|repair>');
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
