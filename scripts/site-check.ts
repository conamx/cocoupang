/**
 * 사이트 데이터 점검 (읽기만 함): 배포 전에 사이트가 쓰는 DB 조회(src/lib/data-db.ts)를 실제 DB 로 한 번씩 돌려 봄.
 * 새 조회(판매종료 숨기기·옵션 가격 등)에 SQL 오류가 있으면 배포 전에 여기서 걸림.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { dbData } from '@/lib/data-db';
import { unitPrice } from '@/lib/unit-price';

export async function siteCheck() {
  const out: Record<string, unknown> = {};
  const t = async <T,>(name: string, f: () => Promise<T>, show: (v: T) => unknown) => {
    const s = Date.now();
    try {
      const v = await f();
      out[name] = { ok: true, ms: Date.now() - s, ...((show(v) as object) ?? {}) };
    } catch (e) {
      out[name] = { ok: false, error: (e as Error).message.slice(0, 300) };
    }
  };
  await t('홈 섹션', () => dbData.getProductSections(12, 6), (v) => ({ goldbox: v.goldbox.length, lowest: v.lowest.length, drops: v.drops.length, cats: v.byCategory.length }));
  await t('카테고리 수', () => dbData.getCategoryCounts(), (v) => ({ sum: Object.values(v).reduce((a, b) => a + b, 0) }));
  await t('카테고리 목록', () => dbData.getProducts('food', 40, 0), (v) => ({ n: v.length }));
  await t('역대최저가', () => dbData.getSpecialProducts('lowest', 40, 0), (v) => ({ n: v.products.length, total: v.total }));
  await t('사이트맵 상품', () => dbData.getProductIndex(), (v) => ({ n: v.length }));
  await t('검색 계란', () => dbData.search('계란'), (v) => ({ n: v.products.length }));
  await t('품목 계란', () => dbData.getKeywordProducts('계란', 40), (v) => ({ n: v.length }));

  const pick = async (s: ReturnType<typeof sql>) => ((await db().execute(s)) as unknown as { id: string }[])[0]?.id;
  const ids = {
    판매종료: await pick(sql`SELECT p.id FROM products p JOIN refresh_tries t ON t.id = p.id JOIN product_successors s ON s.product_id = p.id WHERE t.misses >= 3 AND t.tried_at > p.updated_at LIMIT 1`).catch(() => undefined),
    옵션변경: await pick(sql`SELECT product_id AS id FROM option_changes ORDER BY changed_at DESC LIMIT 1`).catch(() => undefined),
    옵션여러개: await pick(sql`SELECT product_id AS id FROM product_options WHERE last_seen > now() - interval '7 days' GROUP BY product_id HAVING count(DISTINCT name) >= 3 LIMIT 1`).catch(() => undefined),
  };
  for (const [k, id] of Object.entries(ids)) {
    if (!id) {
      out[`상품 ${k}`] = { ok: true, note: '해당 상품 없음' };
      continue;
    }
    await t(`상품 ${k}`, () => dbData.getProduct(id), (p) => ({
      id,
      name: p?.name.slice(0, 40),
      price: p?.currentPrice,
      unit: p ? unitPrice(p.name, p.currentPrice) : null,
      ended: p?.ended,
      successors: p?.successors?.map((s) => `${s.name.slice(0, 30)} ${s.price} ${s.onSite ? '(사이트)' : '(쿠팡)'}`),
      optionChange: p?.optionChange,
      options: p?.options?.map((o) => `${o.name.slice(-25)} ${o.price}${o.current ? ' ←' : ''}`),
      history: p?.history.length,
    }));
  }
  return out;
}
