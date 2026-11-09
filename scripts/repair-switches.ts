/**
 * 1회성 정리 (2026-11-09): 판매자 자동 전환 첫 적용(11/9 23:3x KST) 때 묶음 수가 다른 옵션으로 바뀐 상품 되돌리기.
 * 예) 코멧 종이컵 185ml 5,340원 → 9,990원 (이름에 개수가 없어 같은 이름이라도 다른 옵션)
 * 전환된 상품 전부: 전환 뒤 가격 기록을 지우고, 원래 판매자로 되돌리고, 지금가·최저·최고를 남은 기록으로 다시 계산.
 * 마지막 확인 시각도 남은 기록 기준으로 돌려서 재확인 대상이 되게 함. (구매 링크는 되돌릴 원본이 없어 그대로)
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

export async function repairSwitches(apply: boolean) {
  const d = db();
  const q = async <T,>(s: ReturnType<typeof sql>) => (await d.execute(s)) as unknown as T[];
  const sample = await q<{ name: string; prices: string }>(sql`
    SELECT left(p.name, 26) AS name, min(s.switched_at) AS at,
      string_agg(h.price::text || '@' || to_char(h.observed_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'), ' ' ORDER BY h.observed_at) AS prices
    FROM vendor_switches s JOIN products p ON p.id = s.product_id JOIN price_history h ON h.product_id = p.id
    GROUP BY p.id, p.name ORDER BY p.name`);
  if (!apply) return { apply, products: sample.length, sample };
  await d.transaction(async (tx) => {
    await tx.execute(sql`CREATE TEMP TABLE fix_sw ON COMMIT DROP AS
      SELECT DISTINCT ON (product_id) product_id AS id, from_vendor, switched_at FROM vendor_switches ORDER BY product_id, switched_at`);
    await tx.execute(sql`DELETE FROM price_history h USING fix_sw f WHERE h.product_id = f.id AND h.observed_at >= f.switched_at - interval '1 minute'`);
    await tx.execute(sql`
      UPDATE products p SET vendor_item_id = f.from_vendor, current_price = s.last, lowest_price = s.lo, highest_price = s.hi,
        prev_price = NULL, updated_at = s.at
      FROM fix_sw f, (
        SELECT h.product_id, min(h.price) AS lo, max(h.price) AS hi, max(h.observed_at) AS at,
          (array_agg(h.price ORDER BY h.observed_at DESC))[1] AS last
        FROM price_history h JOIN fix_sw f2 ON f2.id = h.product_id GROUP BY h.product_id) s
      WHERE p.id = f.id AND s.product_id = f.id`);
    await tx.execute(sql`DELETE FROM vendor_switches`);
  });
  return { apply, products: sample.length, sample, done: true };
}
