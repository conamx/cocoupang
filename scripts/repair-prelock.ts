/**
 * 1회성 정리 (2026-11-07): 옵션 고정(11/6 18:53 KST) 전에 다른 옵션 가격이 섞여 들어간 상품 정리.
 * 예) 무: 11/6 3,060원(2개 옵션) → 11/7 1,580원(1개 옵션)
 * 기준: 옵션 고정 전 기록 가격이 고정 후 첫 기록과 30% 이상 차이 나면 고정 전 기록을 지우고 최저·최고·전일가 재계산.
 * (하루 사이 실제 가격이 30% 넘게 바뀌는 경우는 드묾 — 대부분 1개/2개 같은 옵션 차이)
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

const LOCK = sql`'2026-11-06T09:00:00Z'::timestamptz`;

export async function repairPrelock(apply: boolean) {
  const d = db();
  const q = async <T,>(s: ReturnType<typeof sql>) => (await d.execute(s)) as unknown as T[];
  const targets = sql`(
    SELECT f.product_id AS id FROM (
      SELECT DISTINCT ON (product_id) product_id, price FROM price_history WHERE observed_at >= ${LOCK} ORDER BY product_id, observed_at
    ) f
    JOIN price_history h ON h.product_id = f.product_id AND h.observed_at < ${LOCK}
    GROUP BY f.product_id
    HAVING max(abs(h.price - f.price)::float / f.price) >= 0.3
  )`;
  const [c] = await q<{ products: number }>(sql`SELECT count(*)::int AS products FROM ${targets} t`);
  const sample = await q<{ name: string; prices: string }>(sql`
    SELECT left(p.name, 26) AS name,
      string_agg(h.price::text || '@' || to_char(h.observed_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'), ' ' ORDER BY h.observed_at) AS prices
    FROM products p JOIN price_history h ON h.product_id = p.id
    WHERE p.id IN (SELECT id FROM ${targets} x) GROUP BY p.id, p.name ORDER BY p.name LIMIT 10`);
  if (!apply) return { apply, ...c, sample };
  await d.transaction(async (tx) => {
    await tx.execute(sql`CREATE TEMP TABLE fix_pre ON COMMIT DROP AS SELECT id FROM ${targets} x`);
    await tx.execute(sql`DELETE FROM price_history h USING fix_pre f WHERE h.product_id = f.id AND h.observed_at < ${LOCK}`);
    await tx.execute(sql`
      UPDATE products p SET lowest_price = s.lo, highest_price = s.hi, prev_price = NULL
      FROM (SELECT h.product_id, min(h.price) AS lo, max(h.price) AS hi FROM price_history h JOIN fix_pre f ON f.id = h.product_id GROUP BY h.product_id) s
      WHERE p.id = s.product_id`);
  });
  return { apply, ...c, sample, done: true };
}
