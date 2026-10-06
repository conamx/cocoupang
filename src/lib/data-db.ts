import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { Deal, Post, Product } from '@/lib/types';

// DATA_SOURCE=db 일 때 사용하는 Postgres 구현.
// data.ts 가 플래그에 따라 이 모듈 또는 시드를 선택합니다.

async function withHistory(rows: (typeof schema.products.$inferSelect)[]): Promise<Product[]> {
  if (rows.length === 0) return [];
  const d = db();
  const out: Product[] = [];
  for (const r of rows) {
    const hist = await d
      .select()
      .from(schema.priceHistory)
      .where(eq(schema.priceHistory.productId, r.id))
      .orderBy(schema.priceHistory.observedAt);
    out.push(toProduct(r, hist));
  }
  return out;
}

function toProduct(r: typeof schema.products.$inferSelect, hist: (typeof schema.priceHistory.$inferSelect)[]): Product {
  return {
    id: r.id,
    name: r.name,
    image: r.image,
    categoryId: r.categoryId,
    categoryLabel: r.categoryLabel,
    option: r.option ?? undefined,
    vendorItemId: r.vendorItemId ?? undefined,
    currentPrice: r.currentPrice,
    lowestPrice: r.lowestPrice,
    highestPrice: r.highestPrice,
    updatedAt: r.updatedAt.toISOString(),
    history: hist.map((h) => ({ price: h.price, observedAt: h.observedAt.toISOString() })),
  };
}

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
  async getProducts(categoryId?: string): Promise<Product[]> {
    const rows = await db()
      .select()
      .from(schema.products)
      .where(categoryId ? eq(schema.products.categoryId, categoryId) : undefined)
      .orderBy(desc(schema.products.updatedAt));
    return withHistory(rows);
  },
  async getProduct(id: string): Promise<Product | null> {
    const rows = await db().select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
    return rows[0] ? (await withHistory(rows))[0] : null;
  },
  async getRelatedProducts(id: string, limit = 5): Promise<Product[]> {
    const p = await this.getProduct(id);
    if (!p) return [];
    const rows = await db()
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.categoryId, p.categoryId)))
      .limit(limit + 1);
    return (await withHistory(rows)).filter((x) => x.id !== id).slice(0, limit);
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
    const rows = await db().select().from(schema.posts).orderBy(desc(schema.posts.date));
    return rows.map(toPost);
  },
  async getPost(slug: string): Promise<Post | null> {
    const rows = await db().select().from(schema.posts).where(eq(schema.posts.slug, slug)).limit(1);
    return rows[0] ? toPost(rows[0]) : null;
  },
  async search(q: string) {
    const like = `%${q}%`;
    const [products, deals, posts] = await Promise.all([
      db().select().from(schema.products).where(ilike(schema.products.name, like)),
      db().select().from(schema.deals).where(ilike(schema.deals.title, like)),
      db()
        .select()
        .from(schema.posts)
        .where(or(ilike(schema.posts.title, like), ilike(schema.posts.summary, like))),
    ]);
    return {
      products: await withHistory(products),
      deals: deals.map(toDeal),
      posts: posts.map(toPost),
    };
  },
};
