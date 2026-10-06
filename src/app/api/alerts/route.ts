import { NextRequest } from 'next/server';
import { db, schema, useDb } from '@/db/client';

// 가격 알림 등록. 목표가 이하로 떨어지면 알림(크론에서 발송 처리 — Phase 4b).
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    productId?: string;
    targetPrice?: number;
    channel?: string;
    destination?: string;
  };
  const { productId, targetPrice, channel, destination } = body;
  if (!productId || !targetPrice || !channel || !destination) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  if (channel !== 'email' && channel !== 'push') {
    return Response.json({ error: 'invalid channel' }, { status: 400 });
  }
  if (!useDb()) return Response.json({ ok: true, demo: true });

  await db().insert(schema.priceAlerts).values({
    productId,
    targetPrice,
    channel,
    destination,
  });
  return Response.json({ ok: true });
}
