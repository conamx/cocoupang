import { sql } from 'drizzle-orm';
import { db, withDbTimeout } from '@/db/client';

// 서버 상태 점검 (오라클 서버의 자동 점검이 5분마다 부름): DB 까지 실제로 다녀오는지 확인.
// 응답이 없거나 503 이면 서버 쪽 스크립트가 사이트를 재시작함.
export const dynamic = 'force-dynamic';

export async function GET() {
  if ((process.env.DATA_SOURCE ?? 'seed') !== 'db') return Response.json({ ok: true, db: 'seed' });
  const t = Date.now();
  try {
    await withDbTimeout(db().execute(sql`select 1`), 'health', 10000);
    return Response.json({ ok: true, ms: Date.now() - t }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ ok: false, ms: Date.now() - t }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
