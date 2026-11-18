import { and, desc, eq, gt, ilike, lte, ne, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { Post, Product, ProductOption, Successor } from '@/lib/types';
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

/**
 * 판매 중인 상품만: 재확인에서 사흘 연속 못 찾고(판매종료 의심) 그 뒤로 어디서도 갱신 안 된 상품은 목록·사이트맵에서 뺌.
 * 상품 페이지는 남김 (가격 기록 + 판매종료 안내). 다시 잡히면 updated_at 이 새로워져 자동으로 목록에 돌아옴.
 * refresh_tries 는 수집 작업이 만드는 표 (schema 밖).
 */
const LIVE = sql`NOT EXISTS (SELECT 1 FROM refresh_tries rt WHERE rt.id = ${P.id} AND rt.misses >= 3 AND rt.tried_at > ${P.updatedAt})`;
const live = (w?: ReturnType<typeof sql> | ReturnType<typeof eq>) => (w ? and(w, LIVE) : LIVE);

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

export type SpecialKind = 'lowest' | 'drops' | 'goldbox';
/** 홈 섹션과 더보기 페이지가 같은 기준을 쓰도록 한 곳에서 정의 */
function specialFilter(kind: SpecialKind) {
  if (kind === 'goldbox') return { where: eq(P.source, 'goldbox'), order: byRank };
  if (kind === 'lowest')
    return {
      // 지금 가격이 기록상 가장 낮고, 가격이 한 번이라도 움직인 상품 → 최고가 대비 많이 내린 순
      where: and(lte(P.currentPrice, P.lowestPrice), gt(P.highestPrice, P.lowestPrice)),
      order: [sql`(${P.highestPrice} - ${P.currentPrice})::float / ${P.highestPrice} DESC`],
    };
  return {
    // 어제보다 내린 상품 → 많이 내린 순
    where: gt(P.prevPrice, P.currentPrice),
    order: [sql`(${P.prevPrice} - ${P.currentPrice})::float / ${P.prevPrice} DESC`],
  };
}

type Q<T> = Promise<T[]>;
const rows = <T,>(s: ReturnType<typeof sql>): Q<T> =>
  (db().execute(s) as unknown as Q<T>).catch(() => [] as T[]); // 수집 작업이 만드는 표 — 없으면 빈 값

/** 상품 페이지 추가 정보: 판매종료 여부·대체 후보·옵션 변경·다른 옵션 가격 (한 번에 동시 조회) */
async function productExtras(p: Product): Promise<Pick<Product, 'ended' | 'successors' | 'optionChange' | 'options'>> {
  const [endedRow, succ, change, opts] = await Promise.all([
    rows<{ ended: boolean }>(sql`
      SELECT (misses >= 3 AND tried_at > ${p.updatedAt}::timestamptz) AS ended FROM refresh_tries WHERE id = ${p.id}`),
    rows<{ id: string; name: string; price: number; image: string | null; url: string | null; rocket: boolean | null; on_site: boolean }>(sql`
      SELECT s.candidate_id AS id, coalesce(pr.name, s.name) AS name, coalesce(pr.current_price, s.price) AS price,
        coalesce(pr.image, s.image) AS image, coalesce(pr.affiliate_url, s.affiliate_url) AS url,
        coalesce(pr.is_rocket, s.is_rocket) AS rocket, pr.id IS NOT NULL AS on_site
      FROM product_successors s LEFT JOIN products pr ON pr.id = s.candidate_id
      WHERE s.product_id = ${p.id} AND s.candidate_id <> ${p.id}
      ORDER BY s.found_at DESC LIMIT 3`),
    rows<{ from_name: string | null; to_name: string | null; at: Date }>(sql`
      SELECT from_name, to_name, changed_at AS at FROM option_changes WHERE product_id = ${p.id} ORDER BY changed_at DESC LIMIT 1`),
    rows<{ name: string; price: number; seen: Date; vid: string; url: string | null }>(sql`
      SELECT name, price, last_seen AS seen, vendor_item_id AS vid, to_jsonb(product_options.*)->>'url' AS url FROM product_options
      WHERE product_id = ${p.id} AND last_seen > now() - interval '7 days' ORDER BY price ASC LIMIT 12`),
  ]);
  const options: ProductOption[] = opts.map((o) => ({
    name: o.name,
    price: o.price,
    seenAt: new Date(o.seen).toISOString(),
    current: !!p.vendorItemId && o.vid === p.vendorItemId,
    url: o.url ?? undefined,
  }));
  const successors: Successor[] = succ.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    image: r.image ?? undefined,
    affiliateUrl: r.url ?? undefined,
    isRocket: !!r.rocket,
    onSite: r.on_site,
  }));
  const c = change[0];
  return {
    ended: !!endedRow[0]?.ended,
    successors,
    optionChange: c && c.from_name && c.to_name ? { from: c.from_name, to: c.to_name, at: new Date(c.at).toISOString() } : undefined,
    options,
  };
}

export const dbData = {
  async getProducts(categoryId?: string, limit?: number, offset = 0): Promise<Product[]> {
    const q = db()
      .select()
      .from(P)
      .where(live(categoryId ? eq(P.categoryId, categoryId) : undefined))
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
    Object.assign(p, await productExtras(p));
    return p;
  },
  // 품목(검색어) 페이지: 그 검색어로 수집된 상품. 지금 역대 최저가인 것 → 인기순 → 최근 갱신순
  async getKeywordProducts(keyword: string, limit = 40): Promise<Product[]> {
    const tag = `|${keyword}|`;
    const rows = await db()
      .select()
      .from(P)
      .where(live(sql`position(${tag}::text in '|' || coalesce(search_terms, '') || '|') > 0`))
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
      .where(and(sql`${P.categoryId} = (SELECT category_id FROM ${cur} c)`, ne(P.id, id), LIVE))
      .orderBy(sql`abs(${P.currentPrice} - (SELECT current_price FROM ${cur} c))`, ...byRank)
      .limit(limit);
    return rows.map((r) => toProduct(r));
  },
  // 특가 목록 (역대최저가·가격하락·골드박스) — 더보기 페이지용
  async getSpecialProducts(kind: SpecialKind, limit: number, offset = 0): Promise<{ products: Product[]; total: number }> {
    const f = specialFilter(kind);
    const [rows, cnt] = await Promise.all([
      db().select().from(P).where(live(f.where)).orderBy(...f.order, P.id).limit(limit).offset(offset),
      db().select({ n: sql<number>`count(*)::int` }).from(P).where(live(f.where)),
    ]);
    return { products: rows.map((r) => toProduct(r)), total: Number(cnt[0]?.n ?? 0) };
  },
  async getProductSections(perSection: number, perCategory: number): Promise<ProductSections> {
    const d = db();
    const gb = specialFilter('goldbox');
    const lo = specialFilter('lowest');
    const dr = specialFilter('drops');
    const [goldbox, lowest, drops, ranked] = await Promise.all([
      d.select().from(P).where(live(gb.where)).orderBy(...gb.order).limit(perSection),
      d.select().from(P).where(live(lo.where)).orderBy(...lo.order).limit(perSection),
      d.select().from(P).where(live(dr.where)).orderBy(...dr.order).limit(perSection),
      // 카테고리별 상위 N개를 한 번에 (서브쿼리라 추가 왕복 없음)
      d
        .select()
        .from(P)
        .where(
          sql`${P.id} IN (
            SELECT id FROM (
              SELECT id, row_number() OVER (PARTITION BY category_id ORDER BY rank ASC NULLS LAST, updated_at DESC) AS rn
              FROM products p
              WHERE NOT EXISTS (SELECT 1 FROM refresh_tries rt WHERE rt.id = p.id AND rt.misses >= 3 AND rt.tried_at > p.updated_at)
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
      .where(LIVE)
      .groupBy(P.categoryId);
    return Object.fromEntries(rows.map((r) => [r.id, r.n])) as Record<string, number>;
  },
  async getProductIndex() {
    const rows = await db().select({ id: P.id, name: P.name, updatedAt: P.updatedAt }).from(P).where(LIVE);
    return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt.toISOString() }));
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
    const [found, posts] = await Promise.all([
      // 이름(동의어 포함) 또는 수집 검색어 꼬리표로 찾기.
      // search_terms 는 수집 스크립트가 만드는 컬럼이라 schema 에는 두지 않고 직접 읽음.
      db()
        .select({ row: P, terms: sql<string | null>`search_terms` })
        .from(P)
        .where(and(or(...terms.map((t) => ilike(P.name, `%${t}%`)), sql`search_terms ILIKE ${like}`), LIVE))
        .orderBy(...byRank)
        .limit(300)
        // 컬럼이 아직 없으면(수집 스크립트가 아직 안 돌았으면) 이름으로만 검색
        .catch(() =>
          db()
            .select({ row: P, terms: sql<string | null>`null` })
            .from(P)
            .where(and(or(...terms.map((t) => ilike(P.name, `%${t}%`))), LIVE))
            .orderBy(...byRank)
            .limit(300),
        ),
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
      posts: posts.map(toPost),
    };
  },
};
