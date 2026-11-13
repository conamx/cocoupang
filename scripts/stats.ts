/** 수집 상태 점검 — 상품별 마지막 가격 확인 시점 분포 (읽기만 함) */
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

export async function stats() {
  const q = async <T,>(s: ReturnType<typeof sql>) => (await db().execute(s)) as unknown as T[];
  const [age] = await q<Record<string, number>>(sql`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE updated_at > now() - interval '1 hour')::int AS "1시간 안",
      count(*) FILTER (WHERE updated_at > now() - interval '6 hours')::int AS "6시간 안",
      count(*) FILTER (WHERE updated_at > now() - interval '24 hours')::int AS "24시간 안(정확)",
      count(*) FILTER (WHERE updated_at > now() - interval '26 hours')::int AS "24시간 안",
      count(*) FILTER (WHERE updated_at <= now() - interval '26 hours' AND updated_at > now() - interval '3 days')::int AS "1~3일",
      count(*) FILTER (WHERE updated_at <= now() - interval '3 days' AND updated_at > now() - interval '7 days')::int AS "3~7일",
      count(*) FILTER (WHERE updated_at <= now() - interval '7 days')::int AS "7일 넘음",
      count(*) FILTER (WHERE search_terms IS NOT NULL)::int AS "꼬리표 있음",
      count(*) FILTER (WHERE description IS NOT NULL)::int AS "소개글 있음"
    FROM products`);
  const bySource = await q<{ source: string; n: number; fresh: number }>(sql`
    SELECT source, count(*)::int AS n, count(*) FILTER (WHERE updated_at > now() - interval '26 hours')::int AS fresh
    FROM products GROUP BY source ORDER BY n DESC`);
  const days = await q<{ days: number; n: number }>(sql`
    SELECT d AS days, count(*)::int AS n FROM (
      SELECT count(DISTINCT (observed_at AT TIME ZONE 'Asia/Seoul')::date) AS d FROM price_history GROUP BY product_id
    ) t GROUP BY d ORDER BY d`);
  const [hist] = await q<{ rows: number; mb: number }>(sql`
    SELECT count(*)::int AS rows, round(pg_total_relation_size('price_history') / 1048576.0, 1)::float AS mb FROM price_history`);
  // 재확인에서 사흘 연속 못 찾은 상품 (판매종료 의심 → 7일에 한 번만 재확인). 컬럼이 아직 없으면 0
  const ended = await q<{ n: number; miss1: number; miss2: number; optdiff: number; optdiff3: number }>(sql`
    SELECT count(*) FILTER (WHERE t.misses >= 3 AND t.tried_at > p.updated_at)::int AS n,
      count(*) FILTER (WHERE t.misses = 1 AND t.tried_at > p.updated_at)::int AS miss1,
      count(*) FILTER (WHERE t.misses = 2 AND t.tried_at > p.updated_at)::int AS miss2,
      count(*) FILTER (WHERE t.misses = 0 AND t.tried_at > p.updated_at)::int AS optdiff,
      count(*) FILTER (WHERE t.misses = 0 AND t.tried_at > p.updated_at AND p.updated_at < now() - interval '3 days')::int AS optdiff3
    FROM products p JOIN refresh_tries t ON t.id = p.id`).catch(() => [{ n: 0, miss1: 0, miss2: 0, optdiff: 0, optdiff3: 0 }]);
  const [sw] = await q<{ n: number }>(sql`SELECT count(*) FILTER (WHERE switched_at > now() - interval '24 hours')::int AS n FROM vendor_switches`).catch(() => [{ n: 0 }]);
  const [succ] = await q<{ n: number }>(sql`SELECT count(DISTINCT product_id)::int AS n FROM product_successors`).catch(() => [{ n: 0 }]);
  // 최근 판매자 전환 10건 (가격이 이상하게 튀지 않았는지 눈으로 확인용)
  const swList = await q<Record<string, unknown>>(sql`
    SELECT left(p.name, 40) AS name, s.price AS "전환가", p.current_price AS "지금가", p.lowest_price AS "최저", p.highest_price AS "최고",
      to_char(s.switched_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS at
    FROM vendor_switches s JOIN products p ON p.id = s.product_id ORDER BY s.switched_at DESC LIMIT 10`).catch(() => []);
  const [oc] = await q<{ n: number; all: number }>(sql`
    SELECT count(*) FILTER (WHERE changed_at > now() - interval '24 hours')::int AS n, count(*)::int AS all FROM option_changes`).catch(() => [{ n: 0, all: 0 }]);
  // 같은 상품이 옵션을 여러 번 오가는지 (왔다 갔다 하면 그래프가 자주 끊김)
  const [flip] = await q<{ twice: number; thrice: number }>(sql`
    SELECT count(*) FILTER (WHERE n >= 2)::int AS twice, count(*) FILTER (WHERE n >= 3)::int AS thrice
    FROM (SELECT product_id, count(*) AS n FROM option_changes GROUP BY product_id) x`).catch(() => [{ twice: 0, thrice: 0 }]);
  const ocList = await q<Record<string, unknown>>(sql`
    SELECT left(from_name, 30) AS "전", left(to_name, 30) AS "후", to_char(changed_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS at
    FROM option_changes ORDER BY changed_at DESC LIMIT 10`).catch(() => []);
  const [dbsize] = await q<{ mb: number }>(sql`SELECT round(pg_database_size(current_database()) / 1048576.0, 1)::float AS mb`);
  return { 상품: age, 수집경로별: bySource, '기록된 날 수 분포': days, 가격기록: hist, 'DB 전체 MB': dbsize.mb,
    '판매종료 의심(사흘 연속 못 찾음)': ended[0].n, '하루 못 찾음': ended[0].miss1, '이틀 연속 못 찾음': ended[0].miss2,
    '찾았지만 옵션 달라 못 갱신': ended[0].optdiff, '그중 3일 넘음': ended[0].optdiff3,
    '판매자 자동 전환(24시간)': sw.n, '대체 후보 있는 상품': succ.n, '최근 판매자 전환': swList,
    '옵션 갈아타기(24시간/전체)': `${oc.n}/${oc.all}`, '최근 옵션 갈아타기': ocList, '옵션 2번 이상 바뀐 상품': flip.twice, '3번 이상': flip.thrice };
}
