import { NextRequest } from 'next/server';
import { ingestDeals } from '@/lib/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 커뮤니티 핫딜 수집 크론. 스케줄러가 15분 주기로 호출.
// 인증: Authorization: Bearer ${CRON_SECRET}
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await ingestDeals();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
