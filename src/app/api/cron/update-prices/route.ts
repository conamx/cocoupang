import { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getProducts } from '@/lib/data';
import { fetchProductPrice } from '@/lib/coupang';
import { db, schema, useDb } from '@/db/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 가격 추적 크론. 외부 스케줄러가 1일 1회 호출.
// 인증: Authorization: Bearer ${CRON_SECRET}
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const products = await getProducts();
  let updated = 0;

  for (const p of products) {
    const price = await fetchProductPrice(p.id);
    if (price == null) continue;

    if (useDb()) {
      const d = db();
      await d.insert(schema.priceHistory).values({
        productId: p.id,
        price,
        observedAt: new Date(),
      });
      // 현재가/역대최저/최고 재계산
      await d
        .update(schema.products)
        .set({
          currentPrice: price,
          lowestPrice: sql`LEAST(${schema.products.lowestPrice}, ${price})`,
          highestPrice: sql`GREATEST(${schema.products.highestPrice}, ${price})`,
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, p.id));
    }
    updated++;
  }

  return Response.json({
    ok: true,
    mode: process.env.DATA_SOURCE ?? 'seed',
    tracked: products.length,
    updated,
    note: updated === 0 ? '쿠팡 파트너스 키 미설정 — 시드 모드' : undefined,
  });
}
