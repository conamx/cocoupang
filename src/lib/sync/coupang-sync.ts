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
  // INDEXNOW=off: 끔 / new: 새 상품만 알림(품목 페이지 재알림 안 함) — Netlify 크레딧이 빠듯할 때
  // (알림을 보내면 검색 봇이 더 자주 와서 페이지 생성 비용이 늘어남. 가격 갱신과는 무관)
  if (process.env.INDEXNOW === 'off') return 'off';
  if (process.env.INDEXNOW === 'new') keywords = [];
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

async function splitByVendor<T extends { productId: string; affiliateUrl?: string; name?: string; price?: number }>(
  rows: T[],
): Promise<{ price: T[]; other: T[] }> {
  if (rows.length === 0) return { price: [], other: [] };
  const ids = sql.join(rows.map((r) => sql`${r.productId}`), sql`, `);
  const existing = new Map(
    ((await db().execute(sql`
      SELECT p.id, p.vendor_item_id, p.name, p.source, p.current_price, o.name AS opt_name,
        p.updated_at < now() - interval '44 hours' AS stale
      FROM products p LEFT JOIN product_options o ON o.product_id = p.id AND o.vendor_item_id = p.vendor_item_id
      WHERE p.id IN (${ids})`).catch(() =>
      db().execute(sql`SELECT id, vendor_item_id, name, source, current_price, null AS opt_name, false AS stale FROM products WHERE id IN (${ids})`),
    )) as unknown as ExistingRow[]).map((r) => [r.id, r]),
  );
  const price: T[] = [];
  const other: T[] = [];
  const switches: { id: string; from: string; to: string; url: string; price: number }[] = [];
  for (const r of rows) {
    const cur = existing.get(r.productId);
    const mine = cur?.vendor_item_id;
    const theirs = vendorOf(r.affiliateUrl);
    if (!mine || !theirs || mine === theirs) price.push(r);
    else if (cur && canSwitchVendor(cur, r) && !switches.some((s) => s.id === r.productId)) {
      switches.push({ id: r.productId, from: mine, to: theirs, url: r.affiliateUrl!, price: r.price! });
      price.push(r);
    } else other.push(r);
  }
  if (switches.length) await switchVendors(switches);
  return { price, other };
}

type ExistingRow = {
  id: string;
  vendor_item_id: string | null;
  name: string;
  source: string;
  current_price: number;
  opt_name: string | null;
  stale: boolean;
};
const sameText = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * 판매자 자동 전환: 같은 상품번호에서 원래 판매자(옵션)가 빠지고 다른 판매자가 대표로 나올 때.
 * 조건 — 모두 맞아야 바꿈 (가격이 섞이지 않게):
 *  1) 이름이 글자까지 같고, 그 이름에 개수가 들어 있음 (", 1개", "30구", "2팩" 등)
 *     → 11/9 첫 적용 때 "코멧 종이컵 185ml"처럼 개수 없는 이름은 같아도 묶음 수가 달라 가격이 두 배로 튐 → 개수 필수
 *  2) 원래 판매자로 이틀(44시간) 넘게 가격을 못 잡음 → 판매자가 빠진 것으로 봄 (두 판매자가 번갈아 나올 때 왔다 갔다 방지)
 *  3) 가격이 지금 가격의 ±20% 안 (그보다 크게 다르면 다른 옵션일 가능성이 큼)
 */
const HAS_COUNT = /\d+\s*(개입|개|입|구|팩|매|롤|병|캔|봉|포|박스|세트|켤레|장|ea)(?![가-힣a-z])/i;
function canSwitchVendor(cur: ExistingRow, r: { name?: string; price?: number }) {
  if (!cur.stale || !r.price || !r.name || !HAS_COUNT.test(r.name)) return false;
  if (r.price < cur.current_price * 0.8 || r.price > cur.current_price * 1.2) return false;
  return sameText(r.name, cur.opt_name) || (cur.source !== 'manual' && sameText(r.name, cur.name));
}
async function switchVendors(list: { id: string; from: string; to: string; url: string; price: number }[]) {
  await db().execute(sql`CREATE TABLE IF NOT EXISTS vendor_switches (
    product_id text NOT NULL, from_vendor text NOT NULL, to_vendor text NOT NULL, price integer, switched_at timestamptz NOT NULL DEFAULT now())`);
  for (const s of list) {
    // 구매 링크도 새 판매자로 (직접 등록 상품 포함 — 원래 링크의 판매자가 빠졌으므로)
    await db().execute(sql`UPDATE products SET vendor_item_id = ${s.to}, affiliate_url = ${s.url} WHERE id = ${s.id} AND vendor_item_id = ${s.from}`);
    await db().execute(sql`INSERT INTO vendor_switches (product_id, from_vendor, to_vendor, price) VALUES (${s.id}, ${s.from}, ${s.to}, ${s.price})`);
  }
}

/**
 * 옵션별 가격 모으기 (화면 표시는 12월 배포 때 — 지금은 데이터만 쌓음).
 * 같은 상품번호라도 API 마다·검색 결과마다 다른 옵션(1개/2개, 용량 등)이 들어옴 → 옵션(vendorItemId)마다 따로 저장.
 * 나중에 '옵션별 가격', '여러 개 사면 얼마 절약'을 보여 줄 재료.
 */
export async function recordOptions(items: (CoupangItem & { from?: string })[]) {
  // from: 어느 API 에서 온 가격인지 (best·goldbox·search·refresh) — API 마다 가격 기준(일반가·와우가)이 다른지 확인용
  const rows = new Map<string, { pid: string; vid: string; name: string; price: number; from: string }>();
  for (const it of items) {
    const vid = vendorOf(it.affiliateUrl);
    if (vid) rows.set(`${it.productId}:${vid}:${it.from ?? ''}`, { pid: it.productId, vid, name: it.name, price: it.price, from: it.from ?? '' });
  }
  if (rows.size === 0) return;
  await db().execute(sql`CREATE TABLE IF NOT EXISTS product_options (
    product_id text NOT NULL, vendor_item_id text NOT NULL, name text NOT NULL, price integer NOT NULL,
    first_seen timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, vendor_item_id))`);
  await db().execute(sql`CREATE TABLE IF NOT EXISTS option_price_history (
    product_id text NOT NULL, vendor_item_id text NOT NULL, price integer NOT NULL, observed_at timestamptz NOT NULL DEFAULT now())`);
  await db().execute(sql`ALTER TABLE option_price_history ADD COLUMN IF NOT EXISTS source text`);
  await db().execute(sql`CREATE INDEX IF NOT EXISTS option_price_history_idx ON option_price_history (product_id, vendor_item_id, observed_at)`);
  const list = [...rows.values()];
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    const values = sql.join(
      chunk.map((r) => sql`(${r.pid}::text, ${r.vid}::text, ${r.name}::text, ${r.price}::int, ${r.from}::text)`),
      sql`, `,
    );
    // 가격 기록: 같은 옵션·같은 API 의 오늘(한국 날짜) 같은 가격 기록이 없을 때만
    await db().execute(sql`
      INSERT INTO option_price_history (product_id, vendor_item_id, price, source)
      SELECT v.pid, v.vid, v.price, v.src FROM (VALUES ${values}) AS v(pid, vid, name, price, src)
      WHERE NOT EXISTS (
        SELECT 1 FROM option_price_history h
        WHERE h.product_id = v.pid AND h.vendor_item_id = v.vid AND h.price = v.price AND coalesce(h.source, '') = v.src
          AND (h.observed_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date)`);
    await db().execute(sql`
      INSERT INTO product_options (product_id, vendor_item_id, name, price)
      SELECT DISTINCT ON (pid, vid) pid, vid, name, price FROM (VALUES ${values}) AS v(pid, vid, name, price, src)
      ON CONFLICT (product_id, vendor_item_id) DO UPDATE SET name = excluded.name, price = excluded.price, last_seen = now()`);
  }
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

/** 매일 확인 현황: 최근 24시간 안에 가격을 확인한 상품 비율 (0~1) */
async function coverage(): Promise<{ total: number; checked: number; ratio: number }> {
  await ensureTries();
  // 판매종료 의심 상품은 빼고 계산 (확인할 수 없는 상품 때문에 비율이 영영 안 오르는 것 방지)
  const [c] = (await db().execute(sql`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE p.updated_at > now() - interval '24 hours')::int AS checked
    FROM products p LEFT JOIN refresh_tries t ON t.id = p.id
    WHERE NOT ${ENDED}`)) as unknown as { total: number; checked: number }[];
  return { ...c, ratio: c.checked / Math.max(1, c.total) };
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
  const seen: (CoupangItem & { from: string })[] = []; // 옵션별 가격 기록용 (합치기 전 원본)
  const add = (items: CoupangItem[], source: Source, cat: (it: CoupangItem) => { id: string; label: string }) => {
    result.bySource[source] = (result.bySource[source] ?? 0) + items.length;
    seen.push(...items.map((it) => ({ ...it, from: source })));
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

  try {
    await recordOptions(seen);
  } catch (e) {
    result.errors.push(`options: ${(e as Error).message}`);
  }
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
  // 매일 확인 현황 (1순위 지표): 최근 24시간 안에 가격을 확인한 상품 비율
  const cov = await coverage();
  (result as { coverage?: string }).coverage = `${cov.checked}/${cov.total} (${Math.round(cov.ratio * 100)}%) 24시간 안 확인`;

  return result;
}

/**
 * 인기 키워드 검색 수집 (매시간, GitHub Actions).
 * 검색 API는 시간당 호출 제한이 있어 한 번에 COUPANG_SEARCH_PER_RUN 개(기본 10)만.
 * 이미 있는 상품은 가격만 갱신하고 카테고리·순위·골드박스 여부는 그대로 둡니다.
 */
/**
 * 이번 시간 호출 나누기 (총 호출 수는 그대로 = 검색 + 재확인).
 * 24시간 안 갱신 비율이 목표(COUPANG_MIN_COVERAGE, 90%) 밑이면 새 상품도 안 받는 상태라
 * 키워드 검색은 대부분 이미 갱신된 상품을 또 확인하는 데 쓰임 → 검색을 줄이고(COUPANG_SEARCH_CATCHUP) 그만큼 밀린 상품 재확인에.
 * 목표를 넘으면 원래대로 (검색으로 새 상품도 다시 받음).
 */
export async function hourlyBudget() {
  const search = Number(process.env.COUPANG_SEARCH_PER_RUN ?? 10);
  const refresh = Number(process.env.COUPANG_REFRESH_PER_RUN ?? 30);
  const min = Number(process.env.COUPANG_MIN_COVERAGE ?? 0.9);
  const catchup = Math.min(search, Number(process.env.COUPANG_SEARCH_CATCHUP ?? search));
  const cov = await coverage();
  const behind = cov.ratio < min;
  return {
    search: behind ? catchup : search,
    refresh: behind ? refresh + (search - catchup) : refresh,
    coverage: Math.round(cov.ratio * 1000) / 10,
    mode: behind ? '밀린 상품 우선' : '평소',
  };
}

export async function syncCoupangSearch(
  perRun = Number(process.env.COUPANG_SEARCH_PER_RUN ?? 10),
): Promise<CoupangSyncResult & { keywords: string[] }> {
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
  const seen: (CoupangItem & { from: string })[] = [];
  for (const k of ks) {
    try {
      const items = (await searchProducts(k.keyword)) ?? [];
      // 결과 절반 이상이 골드박스 상품이면 검색 결과가 아니라 추천 목록 → 이 검색어는 건너뜀
      if (items.length > 0 && items.filter((it) => goldbox.has(it.productId)).length * 2 >= items.length) {
        fallback.push(k.keyword);
      } else {
        seen.push(...items.map((it) => ({ ...it, from: 'search' })));
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

  try {
    await recordOptions(seen);
  } catch (e) {
    result.errors.push(`options: ${(e as Error).message}`);
  }
  // 가격은 '추적 중인 옵션'과 같은 결과만 반영 (다른 옵션이면 꼬리표만). 직접 등록 상품은 가격을 건드리지 않음.
  const ids = [...rows.keys()];
  const manual = new Set(
    ids.length
      ? ((await db().execute(
          sql`SELECT id FROM products WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) AND source = 'manual'`,
        )) as unknown as { id: string }[]).map((r) => r.id)
      : [],
  );
  // 1순위는 '있는 상품 매일 확인' — 24시간 안 확인 비율이 기준(기본 90%) 아래면 새 상품은 받지 않고 있는 상품만 갱신
  const minCov = Number(process.env.COUPANG_MIN_COVERAGE ?? 0.9);
  const cov = await coverage();
  const existing = new Set(
    ids.length
      ? ((await db().execute(sql`SELECT id FROM products WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)) as unknown as {
          id: string;
        }[]).map((r) => r.id)
      : [],
  );
  const intake = cov.ratio >= minCov;
  (result as { intake?: string }).intake = `${intake ? '새 상품 받음' : '새 상품 멈춤(있는 상품 먼저)'} · 확인 ${Math.round(cov.ratio * 100)}%`;
  const candidates = [...rows.values()].filter((x) => !manual.has(x.productId) && (intake || existing.has(x.productId)));
  const { price: all } = await splitByVendor(candidates);
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

/**
 * 판매종료(의심) 상품의 대체 후보: 재확인 검색 결과 중 이름의 핵심이 같고 가격이 비슷한 다른 상품번호.
 * 자동으로 바꿔치기하지 않음 (정품/벌크/병행수입처럼 이름이 비슷한 다른 상품이 섞일 수 있어서) —
 * 12월 배포 때 판매종료 페이지에 "지금 판매 중인 같은 상품" 링크로만 보여 줌.
 *  - 모델명처럼 숫자가 든 단어는 전부 같아야 하고, 나머지 단어도 70% 이상 겹쳐야 함
 *  - 가격은 마지막 가격의 ±30% 안
 */
const words = (s: string) =>
  s.toLowerCase().replace(/[(\[][^)\]]*[)\]]/g, ' ').split(',')[0].split(/[\s/·]+/).filter((w) => w.length >= 2);
function looksSame(base: string, cand: string) {
  const b = words(base);
  const c = new Set(words(cand));
  const cText = cand.toLowerCase();
  const models = b.filter((w) => /\d/.test(w));
  if (models.some((w) => !cText.includes(w))) return false;
  const rest = b.filter((w) => !/\d/.test(w));
  return rest.length === 0 ? models.length > 0 : rest.filter((w) => c.has(w) || cText.includes(w)).length / rest.length >= 0.7;
}
async function saveSuccessors(p: { id: string; name: string; current_price: number }, seen: CoupangItem[]) {
  const picks = [...new Map(seen.map((it) => [it.productId, it])).values()]
    .filter((it) => it.productId !== p.id && it.price >= p.current_price * 0.7 && it.price <= p.current_price * 1.3)
    .filter((it) => looksSame(p.name, it.name))
    .slice(0, 3);
  if (picks.length === 0) return;
  await db().execute(sql`CREATE TABLE IF NOT EXISTS product_successors (
    product_id text NOT NULL, candidate_id text NOT NULL, name text NOT NULL, price integer NOT NULL, image text,
    affiliate_url text, is_rocket boolean, found_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (product_id, candidate_id))`);
  for (const it of picks)
    await db().execute(sql`
      INSERT INTO product_successors (product_id, candidate_id, name, price, image, affiliate_url, is_rocket)
      VALUES (${p.id}, ${it.productId}, ${it.name}, ${it.price}, ${it.image}, ${it.affiliateUrl}, ${it.isRocket})
      ON CONFLICT (product_id, candidate_id) DO UPDATE SET name = excluded.name, price = excluded.price, image = excluded.image,
        affiliate_url = excluded.affiliate_url, is_rocket = excluded.is_rocket, found_at = now()`);
}

/**
 * 판매종료 의심: 재확인 검색에서 사흘 연속(ENDED_MISSES번) 못 찾았고, 그 뒤로 다른 경로(검색·베스트)에서도 갱신된 적 없는 상품.
 * 쿠팡 API 로는 '판매 종료'를 직접 알 수 없어서 이렇게 추정 → 매일 대신 7일에 한 번만 다시 찾아봄 (호출 절약).
 * 다른 경로에서 다시 잡히거나 재확인에서 찾으면 자동으로 해제됨.
 */
const ENDED_MISSES = 3;
const ENDED = sql`(coalesce(t.misses, 0) >= ${ENDED_MISSES} AND t.tried_at > p.updated_at)`;
async function ensureTries() {
  await db().execute(sql`CREATE TABLE IF NOT EXISTS refresh_tries (id text PRIMARY KEY, tried_at timestamptz NOT NULL)`);
  await db().execute(sql`ALTER TABLE refresh_tries ADD COLUMN IF NOT EXISTS misses int NOT NULL DEFAULT 0`);
  await db().execute(sql`ALTER TABLE refresh_tries ADD COLUMN IF NOT EXISTS optdiff int NOT NULL DEFAULT 0`);
}

/**
 * 옵션 갈아타기: 재확인에서 상품은 찾는데 사흘 연속 다른 옵션만 대표로 나오면(예: 1개로 고정했는데 검색엔 늘 2개)
 * 고정한 옵션 가격을 다시 받을 길이 없어 매일 기록이 끊김 → 검색에 나오는 옵션으로 고정을 바꿈.
 *  - 지금까지 가격 기록은 지우지 않고 보관함(price_history_archive)으로 옮김 (옵션 번호와 함께)
 *  - 새 옵션의 그래프는 옵션별 기록(option_price_history, 11/7부터, 검색 API 가격만)과
 *    예전에 이 옵션으로 쌓았다가 보관한 기록으로 다시 채움 → 다른 옵션 가격이 섞이지 않음
 *  - 나중에 원래 옵션이 다시 대표로 나오면 같은 방식으로 되돌아가고, 보관한 기록도 그대로 돌아옴
 *  - 바뀐 내역은 option_changes 에 남김 (12월 배포 때 상품 페이지에 "옵션 변경: ○○ → ○○" 표시용)
 *  - 상품명·구매 링크도 새 옵션으로 (직접 등록 상품은 이름만 유지)
 */
const RELOCK_DAYS = 3;
async function relockOption(
  p: { id: string; name: string; source: string; vendor_item_id: string | null },
  hit: CoupangItem,
) {
  const from = p.vendor_item_id!;
  const to = vendorOf(hit.affiliateUrl)!;
  const manual = p.source === 'manual';
  await db().transaction(async (tx) => {
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS price_history_archive (
      product_id text NOT NULL, vendor_item_id text NOT NULL, price integer NOT NULL, observed_at timestamptz NOT NULL,
      archived_at timestamptz NOT NULL DEFAULT now())`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS option_changes (
      product_id text NOT NULL, from_vendor text NOT NULL, to_vendor text NOT NULL, from_name text, to_name text,
      changed_at timestamptz NOT NULL DEFAULT now())`);
    // 1) 지금 기록 → 보관함 (원래 옵션 번호로)
    await tx.execute(sql`
      INSERT INTO price_history_archive (product_id, vendor_item_id, price, observed_at)
      SELECT product_id, ${from}, price, observed_at FROM price_history WHERE product_id = ${p.id}`);
    await tx.execute(sql`DELETE FROM price_history WHERE product_id = ${p.id}`);
    // 2) 새 옵션 기록으로 다시 채움: 보관했던 이 옵션 기록 + 옵션별 기록(검색 API) → 가격이 바뀐 시점만
    await tx.execute(sql`
      INSERT INTO price_history (product_id, price, observed_at)
      SELECT ${p.id}, price, observed_at FROM (
        SELECT price, observed_at, lag(price) OVER (ORDER BY observed_at) AS before FROM (
          SELECT price, observed_at FROM price_history_archive WHERE product_id = ${p.id} AND vendor_item_id = ${to}
          UNION ALL
          SELECT price, observed_at FROM option_price_history
          WHERE product_id = ${p.id} AND vendor_item_id = ${to} AND source IN ('search', 'refresh')
        ) x
      ) y WHERE before IS NULL OR before <> price`);
    await tx.execute(sql`DELETE FROM price_history_archive WHERE product_id = ${p.id} AND vendor_item_id = ${to}`);
    // 3) 상품 정보: 옵션 고정·링크·이름, 최저·최고는 새 기록 기준 (없으면 지금 가격) — 이어서 평소처럼 가격 저장
    await tx.execute(sql`
      UPDATE products SET vendor_item_id = ${to}, affiliate_url = ${hit.affiliateUrl},
        name = ${manual ? p.name : hit.name}, prev_price = NULL,
        current_price = coalesce((SELECT price FROM price_history WHERE product_id = ${p.id} ORDER BY observed_at DESC LIMIT 1), ${hit.price}),
        lowest_price = coalesce((SELECT min(price) FROM price_history WHERE product_id = ${p.id}), ${hit.price}),
        highest_price = coalesce((SELECT max(price) FROM price_history WHERE product_id = ${p.id}), ${hit.price})
      WHERE id = ${p.id}`);
    await tx.execute(sql`
      INSERT INTO option_changes (product_id, from_vendor, to_vendor, from_name, to_name)
      VALUES (${p.id}, ${from}, ${to}, ${p.name}, ${hit.name})`);
    await tx.execute(sql`UPDATE refresh_tries SET optdiff = 0 WHERE id = ${p.id}`);
  });
}

// products.search_terms 컬럼이 없으면 추가 (한 번만 실제로 실행됨)
async function ensureSearchTermsColumn() {
  await db().execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS search_terms text`);
}

/**
 * 오래 확인 못 한 상품 다시 확인 (매시간, 검색 수집 뒤).
 * 쿠팡 API 에는 '상품번호로 지금 가격 조회'가 없어서, 상품 이름으로 검색해 같은 상품번호를 찾아 가격을 갱신.
 * 베스트 순위·검색 상위에서 빠진 상품도 이렇게 하루~며칠에 한 번은 가격을 확인하게 됨.
 * 목표: 모든 상품을 매일 한 번은 가격 확인 (사이트의 1순위 — 하루 단위 기록이 빠짐없이 쌓여야 함).
 * 20시간 넘게 확인 못 한 상품이 대상, 같은 상품은 20시간에 한 번만 시도.
 */
export async function refreshStale(budget = Number(process.env.COUPANG_REFRESH_PER_RUN ?? 30)) {
  // budget = 이번 시간에 쓸 검색 호출 수 (상품 하나에 1~2번)
  const result = { tried: 0, found: 0, updated: 0, relocked: 0, calls: 0, errors: [] as string[] };
  if (budget <= 0 || !hasCoupangKeys() || (await cooldownUntil())) return result;
  await ensureTries();
  // 직접 등록 상품(manual)도 포함 — 이름·이미지·직접 넣은 링크는 그대로 두고 가격만 갱신
  const stale = (await db().execute(sql`
    SELECT p.id, p.name, p.image, p.source, p.category_id, p.category_label, p.current_price, p.vendor_item_id,
      coalesce(t.optdiff, 0) AS optdiff, (t.tried_at IS NOT NULL AND t.tried_at > p.updated_at) AS untouched
    FROM products p
    LEFT JOIN refresh_tries t ON t.id = p.id
    WHERE p.updated_at < now() - interval '20 hours'
      AND (t.tried_at IS NULL OR t.tried_at < now() - interval '20 hours')
      AND NOT (${ENDED} AND t.tried_at > now() - interval '7 days')
    ORDER BY p.updated_at ASC LIMIT ${budget}`)) as unknown as {
    id: string;
    name: string;
    image: string;
    source: string;
    category_id: string;
    category_label: string;
    current_price: number;
    vendor_item_id: string | null;
    optdiff: number;
    untouched: boolean; // 지난 재확인 뒤로 다른 경로에서도 갱신된 적 없음 (연속 횟수 셀 때 사용)
  }[];

  for (const p of stale) {
    if (result.calls >= budget) break;
    // 이름 앞부분(쉼표 앞, 괄호 뺀 6단어·40자 안쪽)으로 검색 → 못 찾으면 이름 전체로 한 번 더
    const short = p.name.split(',')[0].replace(/[(\[][^)\]]*[)\]]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ').slice(0, 40);
    const full = p.name.replace(/\s+/g, ' ').trim().slice(0, 50); // 쿠팡 검색어 최대 50자
    result.tried++;
    await db().execute(sql`
      INSERT INTO refresh_tries (id, tried_at) VALUES (${p.id}, now())
      ON CONFLICT (id) DO UPDATE SET tried_at = now()`);
    try {
      result.calls++;
      const seen: CoupangItem[] = [...((await searchProducts(short)) ?? [])];
      let hit = seen.find((it) => it.productId === p.id);
      let complete = full === short; // 두 검색어를 다 써봤는지 (예산이 모자라 한 번만 찾았으면 '못 찾음'으로 안 셈)
      if (!hit && full !== short && result.calls < budget) {
        complete = true;
        result.calls++;
        await sleep(1200);
        const more = (await searchProducts(full)) ?? [];
        seen.push(...more);
        hit = more.find((it) => it.productId === p.id);
      }
      // 못 찾았으면 같은 검색 결과에서 '지금 판매 중인 같은 상품' 후보를 저장 (추가 호출 없음, 화면 표시는 12월)
      if (!hit && complete) await saveSuccessors(p, seen).catch(() => {});
      // 연속으로 못 찾은 횟수 (찾으면 0으로 — 옵션이 달라 가격을 안 바꾼 경우도 '판매 중'으로 봄)
      if (hit || complete)
        await db().execute(sql`UPDATE refresh_tries SET misses = ${hit ? sql`0` : sql`misses + 1`}, optdiff = 0 WHERE id = ${p.id}`);
      if (hit) {
        result.found++;
        await recordOptions([{ ...hit, from: 'refresh' }]).catch(() => {});
        const row = { ...hit, categoryId: p.category_id, categoryLabel: p.category_label };
        let { price } = await splitByVendor([row]);
        if (!price.length) {
          // 찾았지만 고정한 옵션이 아님 → 연속 일수 세기, 사흘째면 검색에 나오는 옵션으로 갈아타기
          const days = p.untouched ? p.optdiff + 1 : 1;
          await db().execute(sql`UPDATE refresh_tries SET optdiff = ${days} WHERE id = ${p.id}`);
          if (days >= RELOCK_DAYS && p.vendor_item_id && vendorOf(hit.affiliateUrl)) {
            await relockOption(p, hit);
            price = [row];
            result.relocked++;
          }
        }
        if (price.length) {
          const manual = p.source === 'manual';
          const r = await upsertProducts([
            {
              productId: hit.productId,
              name: manual ? p.name : hit.name,
              image: manual ? p.image : hit.image,
              price: hit.price,
              categoryId: p.category_id,
              categoryLabel: p.category_label,
              affiliateUrl: manual ? undefined : hit.affiliateUrl, // 직접 넣은 파트너스 링크 유지
              isRocket: hit.isRocket,
              source: 'search', // 'search' 는 기존 수집경로·순위·카테고리를 유지함
            },
          ]);
          await rememberVendor(price);
          result.updated += r.upserted;
        }
      }
    } catch (e) {
      result.errors.push(`refresh ${p.id}: ${(e as Error).message}`);
      if (isLimitError(e)) {
        await startCooldown((e as Error).message);
        break;
      }
    }
    await sleep(1200);
  }
  return result;
}
