import { sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { fetchBestCategory, fetchGoldbox, hasCoupangKeys, searchProducts, type CoupangItem } from '@/lib/coupang';
import { coupangCategories, etcCategory } from '@/lib/site';
import { searchKeywords } from './keywords';
import { upsertProducts } from './upsert';
import { submitIndexNow } from './indexnow';
import { productPath } from '@/lib/product-url';
import { keywordPath, KEYWORD_MIN_PRODUCTS } from '@/lib/keyword-url';

/**
 * 쿠팡 상품 수집 + 가격 갱신.
 *
 * syncCoupang()       — 하루 1회: 카테고리별 베스트 + 골드박스
 * syncCoupangSearch() — 매시간: 인기 키워드 검색 (keywords.ts 를 순서대로 돌아가며)
 * 둘 다 products 에 upsert(신규 상품은 자동 등록) 하고 price_history 에 오늘 가격을 남깁니다.
 *
 * Netlify 크레딧을 쓰지 않도록 GitHub Actions 에서 `npm run sync:coupang` 으로 실행합니다.
 */

type Source = 'best' | 'goldbox' | 'search';
type Row = CoupangItem & { categoryId: string; categoryLabel: string; source: Source };

export type CoupangSyncResult = {
  indexnow?: string;
  collected: number;
  upserted: number;
  historyAdded: number;
  bySource: Record<string, number>;
  errors: string[];
  skipped?: string;
};

const labelOf = (id: string) => coupangCategories.find((c) => c.id === id)?.label ?? etcCategory.label;

// 골드박스·검색 결과의 categoryName("생활용품" 등)을 우리 카테고리로 매칭
function matchCategory(name?: string): { id: string; label: string } {
  if (name) {
    const hit = coupangCategories.find((c) => name.includes(c.label) || c.label.includes(name));
    if (hit) return hit;
  }
  return etcCategory;
}

/**
 * 검색엔진에 알릴 주소 모으기 → IndexNow 전송.
 *  - 이번에 처음 들어온 상품 (가격 기록이 방금 생긴 1건뿐인 상품)
 *  - 이번에 수집한 검색어 중 상품이 충분히 모인 품목 페이지
 */
async function notifyIndexNow(ids: string[], keywords: string[] = []): Promise<string> {
  if (ids.length === 0 && keywords.length === 0) return 'skip';
  try {
    const fresh = ids.length
      ? ((await db().execute(sql`
          SELECT p.id, p.name FROM products p
          WHERE p.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
            AND (SELECT count(*) FROM price_history h WHERE h.product_id = p.id) = 1
            AND EXISTS (SELECT 1 FROM price_history h WHERE h.product_id = p.id AND h.observed_at > now() - interval '30 minutes')`)) as unknown as { id: string; name: string }[])
      : [];
    const kwRows = keywords.length
      ? ((await db().execute(sql`
          SELECT t AS keyword, count(*)::int AS n FROM products, unnest(string_to_array(search_terms, '|')) AS t
          WHERE t IN (${sql.join(keywords.map((k) => sql`${k}`), sql`, `)}) GROUP BY t`)) as unknown as { keyword: string; n: number }[])
      : [];
    const paths = [
      ...kwRows.filter((r) => r.n >= KEYWORD_MIN_PRODUCTS).map((r) => keywordPath(r.keyword)),
      ...fresh.map((r) => productPath(r)),
    ];
    return await submitIndexNow(paths);
  } catch (e) {
    return `실패: ${(e as Error).message}`;
  }
}

/**
 * 옵션 고정 (같은 상품번호라도 옵션마다 가격이 다름 — 예: 콜라 190ml×30 / 250ml×30).
 * 상품마다 처음 추적한 옵션(vendorItemId, 제휴 링크 안에 있음)만 가격을 갱신하고,
 * 다른 옵션으로 들어온 결과는 골드박스·순위 표시만 반영 → 가격이 옵션 사이를 오가며 그래프가 튀지 않게.
 */
const vendorOf = (url?: string) => url?.match(/vendorItemId=(\d+)/)?.[1];

async function splitByVendor<T extends { productId: string; affiliateUrl?: string }>(rows: T[]): Promise<{ price: T[]; other: T[] }> {
  if (rows.length === 0) return { price: [], other: [] };
  const existing = new Map(
    ((await db().execute(
      sql`SELECT id, vendor_item_id FROM products WHERE id IN (${sql.join(rows.map((r) => sql`${r.productId}`), sql`, `)})`,
    )) as unknown as { id: string; vendor_item_id: string | null }[]).map((r) => [r.id, r.vendor_item_id]),
  );
  const price: T[] = [];
  const other: T[] = [];
  for (const r of rows) {
    const mine = existing.get(r.productId);
    const theirs = vendorOf(r.affiliateUrl);
    if (!mine || !theirs || mine === theirs) price.push(r);
    else other.push(r);
  }
  return { price, other };
}

// 가격을 반영한 상품에 추적 옵션 기록 (처음 한 번만)
async function rememberVendor(rows: { productId: string; affiliateUrl?: string }[]) {
  const pairs = rows.map((r) => [r.productId, vendorOf(r.affiliateUrl)] as const).filter((p): p is readonly [string, string] => !!p[1]);
  for (let i = 0; i < pairs.length; i += 200) {
    const chunk = pairs.slice(i, i + 200);
    await db().execute(sql`
      UPDATE products p SET vendor_item_id = v.vid
      FROM (VALUES ${sql.join(chunk.map(([id, vid]) => sql`(${id}::text, ${vid}::text)`), sql`, `)}) AS v(id, vid)
      WHERE p.id = v.id AND p.vendor_item_id IS NULL`);
  }
}

// 이번 시간에 수집할 검색 키워드 (시간 기준으로 순환 → 하루 24 × perRun 개)
function keywordsForThisHour(perRun: number) {
  if (perRun <= 0 || searchKeywords.length === 0) return [];
  const hour = Math.floor(Date.now() / 3_600_000);
  const start = (hour * perRun) % searchKeywords.length;
  return Array.from({ length: Math.min(perRun, searchKeywords.length) }, (_, i) =>
    searchKeywords[(start + i) % searchKeywords.length],
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 호출 제한 안전장치.
 * 쿠팡이 한 번이라도 제한(429/403)을 걸면 그 자리에서 수집을 멈추고, 24시간 동안 모든 수집을 쉽니다.
 * (제한 중에 계속 부르면 더 긴 제한·계정 정지로 이어질 수 있음)
 */
const COOLDOWN_HOURS = 24;
// 쿠팡이 제한으로 거절한 응답 (coupang.ts 가 'coupang 429 …' 형태로 에러를 던짐)
const isLimitError = (e: unknown) => /^coupang (429|403)\b/.test((e as Error)?.message ?? '');
async function cooldownUntil(): Promise<Date | null> {
  await db().execute(sql`CREATE TABLE IF NOT EXISTS sync_state (key text PRIMARY KEY, value text, updated_at timestamptz DEFAULT now())`);
  const r = (await db().execute(sql`SELECT value FROM sync_state WHERE key = 'coupang_cooldown_until'`)) as unknown as { value: string }[];
  const until = r[0]?.value ? new Date(r[0].value) : null;
  return until && until.getTime() > Date.now() ? until : null;
}
async function startCooldown(reason: string) {
  const until = new Date(Date.now() + COOLDOWN_HOURS * 3_600_000).toISOString();
  await db().execute(sql`
    INSERT INTO sync_state (key, value, updated_at) VALUES ('coupang_cooldown_until', ${until}::text, now())
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()`);
  console.error(`⛔ 쿠팡 호출 제한 감지 → ${until} 까지 수집 중지: ${reason}`);
}

export async function syncCoupang(): Promise<CoupangSyncResult> {
  const result: CoupangSyncResult = { collected: 0, upserted: 0, historyAdded: 0, bySource: {}, errors: [] };
  if (!hasCoupangKeys()) return { ...result, skipped: '쿠팡 파트너스 키 미설정' };
  const cd = await cooldownUntil();
  if (cd) return { ...result, skipped: `호출 제한 휴식 중 (${cd.toISOString()} 까지)` };
  let limited = false;

  // 카테고리당 베스트 상품 수 (API 최대 100)
  const bestLimit = Number(process.env.COUPANG_BEST_LIMIT ?? 100);
  const rows = new Map<string, Row>();
  const add = (items: CoupangItem[], source: Source, cat: (it: CoupangItem) => { id: string; label: string }) => {
    result.bySource[source] = (result.bySource[source] ?? 0) + items.length;
    for (const it of items) {
      const prev = rows.get(it.productId);
      if (prev && source !== 'goldbox') continue;
      if (prev) {
        // 베스트에도 있는 골드박스 상품: 가격·링크·이름은 베스트 것(오래 추적하는 옵션) 유지, 골드박스 표시·순위만
        rows.set(it.productId, { ...prev, source: 'goldbox', rank: it.rank });
        continue;
      }
      const c = cat(it);
      rows.set(it.productId, { ...it, source, categoryId: c.id, categoryLabel: c.label });
    }
  };

  // 1) 카테고리 베스트
  for (const c of coupangCategories.filter((x) => /^\d+$/.test(x.id))) {
    try {
      add((await fetchBestCategory(c.id, bestLimit)) ?? [], 'best', () => c);
    } catch (e) {
      result.errors.push(`best ${c.label}: ${(e as Error).message}`);
      if (isLimitError(e)) {
        limited = true;
        await startCooldown((e as Error).message);
        break;
      }
    }
    await sleep(300);
  }

  // 2) 골드박스  (키워드 검색은 syncCoupangSearch 가 매시간 따로 돌림)
  let goldboxOk = false;
  if (!limited) {
    try {
      add((await fetchGoldbox()) ?? [], 'goldbox', (it) => matchCategory(it.categoryName));
      goldboxOk = true;
    } catch (e) {
      result.errors.push(`goldbox: ${(e as Error).message}`);
      if (isLimitError(e)) await startCooldown((e as Error).message);
    }
  }

  const all = [...rows.values()];
  result.collected = all.length;
  if (all.length === 0) return result;

  // 어제 골드박스였던 상품은 일반 상품으로 내림 (오늘 목록으로 교체)
  const p = schema.products;
  if (goldboxOk) await db().update(p).set({ source: 'best' }).where(sql`${p.source} = 'goldbox'`);

  // 추적 중인 옵션과 같은 결과만 가격 반영, 다른 옵션은 골드박스·순위만
  const { price: priced, other } = await splitByVendor(all);
  const r = await upsertProducts(
    priced.map((x) => ({
      productId: x.productId,
      name: x.name,
      image: x.image,
      price: x.price,
      categoryId: x.categoryId,
      categoryLabel: x.categoryLabel,
      affiliateUrl: x.affiliateUrl,
      isRocket: x.isRocket,
      source: x.source,
      rank: x.rank,
    })),
  );
  await rememberVendor(priced);
  for (const x of other) {
    await db().execute(sql`
      UPDATE products SET rank = ${x.rank ?? null},
        source = CASE WHEN source = 'manual' THEN source WHEN ${x.source}::text = 'goldbox' THEN 'goldbox' ELSE source END
      WHERE id = ${x.productId}`); // 가격을 확인한 게 아니므로 updated_at(확인 시각)은 그대로
  }
  result.upserted = r.upserted;
  result.historyAdded = r.historyAdded;
  (result as { otherOption?: number }).otherOption = other.length;
  result.indexnow = await notifyIndexNow(all.map((x) => x.productId));

  return result;
}

/**
 * 인기 키워드 검색 수집 (매시간, GitHub Actions).
 * 검색 API는 시간당 호출 제한이 있어 한 번에 COUPANG_SEARCH_PER_RUN 개(기본 10)만.
 * 이미 있는 상품은 가격만 갱신하고 카테고리·순위·골드박스 여부는 그대로 둡니다.
 */
export async function syncCoupangSearch(): Promise<CoupangSyncResult & { keywords: string[] }> {
  const perRun = Number(process.env.COUPANG_SEARCH_PER_RUN ?? 10);
  const ks = keywordsForThisHour(perRun);
  const result = { collected: 0, upserted: 0, historyAdded: 0, bySource: {}, errors: [] as string[], keywords: ks.map((k) => k.keyword) };
  if (!hasCoupangKeys()) return { ...result, skipped: '쿠팡 파트너스 키 미설정' };
  const cd = await cooldownUntil();
  if (cd) return { ...result, skipped: `호출 제한 휴식 중 (${cd.toISOString()} 까지)` };

  // 지금 골드박스인 상품 — 쿠팡 검색 API 는 맞는 상품이 없을 때 골드박스 추천을 대신 돌려주는 경우가 있어서 거르는 데 씀
  const goldbox = new Set(
    ((await db().execute(sql`SELECT id FROM products WHERE source = 'goldbox'`)) as unknown as { id: string }[]).map((r) => r.id),
  );
  const rows = new Map<string, Row>();
  const tags = new Map<string, string[]>(); // 검색어 → 그 검색어로 나온 상품들
  const fallback: string[] = [];
  for (const k of ks) {
    try {
      const items = (await searchProducts(k.keyword)) ?? [];
      // 결과 절반 이상이 골드박스 상품이면 검색 결과가 아니라 추천 목록 → 이 검색어는 건너뜀
      if (items.length > 0 && items.filter((it) => goldbox.has(it.productId)).length * 2 >= items.length) {
        fallback.push(k.keyword);
      } else {
        for (const it of items) {
          if (!rows.has(it.productId)) rows.set(it.productId, { ...it, rank: undefined, source: 'search', categoryId: k.categoryId, categoryLabel: labelOf(k.categoryId) });
          tags.set(k.keyword, [...(tags.get(k.keyword) ?? []), it.productId]);
        }
      }
    } catch (e) {
      result.errors.push(`search ${k.keyword}: ${(e as Error).message}`);
      if (isLimitError(e)) {
        await startCooldown((e as Error).message);
        break; // 이미 받은 것만 저장하고 멈춤
      }
    }
    await sleep(1200);
  }
  if (fallback.length) (result as { fallback?: string[] }).fallback = fallback;

  // 가격은 '추적 중인 옵션'과 같은 결과만 반영 (다른 옵션이면 꼬리표만). 직접 등록 상품은 가격을 건드리지 않음.
  const ids = [...rows.keys()];
  const manual = new Set(
    ids.length
      ? ((await db().execute(
          sql`SELECT id FROM products WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) AND source = 'manual'`,
        )) as unknown as { id: string }[]).map((r) => r.id)
      : [],
  );
  const { price: all } = await splitByVendor([...rows.values()].filter((x) => !manual.has(x.productId)));
  result.collected = rows.size;
  if (rows.size === 0) return result;
  const r = all.length
    ? await upsertProducts(
        all.map((x) => ({
          productId: x.productId,
          name: x.name,
          image: x.image,
          price: x.price,
          categoryId: x.categoryId,
          categoryLabel: x.categoryLabel,
          affiliateUrl: x.affiliateUrl,
          isRocket: x.isRocket,
          source: 'search' as const,
        })),
      )
    : { upserted: 0, historyAdded: 0 };
  await rememberVendor(all);
  result.upserted = r.upserted;
  result.historyAdded = r.historyAdded;

  // 검색어 꼬리표 저장 → 사이트 검색에서 "계란"을 치면 이름에 '계란'이 없는 '신선한 대란'도 찾게
  try {
    await ensureSearchTermsColumn();
    for (const [kw, ids] of tags) {
      await db().execute(sql`
        UPDATE products SET search_terms = concat_ws('|', nullif(search_terms, ''), ${kw}::text)
        WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
          AND position(${'|' + kw + '|'}::text in '|' || coalesce(search_terms, '') || '|') = 0`);
    }
  } catch (e) {
    result.errors.push(`search_terms: ${(e as Error).message}`);
  }
  (result as CoupangSyncResult).indexnow = await notifyIndexNow(all.map((x) => x.productId), [...tags.keys()]);
  return result;
}

// products.search_terms 컬럼이 없으면 추가 (한 번만 실제로 실행됨)
async function ensureSearchTermsColumn() {
  await db().execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS search_terms text`);
}
