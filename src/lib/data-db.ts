import { and, desc, eq, gt, ilike, lte, ne, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { Deal, Post, Product } from '@/lib/types';
import type { ProductSections } from '@/lib/data';
import { coupangCategories, etcCategory } from '@/lib/site';

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
      db().select().from(P).where(eq(P.id, id)).limit(1),
      db()
        .select()
        .from(schema.priceHistory)
        .where(eq(schema.priceHistory.productId, id))
        .orderBy(schema.priceHistory.observedAt),
    ]);
    return rows[0] ? toProduct(rows[0], hist) : null;
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
  async getProductIndex() {
    const rows = await db().select({ id: P.id, name: P.name, updatedAt: P.updatedAt }).from(P);
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
    const [products, deals, posts] = await Promise.all([
      db().select().from(P).where(ilike(P.name, like)).orderBy(...byRank).limit(60),
      db().select().from(schema.deals).where(ilike(schema.deals.title, like)),
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
      products: products.map((r) => toProduct(r)),
      deals: deals.map(toDeal),
      posts: posts.map(toPost),
    };
  },
};
