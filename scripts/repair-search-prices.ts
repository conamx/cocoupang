/**
 * 1회성 정리 (2026-11-06): 매시간 검색 수집이 베스트·골드박스 상품 가격을 덮어써서 생긴 문제 정리.
 *
 *  1) 베스트·골드박스·직접 등록 상품의 '검색 수집이 남긴 가격 기록' 삭제
 *     (오늘 02:20Z 이후 기록 중, 매일 수집(02:47~02:49Z) 기록을 뺀 나머지)
 *  2) 그 상품들의 현재가·최저가·최고가·전일가를 남은 기록으로 다시 계산
 *  3) 쿠팡이 검색 결과 대신 골드박스 추천을 돌려준 검색어(꼬리표 상품의 절반 이상이 골드박스)는
 *     골드박스 상품에서 그 꼬리표를 뗌
 *
 * apply=false 면 바꿀 개수만 출력 (dry run).
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

const SEARCH_ROWS = sql`
  h.observed_at > '2026-11-06T02:20:00Z'
  AND NOT (h.observed_at BETWEEN '2026-11-06T02:47:00Z' AND '2026-11-06T02:49:00Z')`;

export async function repairSearchPrices(apply: boolean) {
  const d = db();
  const q = async <T,>(s: ReturnType<typeof sql>) => (await d.execute(s)) as unknown as T[];

  const [{ rows, products }] = await q<{ rows: number; products: number }>(sql`
    SELECT count(*)::int AS rows, count(DISTINCT h.product_id)::int AS products
    FROM price_history h JOIN products p ON p.id = h.product_id
    WHERE p.source <> 'search' AND ${SEARCH_ROWS}`);

  // 예시 몇 개 (삭제 전 기록 확인용)
  const sample = await q<{ id: string; name: string; prices: string }>(sql`
    SELECT p.id, left(p.name, 30) AS name, string_agg(h.price::text || '@' || to_char(h.observed_at, 'HH24:MI'), ' ' ORDER BY h.observed_at) AS prices
    FROM products p JOIN price_history h ON h.product_id = p.id
    WHERE p.source <> 'search' AND h.observed_at > '2026-11-05T00:00:00Z'
      AND p.id IN (SELECT h.product_id FROM price_history h JOIN products p2 ON p2.id = h.product_id WHERE p2.source <> 'search' AND ${SEARCH_ROWS} LIMIT 5)
    GROUP BY p.id, p.name`);

  // 골드박스 추천이 섞인 검색어
  const badKeywords = await q<{ keyword: string; total: number; gold: number }>(sql`
    SELECT t AS keyword, count(*)::int AS total, count(*) FILTER (WHERE source = 'goldbox')::int AS gold
    FROM products, unnest(string_to_array(search_terms, '|')) AS t
    WHERE search_terms IS NOT NULL GROUP BY t
    HAVING count(*) >= 4 AND count(*) FILTER (WHERE source = 'goldbox') * 2 >= count(*)`);

  const report = { apply, deleteRows: rows, products, sample, badKeywords };
  if (!apply) return report;

  await d.transaction(async (tx) => {
    // 1) 검색 수집 기록 삭제 (대상 상품 목록을 먼저 잡아 둠)
    await tx.execute(sql`CREATE TEMP TABLE fix_ids ON COMMIT DROP AS
      SELECT DISTINCT h.product_id AS id FROM price_history h JOIN products p ON p.id = h.product_id
      WHERE p.source <> 'search' AND ${SEARCH_ROWS}`);
    await tx.execute(sql`DELETE FROM price_history h USING fix_ids f WHERE h.product_id = f.id AND ${SEARCH_ROWS}`);
    // 2) 남은 기록으로 가격 다시 계산
    await tx.execute(sql`
      UPDATE products p SET
        current_price = s.last_price,
        lowest_price = s.min_price,
        highest_price = s.max_price,
        prev_price = s.prev_price
      FROM (
        SELECT h.product_id,
          (array_agg(h.price ORDER BY h.observed_at DESC))[1] AS last_price,
          min(h.price) AS min_price, max(h.price) AS max_price,
          (array_agg(h.price ORDER BY h.observed_at DESC) FILTER (WHERE h.observed_at < '2026-11-05T15:00:00Z'))[1] AS prev_price
        FROM price_history h JOIN fix_ids f ON f.id = h.product_id
        GROUP BY h.product_id
      ) s
      WHERE p.id = s.product_id`);
    // 3) 골드박스 추천 꼬리표 떼기
    for (const k of badKeywords) {
      await tx.execute(sql`
        UPDATE products SET search_terms = nullif(array_to_string(array_remove(string_to_array(search_terms, '|'), ${k.keyword}::text), '|'), '')
        WHERE source = 'goldbox' AND position(${'|' + k.keyword + '|'}::text in '|' || coalesce(search_terms, '') || '|') > 0`);
    }
  });
  return { ...report, done: true };
}
