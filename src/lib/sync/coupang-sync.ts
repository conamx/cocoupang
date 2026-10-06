import { inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { fetchBestCategory, fetchGoldbox, hasCoupangKeys, searchProducts, type CoupangItem } from '@/lib/coupang';
import { coupangCategories, etcCategory } from '@/lib/site';
import { searchKeywords } from './keywords';

/**
 * 쿠팡 상품 수집 + 가격 갱신 (하루 1회).
 *
 * 1) 카테고리별 베스트  2) 키워드 검색(순환)  3) 골드박스 를 받아
 * products 에 upsert(신규 상품은 자동 등록) 하고 price_history 에 오늘 가격을 남깁니다.
 *
 * Netlify 크레딧을 쓰지 않도록 GitHub Actions 에서 `npm run sync:coupang` 으로 실행합니다.
 */

type Source = 'best' | 'goldbox' | 'search';
type Row = CoupangItem & { categoryId: string; categoryLabel: string; source: Source };

export type CoupangSyncResult = {
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

// 오늘 수집할 검색 키워드 (날짜 기준으로 순환)
function todaysKeywords(perRun: number) {
  if (perRun <= 0 || searchKeywords.length === 0) return [];
  const day = Math.floor(Date.now() / 86_400_000);
  const start = (day * perRun) % searchKeywords.length;
  return Array.from({ length: Math.min(perRun, searchKeywords.length) }, (_, i) =>
    searchKeywords[(start + i) % searchKeywords.length],
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function syncCoupang(): Promise<CoupangSyncResult> {
  const result: CoupangSyncResult = { collected: 0, upserted: 0, historyAdded: 0, bySource: {}, errors: [] };
  if (!hasCoupangKeys()) return { ...result, skipped: '쿠팡 파트너스 키 미설정' };

  const bestLimit = Number(process.env.COUPANG_BEST_LIMIT ?? 50);
  const searchPerRun = Number(process.env.COUPANG_SEARCH_PER_RUN ?? 10);
  const rows = new Map<string, Row>();
  const add = (items: CoupangItem[], source: Source, cat: (it: CoupangItem) => { id: string; label: string }) => {
    result.bySource[source] = (result.bySource[source] ?? 0) + items.length;
    for (const it of items) {
      const prev = rows.get(it.productId);
      // 골드박스가 가장 우선(홈 상단 노출), 그다음 베스트 카테고리 정보 유지
      if (prev && source !== 'goldbox') continue;
      const c = prev && prev.categoryId !== etcCategory.id ? { id: prev.categoryId, label: prev.categoryLabel } : cat(it);
      rows.set(it.productId, { ...it, source, categoryId: c.id, categoryLabel: c.label });
    }
  };

  // 1) 카테고리 베스트
  for (const c of coupangCategories) {
    try {
      add((await fetchBestCategory(c.id, bestLimit)) ?? [], 'best', () => c);
    } catch (e) {
      result.errors.push(`best ${c.label}: ${(e as Error).message}`);
    }
    await sleep(300);
  }

  // 2) 키워드 검색 (호출 제한 때문에 하루 몇 개씩 순환)
  for (const k of todaysKeywords(searchPerRun)) {
    try {
      add((await searchProducts(k.keyword)) ?? [], 'search', () => ({ id: k.categoryId, label: labelOf(k.categoryId) }));
    } catch (e) {
      result.errors.push(`search ${k.keyword}: ${(e as Error).message}`);
    }
    await sleep(1000);
  }

  // 3) 골드박스
  let goldboxOk = false;
  try {
    add((await fetchGoldbox()) ?? [], 'goldbox', (it) => matchCategory(it.categoryName));
    goldboxOk = true;
  } catch (e) {
    result.errors.push(`goldbox: ${(e as Error).message}`);
  }

  const all = [...rows.values()];
  result.collected = all.length;
  if (all.length === 0) return result;

  const d = db();
  const p = schema.products;

  // 어제 골드박스였던 상품은 일반 상품으로 내림 (오늘 목록으로 교체)
  if (goldboxOk) await d.update(p).set({ source: 'best' }).where(sql`${p.source} = 'goldbox'`);

  const now = new Date();
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100);
    await d
      .insert(p)
      .values(
        chunk.map((r) => ({
          id: r.productId,
          name: r.name,
          image: r.image,
          categoryId: r.categoryId,
          categoryLabel: r.categoryLabel,
          affiliateUrl: r.affiliateUrl,
          isRocket: r.isRocket,
          source: r.source,
          rank: r.rank ?? null,
          currentPrice: r.price,
          lowestPrice: r.price,
          highestPrice: r.price,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: p.id,
        set: {
          name: sql`excluded.name`,
          image: sql`excluded.image`,
          affiliateUrl: sql`excluded.affiliate_url`,
          isRocket: sql`excluded.is_rocket`,
          source: sql`excluded.source`,
          rank: sql`excluded.rank`,
          // '기타'로 매칭된 경우 기존 카테고리 유지
          categoryId: sql`CASE WHEN excluded.category_id = 'etc' THEN ${p.categoryId} ELSE excluded.category_id END`,
          categoryLabel: sql`CASE WHEN excluded.category_id = 'etc' THEN ${p.categoryLabel} ELSE excluded.category_label END`,
          // 가격이 바뀐 경우에만 직전가 갱신 → 하락률 계산
          prevPrice: sql`CASE WHEN ${p.currentPrice} <> excluded.current_price THEN ${p.currentPrice} ELSE ${p.prevPrice} END`,
          currentPrice: sql`excluded.current_price`,
          lowestPrice: sql`LEAST(${p.lowestPrice}, excluded.current_price)`,
          highestPrice: sql`GREATEST(${p.highestPrice}, excluded.current_price)`,
          updatedAt: now,
        },
      });
    result.upserted += chunk.length;

    // 가격 이력: 같은 날 여러 번 돌려도 하루 1건만 (20시간 내 동일가는 건너뜀)
    const ids = chunk.map((r) => r.productId);
    const recent = await d
      .select({ productId: schema.priceHistory.productId, price: schema.priceHistory.price })
      .from(schema.priceHistory)
      .where(
        sql`${inArray(schema.priceHistory.productId, ids)} AND ${schema.priceHistory.observedAt} > now() - interval '20 hours'`,
      );
    const seen = new Set(recent.map((h) => `${h.productId}:${h.price}`));
    const fresh = chunk.filter((r) => !seen.has(`${r.productId}:${r.price}`));
    if (fresh.length) {
      await d
        .insert(schema.priceHistory)
        .values(fresh.map((r) => ({ productId: r.productId, price: r.price, observedAt: now })));
      result.historyAdded += fresh.length;
    }
  }

  return result;
}
