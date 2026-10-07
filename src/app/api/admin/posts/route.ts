import { asc, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema, useDb } from '@/db/client';
import { isAdmin } from '@/lib/admin-auth';
import { bodyWithProducts, normalizeDate, publishAt, slugify, type PostDraft } from '@/lib/post-import';

/**
 * 관리자 정보글 API (헤더 x-admin-key = ADMIN_PASSWORD)
 *   GET    ?             글 목록 (예약 글 포함, 발행일 빠른 순)
 *   POST   {posts, overwrite?}   글 등록. 같은 주소가 있으면 overwrite=true 일 때만 덮어씀
 *   DELETE ?slug=        글 삭제
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

const T = schema.posts;
const MAX_PER_REQUEST = 100;

function refresh() {
  revalidatePath('/blog');
  revalidatePath('/blog/[slug]', 'page');
  revalidatePath('/sitemap.xml');
  revalidatePath('/feed.xml');
}

export async function GET(req: Request) {
  if (!isAdmin(req)) return new Response('Unauthorized', { status: 401 });
  if (!useDb()) return Response.json({ db: false, posts: [] });
  const rows = await db()
    .select({ slug: T.slug, title: T.title, category: T.category, date: T.date })
    .from(T)
    .orderBy(asc(T.date), asc(T.title));
  const now = Date.now();
  return Response.json({
    db: true,
    posts: rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      category: r.category,
      date: r.date.toISOString().slice(0, 10),
      published: r.date.getTime() <= now,
    })),
  });
}

type InPost = Partial<PostDraft>;

export async function POST(req: Request) {
  if (!isAdmin(req)) return new Response('Unauthorized', { status: 401 });
  if (!useDb()) return new Response('DB 미설정 (DATA_SOURCE=db, DATABASE_URL)', { status: 400 });
  const { posts, overwrite } = (await req.json()) as { posts?: InPost[]; overwrite?: boolean };
  if (!Array.isArray(posts) || !posts.length) return new Response('posts 가 비어 있어요', { status: 400 });
  if (posts.length > MAX_PER_REQUEST) return new Response(`한 번에 ${MAX_PER_REQUEST}개까지`, { status: 400 });

  const results: { slug: string; ok: boolean; status?: 'created' | 'updated'; error?: string }[] = [];
  const valid: (typeof T.$inferInsert)[] = [];
  for (const p of posts) {
    const title = (p.title ?? '').trim();
    const body = (p.body ?? '').trim();
    const slug = slugify(p.slug || title);
    const date = normalizeDate(p.date ?? '');
    if (!title || !body || !slug) {
      results.push({ slug: slug || title, ok: false, error: '제목·본문이 필요해요' });
      continue;
    }
    if (!date) {
      results.push({ slug, ok: false, error: '발행일이 없어요' });
      continue;
    }
    if (valid.some((v) => v.slug === slug)) {
      results.push({ slug, ok: false, error: '같은 주소가 한 번에 두 번 들어왔어요' });
      continue;
    }
    valid.push({
      slug,
      title: title.slice(0, 200),
      summary: (p.summary ?? '').trim().slice(0, 300),
      category: (p.category ?? '').trim().slice(0, 40) || '쇼핑가이드',
      body: bodyWithProducts({ body, products: Array.isArray(p.products) ? p.products.map(String) : [] }),
      date: publishAt(date),
    });
  }

  if (valid.length) {
    const existing = new Set(
      (await db().select({ slug: T.slug }).from(T).where(inArray(T.slug, valid.map((v) => v.slug)))).map((r) => r.slug),
    );
    const toWrite = valid.filter((v) => overwrite || !existing.has(v.slug));
    for (const v of valid) {
      if (!overwrite && existing.has(v.slug)) {
        results.push({ slug: v.slug, ok: false, error: '같은 주소의 글이 이미 있어요 (덮어쓰기를 켜면 교체)' });
      }
    }
    if (toWrite.length) {
      await db()
        .insert(T)
        .values(toWrite)
        .onConflictDoUpdate({
          target: T.slug,
          set: {
            title: sql`excluded.title`,
            summary: sql`excluded.summary`,
            category: sql`excluded.category`,
            body: sql`excluded.body`,
            date: sql`excluded.date`,
          },
        });
      for (const v of toWrite) {
        results.push({ slug: v.slug, ok: true, status: existing.has(v.slug) ? 'updated' : 'created' });
      }
      refresh();
    }
  }
  return Response.json({ results });
}

export async function DELETE(req: Request) {
  if (!isAdmin(req)) return new Response('Unauthorized', { status: 401 });
  if (!useDb()) return new Response('DB 미설정', { status: 400 });
  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) return new Response('slug 필요', { status: 400 });
  const r = await db().delete(T).where(eq(T.slug, slug)).returning({ slug: T.slug });
  refresh();
  return Response.json({ deleted: r.length });
}
