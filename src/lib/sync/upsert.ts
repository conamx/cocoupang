import { inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';

/** 상품 저장 공통 입력 — API 수집과 관리자 수동 등록이 같이 씁니다. */
export type UpsertRow = {
  productId: string;
  name: string;
  image: string;
  price: number;
  categoryId: string;
  categoryLabel: string;
  affiliateUrl?: string;
  isRocket?: boolean;
  source: 'best' | 'goldbox' | 'search' | 'manual';
  rank?: number;
};

const P = schema.products;

// 한국 날짜 기준 "어제 이전에 갱신된 상품"이면 현재가를 전일가(prevPrice)로 넘김 → 전일대비 %
const isPrevDay = sql`(${P.updatedAt} AT TIME ZONE 'Asia/Seoul')::date < (now() AT TIME ZONE 'Asia/Seoul')::date`;
// 수동 등록은 API가 채운 값(로켓·순위·수집경로)을 덮어쓰지 않음
const isManual = sql`excluded.source = 'manual'`;

export async function upsertProducts(rows: UpsertRow[]): Promise<{ upserted: number; historyAdded: number }> {
  let upserted = 0;
  let historyAdded = 0;
  const d = db();
  const now = new Date();

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await d
      .insert(P)
      .values(
        chunk.map((r) => ({
          id: r.productId,
          name: r.name,
          image: r.image,
          categoryId: r.categoryId,
          categoryLabel: r.categoryLabel,
          affiliateUrl: r.affiliateUrl ?? null,
          isRocket: r.isRocket ?? false,
          source: r.source,
          rank: r.rank ?? null,
          currentPrice: r.price,
          lowestPrice: r.price,
          highestPrice: r.price,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: P.id,
        set: {
          name: sql`excluded.name`,
          image: sql`excluded.image`,
          affiliateUrl: sql`COALESCE(excluded.affiliate_url, ${P.affiliateUrl})`,
          isRocket: sql`CASE WHEN ${isManual} THEN ${P.isRocket} ELSE excluded.is_rocket END`,
          source: sql`CASE WHEN ${isManual} THEN ${P.source} ELSE excluded.source END`,
          rank: sql`CASE WHEN ${isManual} THEN ${P.rank} ELSE excluded.rank END`,
          // '기타'로 매칭된 경우 기존 카테고리 유지
          categoryId: sql`CASE WHEN excluded.category_id = 'etc' THEN ${P.categoryId} ELSE excluded.category_id END`,
          categoryLabel: sql`CASE WHEN excluded.category_id = 'etc' THEN ${P.categoryLabel} ELSE excluded.category_label END`,
          prevPrice: sql`CASE WHEN ${isPrevDay} THEN ${P.currentPrice} ELSE ${P.prevPrice} END`,
          currentPrice: sql`excluded.current_price`,
          lowestPrice: sql`LEAST(${P.lowestPrice}, excluded.current_price)`,
          highestPrice: sql`GREATEST(${P.highestPrice}, excluded.current_price)`,
          updatedAt: now,
        },
      });
    upserted += chunk.length;

    // 가격 이력: 같은 날 여러 번 저장해도 동일가는 하루 1건만 (20시간 내 동일가는 건너뜀)
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
      historyAdded += fresh.length;
    }
  }
  return { upserted, historyAdded };
}
