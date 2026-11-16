/**
 * 와우가/일반가 가설 확인 (읽기만 함): 같은 옵션·같은 날(한국)에 검색 API(search·refresh) 가격과
 * 베스트·골드박스 API 가격을 비교. 검색이 늘 더 싸면 '검색 = 와우가, 베스트 = 일반가' 가설이 맞음.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

export async function wowCheck() {
  const q = async <T,>(s: ReturnType<typeof sql>) => (await db().execute(s)) as unknown as T[];
  const pairs = sql`
    SELECT h.product_id, h.vendor_item_id, (h.observed_at AT TIME ZONE 'Asia/Seoul')::date AS d,
      min(h.price) FILTER (WHERE h.source IN ('search', 'refresh')) AS s,
      min(h.price) FILTER (WHERE h.source IN ('best', 'goldbox')) AS b
    FROM option_price_history h GROUP BY 1, 2, 3`;
  const [sum] = await q<Record<string, number>>(sql`
    SELECT count(*)::int AS "비교 쌍",
      count(*) FILTER (WHERE s < b)::int AS "검색이 더 쌈",
      count(*) FILTER (WHERE s = b)::int AS "같음",
      count(*) FILTER (WHERE s > b)::int AS "검색이 더 비쌈",
      round(avg((b - s)::float / b * 100) FILTER (WHERE s < b)::numeric, 1)::float AS "더 쌀 때 평균 차이 %"
    FROM (${pairs}) x WHERE s IS NOT NULL AND b IS NOT NULL`);
  const sample = await q<Record<string, unknown>>(sql`
    SELECT left(p.name, 30) AS name, x.d::text AS day, x.s AS "검색", x.b AS "베스트"
    FROM (${pairs}) x JOIN products p ON p.id = x.product_id
    WHERE x.s IS NOT NULL AND x.b IS NOT NULL AND x.s <> x.b ORDER BY x.d DESC LIMIT 12`);
  return { 요약: sum, 예시: sample };
}
