import { and, desc, eq, gt, ilike, lte, ne, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { Deal, Post, Product } from '@/lib/types';
import type { ProductSections } from '@/lib/data';
import { coupangCategories, etcCategory } from '@/lib/site';
import { expandQuery } from '@/lib/search-synonyms';

// DATA_SOURCE=db 일 때 사용하는 Postgres 구현.
// data.ts 가 플래그에 따라 이 모듈 또는 시드를 선택합니다.

type ProductRow = typeof schema.products.$inferSelect;

function toProduct(r: ProductRow, hist: (typeof schema.priceHistory.$inferSelect)[] = []): Product {
  return {
    id: r.id,
    name: r.name,
    image: r.image,
    categoryId: r.categoryId,
    categoryLabel: r.categoryLabel,
    option: r.option ?? undefined,
    description: r.description ?? undefined,
    vendorItemId: r.vendorItemId ?? undefined,
    affiliateUrl: r.affiliateUrl ?? undefined,
    isRocket: r.isRocket,
    source: r.source as Product['source'],
    rank: r.rank ?? undefined,
    currentPrice: r.currentPrice,
    prevPrice: r.prevPrice ?? undefined,
    lowestPrice: r.lowestPrice,
    highestPrice: r.highestPrice,
    updatedAt: r.updatedAt.toISOString(),
    history: hist.map((h) => ({ price: h.price, observedAt: h.observedAt.toISOString() })),
  };
}

const P = schema.products;
const byRank = [sql`${P.rank} ASC NULLS LAST`, desc(P.updatedAt)];

function toDeal(r: typeof schema.deals.$inferSelect): Deal {
  return {
    id: r.id,
    title: r.title,
    source: r.source,
    category: r.category,
    price: r.price ?? undefined,
    thumb: r.thumb,
    url: r.url,
    likeCount: r.likeCount,
    postedAt: r.postedAt.toISOString(),
  };
}

function toPost(r: typeof schema.posts.$inferSelect): Post {
  return {
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    category: r.category,
    body: r.body,
    date: r.date.toISOString().slice(0, 10),
  };
}

/**
 * 검색 결과 순서: 사람이 찾는 '그 물건'을 먼저.
 *  1) 쿠팡에서 그 검색어로 수집된 상품(꼬리표 정확히 일치)이나 동의어로 걸린 상품
 *  2) 1)과 같은 카테고리 상품 (예: 계란 → 식품)
 *  3) 이름에 글자만 들어간 다른 상품 (예: 계란찜기)
 * 같은 단계 안에서는 인기순(이미 정렬된 순서) 유지.
 */
function rankSearch(q: string, terms: string[], found: { row: ProductRow; terms: string | null }[]): Product[] {
  const n = q.trim().toLowerCase();
  const syns = terms.slice(1).map((t) => t.toLowerCase());
  const isStrong = (f: (typeof found)[number]) =>
    (f.terms ?? '').toLowerCase().split('|').includes(n) || syns.some((t) => f.row.name.toLowerCase().includes(t));
  const strongCats = new Set(found.filter(isStrong).map((f) => f.row.categoryId));
  const score = (f: (typeof found)[number]) => (isStrong(f) ? 0 : strongCats.has(f.row.categoryId) ? 1 : 2);
  return found
    .map((f, i) => ({ f, i, s: score(f) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map(({ f }) => toProduct(f.row));
}

export const dbData = {
  async getProducts(categoryId?: string, limit?: number, offset = 0): Promise<Product[]> {
    const q = db()
      .select()
      .from(P)
      .where(categoryId ? eq(P.categoryId, categoryId) : undefined)
      .orderBy(...byRank, P.id);
    const rows = limit ? await q.limit(limit).offset(offset) : await q.offset(offset);
    return rows.map((r) => toProduct(r));
  },
  // 상세 페이지: 상품과 가격 이력을 동시에 조회 (DB 왕복 1번)
  async getProduct(id: string): Promise<Product | null> {
    const [rows, hist] = await Promise.all([
      db()
        .select({ row: P, terms: sql<string | null>`search_terms` })
        .from(P)
        .where(eq(P.id, id))
        .limit(1)
        // search_terms 컬럼이 아직 없으면 꼬리표 없이
        .catch(() => db().select({ row: P, terms: sql<string | null>`null` }).from(P).where(eq(P.id, id)).limit(1)),
      db()
        .select()
        .from(schema.priceHistory)
        .where(eq(schema.priceHistory.productId, id))
        .orderBy(schema.priceHistory.observedAt),
    ]);
    if (!rows[0]) return null;
    const p = toProduct(rows[0].row, hist);
    p.searchTerms = (rows[0].terms ?? '').split('|').filter(Boolean);
    return p;
  },
  // 품목(검색어) 페이지: 그 검색어로 수집된 상품. 지금 역대 최저가인 것 → 인기순 → 최근 갱신순
  async getKeywordProducts(keyword: string, limit = 40): Promise<Product[]> {
    const tag = `|${keyword}|`;
    const rows = await db()
      .select()
      .from(P)
      .where(sql`position(${tag}::text in '|' || coalesce(search_terms, '') || '|') > 0`)
      .orderBy(
        sql`(${P.currentPrice} <= ${P.lowestPrice} AND ${P.highestPrice} > ${P.lowestPrice}) DESC`,
        ...byRank,
      )
      .limit(limit)
      .catch(() => []);
    return rows.map((r) => toProduct(r));
  },
  // 검색어별 상품 수 (사이트맵·링크에서 빈 페이지 거르기용)
  async getKeywordCounts(): Promise<Record<string, number>> {
    const rows = (await db()
      .execute(
        sql`SELECT t AS keyword, count(*)::int AS n FROM products, unnest(string_to_array(search_terms, '|')) AS t WHERE search_terms IS NOT NULL GROUP BY t`,
      )
      .catch(() => [])) as unknown as { keyword: string; n: number }[];
    return Object.fromEntries(rows.map((r) => [r.keyword, r.n]));
  },
  // 같은 카테고리에서 가격대가 가까운 순 — 기준 상품을 서브쿼리로 읽어 한 번에
  async getRelatedProducts(id: string, limit = 12): Promise<Product[]> {
    const cur = sql`(SELECT category_id, current_price FROM products WHERE id = ${id})`;
    const rows = await db()
      .select()
      .from(P)
      .where(and(sql`${P.categoryId} = (SELECT category_id FROM ${cur} c)`, ne(P.id, id)))
      .orderBy(sql`abs(${P.currentPrice} - (SELECT current_price FROM ${cur} c))`, ...byRank)
      .limit(limit);
    return rows.map((r) => toProduct(r));
  },
  async getProductSections(perSection: number, perCategory: number): Promise<ProductSections> {
    const d = db();
    const [goldbox, lowest, drops, ranked] = await Promise.all([
      d.select().from(P).where(eq(P.source, 'goldbox')).orderBy(...byRank).limit(perSection),
      d
        .select()
        .from(P)
        .where(and(lte(P.currentPrice, P.lowestPrice), gt(P.highestPrice, P.lowestPrice)))
        .orderBy(sql`(${P.highestPrice} - ${P.currentPrice})::float / ${P.highestPrice} DESC`)
        .limit(perSection),
      d
        .select()
        .from(P)
        .where(gt(P.prevPrice, P.currentPrice))
        .orderBy(sql`(${P.prevPrice} - ${P.currentPrice})::float / ${P.prevPrice} DESC`)
        .limit(perSection),
      // 카테고리별 상위 N개를 한 번에 (서브쿼리라 추가 왕복 없음)
      d
        .select()
        .from(P)
        .where(
          sql`${P.id} IN (
            SELECT id FROM (
              SELECT id, row_number() OVER (PARTITION BY category_id ORDER BY rank ASC NULLS LAST, updated_at DESC) AS rn
              FROM products
            ) t WHERE rn <= ${perCategory}
          )`,
        )
        .orderBy(...byRank),
    ]);
    const top = ranked.map((r) => toProduct(r));
    return {
      goldbox: goldbox.map((r) => toProduct(r)),
      lowest: lowest.map((r) => toProduct(r)),
      drops: drops.map((r) => toProduct(r)),
      byCategory: [...coupangCategories, etcCategory]
        .map((c) => ({ ...c, products: top.filter((p) => p.categoryId === c.id) }))
        .filter((c) => c.products.length > 0),
    };
  },
  async getCategoryCounts() {
    const rows = await db()
      .select({ id: P.categoryId, n: sql<number>`count(*)::int` })
      .from(P)
      .groupBy(P.categoryId);
    return Object.fromEntries(rows.map((r) => [r.id, r.n])) as Record<string, number>;
  },
  // 사이트맵용 — 가격 기록이 2건 이상인 상품만 (갓 들어온 상품은 다음 날부터, 직접 등록 상품은 항상)
  async getProductIndex() {
    const rows = await db()
      .select({ id: P.id, name: P.name, updatedAt: P.updatedAt })
      .from(P)
      .where(sql`${P.source} = 'manual' OR (SELECT count(*) FROM price_history h WHERE h.product_id = ${P.id}) >= 2`);
    return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt.toISOString() }));
  },
  async getDeals(limit?: number): Promise<Deal[]> {
    const q = db().select().from(schema.deals).orderBy(desc(schema.deals.postedAt));
    const rows = limit ? await q.limit(limit) : await q;
    return rows.map(toDeal);
  },
  async getDeal(id: string): Promise<Deal | null> {
    const rows = await db().select().from(schema.deals).where(eq(schema.deals.id, id)).limit(1);
    return rows[0] ? toDeal(rows[0]) : null;
  },
  async getPosts(): Promise<Post[]> {
    const rows = await db()
      .select()
      .from(schema.posts)
      .where(lte(schema.posts.date, new Date()))
      .orderBy(desc(schema.posts.date));
    return rows.map(toPost);
  },
  async getPost(slug: string): Promise<Post | null> {
    const rows = await db()
      .select()
      .from(schema.posts)
      .where(and(eq(schema.posts.slug, slug), lte(schema.posts.date, new Date())))
      .limit(1);
    return rows[0] ? toPost(rows[0]) : null;
  },
  async search(q: string) {
    const like = `%${q}%`;
    const terms = expandQuery(q); // 검색어 + 동의어 (계란 → 달걀·대란·특란…)
    const [found, deals, posts] = await Promise.all([
      // 이름(동의어 포함) 또는 수집 검색어 꼬리표로 찾기.
      // search_terms 는 수집 스크립트가 만드는 컬럼이라 schema 에는 두지 않고 직접 읽음.
      db()
        .select({ row: P, terms: sql<string | null>`search_terms` })
        .from(P)
        .where(or(...terms.map((t) => ilike(P.name, `%${t}%`)), sql`search_terms ILIKE ${like}`))
        .orderBy(...byRank)
        .limit(300)
        // 컬럼이 아직 없으면(수집 스크립트가 아직 안 돌았으면) 이름으로만 검색
        .catch(() =>
          db()
            .select({ row: P, terms: sql<string | null>`null` })
            .from(P)
            .where(or(...terms.map((t) => ilike(P.name, `%${t}%`))))
            .orderBy(...byRank)
            .limit(300),
        ),
      db().select().from(schema.deals).where(ilike(schema.deals.title, like)).orderBy(desc(schema.deals.postedAt)).limit(40),
      db()
        .select()
        .from(schema.posts)
        .where(
          and(
            lte(schema.posts.date, new Date()),
            or(ilike(schema.posts.title, like), ilike(schema.posts.summary, like)),
          ),
        ),
    ]);
    return {
      products: rankSearch(q, terms, found).slice(0, 60),
      deals: deals.map(toDeal),
      posts: posts.map(toPost),
    };
  },
};
