import { sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { fetchBestCategory, fetchGoldbox, hasCoupangKeys, searchProducts, type CoupangItem } from '@/lib/coupang';
import { coupangCategories, etcCategory } from '@/lib/site';
import { searchKeywords } from './keywords';
import { upsertProducts } from './upsert';

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

export async function syncCoupang(): Promise<CoupangSyncResult> {
  const result: CoupangSyncResult = { collected: 0, upserted: 0, historyAdded: 0, bySource: {}, errors: [] };
  if (!hasCoupangKeys()) return { ...result, skipped: '쿠팡 파트너스 키 미설정' };

  // 카테고리당 베스트 상품 수 (API 최대 100)
  const bestLimit = Number(process.env.COUPANG_BEST_LIMIT ?? 100);
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
  for (const c of coupangCategories.filter((x) => /^\d+$/.test(x.id))) {
    try {
      add((await fetchBestCategory(c.id, bestLimit)) ?? [], 'best', () => c);
    } catch (e) {
      result.errors.push(`best ${c.label}: ${(e as Error).message}`);
    }
    await sleep(300);
  }

  // 2) 골드박스  (키워드 검색은 syncCoupangSearch 가 매시간 따로 돌림)
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

  // 어제 골드박스였던 상품은 일반 상품으로 내림 (오늘 목록으로 교체)
  const p = schema.products;
  if (goldboxOk) await db().update(p).set({ source: 'best' }).where(sql`${p.source} = 'goldbox'`);

  const r = await upsertProducts(
    all.map((x) => ({
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
  result.upserted = r.upserted;
  result.historyAdded = r.historyAdded;

  return result;
}

/**
 * 인기 키워드 검색 수집 (매시간, 핫딜 수집과 같은 Actions 실행에서 돌림).
 * 검색 API는 시간당 호출 제한이 있어 한 번에 COUPANG_SEARCH_PER_RUN 개(기본 10)만.
 * 이미 있는 상품은 가격만 갱신하고 카테고리·순위·골드박스 여부는 그대로 둡니다.
 */
export async function syncCoupangSearch(): Promise<CoupangSyncResult & { keywords: string[] }> {
  const perRun = Number(process.env.COUPANG_SEARCH_PER_RUN ?? 10);
  const ks = keywordsForThisHour(perRun);
  const result = { collected: 0, upserted: 0, historyAdded: 0, bySource: {}, errors: [] as string[], keywords: ks.map((k) => k.keyword) };
  if (!hasCoupangKeys()) return { ...result, skipped: '쿠팡 파트너스 키 미설정' };

  const rows = new Map<string, Row>();
  for (const k of ks) {
    try {
      for (const it of (await searchProducts(k.keyword)) ?? []) {
        if (!rows.has(it.productId)) rows.set(it.productId, { ...it, rank: undefined, source: 'search', categoryId: k.categoryId, categoryLabel: labelOf(k.categoryId) });
      }
    } catch (e) {
      result.errors.push(`search ${k.keyword}: ${(e as Error).message}`);
    }
    await sleep(1000);
  }

  const all = [...rows.values()];
  result.collected = all.length;
  if (all.length === 0) return result;
  const r = await upsertProducts(
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
  );
  result.upserted = r.upserted;
  result.historyAdded = r.historyAdded;
  return result;
}
