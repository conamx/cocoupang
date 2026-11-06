/**
 * 1회성 정리 (2026-11-06 #2): 같은 상품의 다른 옵션 가격이 섞여 기록된 문제 정리.
 *
 * 대상: 오늘(한국 11/6) 가격이 2가지 이상 기록된 상품 + 지금 골드박스 상품(골드박스 API 는 다른 옵션 가격을 줌)
 *  - 오늘 기록을 지우고, 어제까지 기록이 있으면 현재가를 그 마지막 가격으로 되돌림
 *  - 오늘 처음 들어온 상품이면 오늘 마지막 기록 하나만 남김
 *  - 최저·최고·전일가 다시 계산, 추적 옵션(vendor_item_id)은 비워 둠 → 다음 수집 때 다시 고정
 * apply=false 면 개수만 출력.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

const TODAY = sql`'2026-11-05T15:00:00Z'::timestamptz`; // 한국 11/6 0시

export async function repairOptions(apply: boolean) {
  const d = db();
  const q = async <T,>(s: ReturnType<typeof sql>) => (await d.execute(s)) as unknown as T[];
  const targets = sql`(
    SELECT h.product_id AS id FROM price_history h WHERE h.observed_at >= ${TODAY}
    GROUP BY h.product_id HAVING count(DISTINCT h.price) > 1
    UNION SELECT id FROM products WHERE source = 'goldbox'
  )`;
  const [c] = await q<{ products: number; withOld: number; todayRows: number }>(sql`
    SELECT count(*)::int AS products,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM price_history h WHERE h.product_id = t.id AND h.observed_at < ${TODAY}))::int AS "withOld",
      (SELECT count(*)::int FROM price_history h WHERE h.product_id IN (SELECT id FROM ${targets} x) AND h.observed_at >= ${TODAY}) AS "todayRows"
    FROM ${targets} t`);
  const sample = await q<{ name: string; prices: string; current: number }>(sql`
    SELECT left(p.name, 28) AS name, p.current_price AS current,
      string_agg(h.price::text || '@' || to_char(h.observed_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'), ' ' ORDER BY h.observed_at) AS prices
    FROM products p JOIN price_history h ON h.product_id = p.id
    WHERE p.id IN (SELECT id FROM ${targets} x) AND h.observed_at >= ${TODAY} - interval '3 days'
    GROUP BY p.id, p.name, p.current_price ORDER BY p.name LIMIT 8`);
  const report = { apply, ...c, sample };
  if (!apply) return report;

  await d.transaction(async (tx) => {
    await tx.execute(sql`CREATE TEMP TABLE fix_opt ON COMMIT DROP AS SELECT DISTINCT id FROM ${targets} x`);
    // 어제까지 기록이 있는 상품: 오늘 기록 삭제
    await tx.execute(sql`
      DELETE FROM price_history h USING fix_opt f
      WHERE h.product_id = f.id AND h.observed_at >= ${TODAY}
        AND EXISTS (SELECT 1 FROM price_history o WHERE o.product_id = f.id AND o.observed_at < ${TODAY})`);
    // 오늘 처음 들어온 상품: 오늘 마지막 기록 하나만 남김
    await tx.execute(sql`
      DELETE FROM price_history h USING fix_opt f
      WHERE h.product_id = f.id AND h.observed_at < (SELECT max(observed_at) FROM price_history m WHERE m.product_id = f.id)
        AND NOT EXISTS (SELECT 1 FROM price_history o WHERE o.product_id = f.id AND o.observed_at < ${TODAY})`);
    await tx.execute(sql`
      UPDATE products p SET
        current_price = s.last_price, lowest_price = s.min_price, highest_price = s.max_price,
        prev_price = s.prev_price, vendor_item_id = NULL
      FROM (
        SELECT h.product_id,
          (array_agg(h.price ORDER BY h.observed_at DESC))[1] AS last_price,
          min(h.price) AS min_price, max(h.price) AS max_price,
          (array_agg(h.price ORDER BY h.observed_at DESC) FILTER (WHERE h.observed_at < ${TODAY}))[1] AS prev_price
        FROM price_history h JOIN fix_opt f ON f.id = h.product_id GROUP BY h.product_id
      ) s
      WHERE p.id = s.product_id`);
  });
  return { ...report, done: true };
}
