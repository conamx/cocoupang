/**
 * 정보글을 DB 에 넣기 (배포 없이 사이트에 공개 — 발행일이 되면 /blog·사이트맵에 자동으로 나타남).
 * 이미 같은 주소(slug)의 글이 있으면 건드리지 않음.
 * [상품검색:검색어:개수] → 그 검색어로 수집된 상품 ID 로 바꿔 [상품:ID] 카드로.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { drafts } from './posts-2026-11';

async function resolveProducts(body: string): Promise<{ body: string; cards: number }> {
  let cards = 0;
  const lines: string[] = [];
  for (const line of body.split('\n')) {
    const m = line.trim().match(/^\[상품검색:(.+):(\d+)\]$/);
    if (!m) {
      lines.push(line);
      continue;
    }
    const [, kw, n] = m;
    const rows = (await db().execute(sql`
      SELECT id FROM products
      WHERE position(${'|' + kw + '|'}::text in '|' || coalesce(search_terms, '') || '|') > 0
      ORDER BY (current_price <= lowest_price AND highest_price > lowest_price) DESC, rank ASC NULLS LAST, updated_at DESC
      LIMIT ${Number(n)}`)) as unknown as { id: string }[];
    cards += rows.length;
    for (const r of rows) lines.push(`[상품:${r.id}]`);
  }
  return { body: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), cards };
}

/**
 * horizonHours: 발행일이 지금부터 이 시간 안인 글만 넣음 (기본 24시간).
 * 매일 아침 수집 뒤에 자동 실행 → 그날 공개할 글을 그때 넣어서, 상품 카드도 그때까지 모인 상품으로 채움.
 */
export async function insertPosts(apply: boolean, horizonHours = 24) {
  const out = [];
  const until = Date.now() + horizonHours * 3_600_000;
  for (const d of drafts.filter((x) => new Date(x.date).getTime() <= until)) {
    const { body, cards } = await resolveProducts(d.body);
    const exists = ((await db().execute(sql`SELECT 1 FROM posts WHERE slug = ${d.slug}`)) as unknown[]).length > 0;
    out.push({ slug: d.slug, date: d.date, cards, exists });
    if (apply && !exists) {
      await db().execute(sql`
        INSERT INTO posts (slug, title, summary, category, body, date)
        VALUES (${d.slug}, ${d.title}, ${d.summary}, ${d.category}, ${body}, ${d.date}::timestamptz)
        ON CONFLICT (slug) DO NOTHING`);
    }
  }
  return { apply, posts: out };
}
