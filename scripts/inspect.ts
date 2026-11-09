/** 점검용: 특정 상품들의 추적 옵션·링크·기록 (읽기만) */
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
export async function inspect() {
  return db().execute(sql`
    SELECT p.id, left(p.name, 30) AS name, left(p.description, 60) AS description, p.source, p.vendor_item_id, left(p.affiliate_url, 160) AS url, p.updated_at,
      (SELECT string_agg(h.price::text || '@' || to_char(h.observed_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'), ' ' ORDER BY h.observed_at) FROM price_history h WHERE h.product_id = p.id) AS prices
    FROM products p WHERE p.description IS NOT NULL ORDER BY random() LIMIT 3`);
}
