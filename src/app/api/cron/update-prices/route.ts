import { NextRequest } from 'next/server';
import { getProducts } from '@/lib/data';
import { fetchProductPrice } from '@/lib/coupang';

// 가격 추적 크론. 외부 스케줄러(Vercel Cron 등)가 1일 1회 호출합니다.
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
    // 운영(DATA_SOURCE=db): price_history insert + products.current/lowest/highest 갱신
    //   await db.insert(priceHistory).values({ productId: p.id, price, observedAt: new Date() });
    //   await recomputeStats(p.id);
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
