import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema, useDb } from '@/db/client';
import { isAdmin } from '@/lib/admin-auth';
import { badImageReason, isAffiliateLink, parsePaste, productIdFromUrl, type ParsedRow } from '@/lib/manual-import';
import { coupangCategories, etcCategory, site } from '@/lib/site';
import { upsertProducts, type UpsertRow } from '@/lib/sync/upsert';

/**
 * 관리자 상품 API (헤더 x-admin-key = ADMIN_PASSWORD)
 *   GET    ?           로그인 확인
 *   GET    ?list=1&q=&cat=&stale=1&offset=&limit=   상품 목록·검색 (티스토리 매크로도 사용)
 *   POST   {rows} 또는 {text}                         붙여넣기 등록 (text 는 서버에서 해석)
 *   PATCH  {id, name?, price?, image?, categoryId?, affiliateUrl?}   수정
 *   DELETE ?id=                                      삭제 (가격 이력 포함)
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

const P = schema.products;
const ALL_CATS = [...coupangCategories, etcCategory];
const labelOf = (id: string) => ALL_CATS.find((c) => c.id === id)?.label ?? etcCategory.label;

type ProductRow = typeof P.$inferSelect;

/** 관리자 화면·매크로가 쓰는 상품 형태 */
function toAdminProduct(r: ProductRow) {
  return {
    id: r.id,
    name: r.name,
    image: r.image,
    price: r.currentPrice,
    prevPrice: r.prevPrice,
    lowestPrice: r.lowestPrice,
    highestPrice: r.highestPrice,
    categoryId: r.categoryId,
    categoryLabel: r.categoryLabel,
    affiliateUrl: r.affiliateUrl,
    buyUrl: r.affiliateUrl ?? `https://www.coupang.com/vp/products/${r.id}`,
    pageUrl: `${site.url}/coupang/${r.id}`,
    source: r.source,
    updatedAt: r.updatedAt.toISOString(),
  };
}

const unauthorized = () => new Response('Unauthorized', { status: 401 });
const noDb = () => Response.json({ error: 'DB 미연결(DATA_SOURCE=db 필요)' }, { status: 400 });

// 한국 날짜 기준 오늘 갱신되지 않은 상품
const staleToday = sql`(${P.updatedAt} AT TIME ZONE 'Asia/Seoul')::date < (now() AT TIME ZONE 'Asia/Seoul')::date`;

export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const url = new URL(req.url);
  if (!url.searchParams.get('list')) return Response.json({ ok: true, db: useDb() });
  if (!useDb()) return noDb();

  const q = (url.searchParams.get('q') ?? '').trim();
  const cat = url.searchParams.get('cat') ?? '';
  const stale = url.searchParams.get('stale') === '1';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 200);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);

  // 검색어는 단어별로 OR 매칭 후, 많이 맞는 순으로 정렬 ("물티슈 추천" → '물티슈' 포함 상품)
  const words = q.split(/\s+/).filter((w) => w.length >= 2).slice(0, 5);
  const conds: SQL[] = [];
  if (words.length) conds.push(or(...words.map((w) => ilike(P.name, `%${w}%`)))!);
  else if (q) conds.push(ilike(P.name, `%${q}%`));
  if (/^\d+$/.test(q)) conds.push(eq(P.id, q));
  const where = and(
    conds.length ? or(...conds) : undefined,
    cat ? eq(P.categoryId, cat) : undefined,
    stale ? staleToday : undefined,
  );
  // 검색어 단어가 많이 맞는 순 (검색어 없으면 생략 — ORDER BY 상수는 Postgres 오류)
  const byScore = words.length
    ? [
        desc(
          sql`(${sql.join(
            words.map((w) => sql`(CASE WHEN ${P.name} ILIKE ${`%${w}%`} THEN 1 ELSE 0 END)`),
            sql` + `,
          )})`,
        ),
      ]
    : [];

  const [rows, total] = await Promise.all([
    db()
      .select()
      .from(P)
      .where(where)
      .orderBy(...byScore, stale ? asc(P.updatedAt) : desc(P.updatedAt))
      .limit(limit)
      .offset(offset),
    db().select({ n: sql<number>`count(*)::int` }).from(P).where(where),
  ]);
  return Response.json({ total: total[0]?.n ?? 0, products: rows.map(toAdminProduct) });
}

// 파트너스 단축링크(link.coupang.com/a/…) → 리다이렉트를 따라가 상품 ID 확인
async function resolveProductId(link: string): Promise<string | undefined> {
  const direct = productIdFromUrl(link);
  if (direct) return direct;
  let url = link;
  for (let hop = 0; hop < 4; hop++) {
    try {
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(4000) });
      const loc = res.headers.get('location');
      if (!loc) return undefined;
      url = new URL(loc, url).toString();
      const id = productIdFromUrl(url);
      if (id) return id;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

type Result = {
  link: string;
  ok: boolean;
  id?: string;
  error?: string;
  created?: boolean;
  product?: ReturnType<typeof toAdminProduct>;
};

// 붙여넣기 등록 — 새 상품은 상품명·이미지·가격 필수, 기존 상품은 빈 칸이면 기존 값 유지
export async function POST(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  if (!useDb()) return noDb();

  const body = (await req.json().catch(() => ({}))) as {
    rows?: ParsedRow[];
    text?: string;
    defaultCategoryId?: string;
  };
  const input = (body.text ? parsePaste(body.text) : (body.rows ?? [])).slice(0, 50); // 함수 시간 제한

  const ids = await Promise.all(input.map((r) => resolveProductId(r.link)));
  const known = ids.filter((x): x is string => Boolean(x));
  const existing = known.length ? await db().select().from(P).where(inArray(P.id, known)) : [];
  const byId = new Map(existing.map((e) => [e.id, e]));

  const results: Result[] = [];
  const toSave: UpsertRow[] = [];
  input.forEach((r, i) => {
    const id = ids[i];
    if (!id) return results.push({ link: r.link, ok: false, error: '상품 ID를 찾지 못함 (쿠팡 상품 링크인지 확인)' });
    const prev = byId.get(id);
    const imgErr = badImageReason(r.image?.trim());
    if (imgErr) return results.push({ link: r.link, ok: false, id, error: imgErr });
    const name = r.name?.trim() || prev?.name;
    const image = r.image?.trim() || prev?.image;
    const price = r.price ?? prev?.currentPrice;
    const missing = [!name && '상품명', !image && '이미지', !price && '가격'].filter(Boolean);
    if (missing.length) return results.push({ link: r.link, ok: false, id, error: `${missing.join('·')} 없음` });
    const categoryId = r.categoryId || prev?.categoryId || body.defaultCategoryId || etcCategory.id;
    toSave.push({
      productId: id,
      name: name!,
      image: image!,
      price: price!,
      categoryId,
      categoryLabel: labelOf(categoryId),
      affiliateUrl: isAffiliateLink(r.link) ? r.link : undefined,
      source: 'manual',
    });
    results.push({ link: r.link, ok: true, id, created: !prev });
  });

  if (toSave.length) {
    await upsertProducts(toSave);
    revalidatePath('/', 'layout');
    // 저장된 최종 상태를 함께 돌려줌 (매크로가 글에 상품 카드를 넣을 때 사용)
    const saved = await db().select().from(P).where(inArray(P.id, toSave.map((s) => s.productId)));
    const savedById = new Map(saved.map((s) => [s.id, toAdminProduct(s)]));
    for (const r of results) if (r.ok && r.id) r.product = savedById.get(r.id);
  }
  return Response.json({ results });
}

// 상품 수정 — 가격이 바뀌면 가격 이력·전일대비가 함께 갱신됨
export async function PATCH(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  if (!useDb()) return noDb();
  const b = (await req.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    price?: number;
    image?: string;
    categoryId?: string;
    affiliateUrl?: string;
  };
  if (!b.id) return Response.json({ error: 'id 필요' }, { status: 400 });
  const [prev] = await db().select().from(P).where(eq(P.id, b.id)).limit(1);
  if (!prev) return Response.json({ error: '상품 없음' }, { status: 404 });

  const imgErr = badImageReason(b.image?.trim());
  if (imgErr) return Response.json({ error: imgErr }, { status: 400 });
  if (b.price !== undefined && !(Number.isInteger(b.price) && b.price > 0))
    return Response.json({ error: '가격은 0보다 큰 숫자' }, { status: 400 });
  if (b.categoryId && !ALL_CATS.some((c) => c.id === b.categoryId))
    return Response.json({ error: '알 수 없는 카테고리' }, { status: 400 });
  if (b.affiliateUrl && !isAffiliateLink(b.affiliateUrl))
    return Response.json({ error: '파트너스 링크(link.coupang.com)가 아님' }, { status: 400 });

  const name = b.name?.trim() || prev.name;
  const image = b.image?.trim() || prev.image;
  const categoryId = b.categoryId || prev.categoryId;

  if (b.price !== undefined) {
    // 가격 입력은 수집과 같은 경로로 (이력·전일가·최저/최고 자동 계산).
    // 같은 가격이어도 '오늘 확인'으로 갱신일이 바뀌고, 이력은 하루 1건만 남음.
    await upsertProducts([
      {
        productId: prev.id,
        name,
        image,
        price: b.price,
        categoryId,
        categoryLabel: labelOf(categoryId),
        affiliateUrl: b.affiliateUrl || undefined,
        source: 'manual',
      },
    ]);
  }
  // 이름·이미지·카테고리·링크는 그대로 덮어쓰기 ('기타'로 옮기는 경우 포함)
  await db()
    .update(P)
    .set({
      name,
      image,
      categoryId,
      categoryLabel: labelOf(categoryId),
      ...(b.affiliateUrl ? { affiliateUrl: b.affiliateUrl } : {}),
    })
    .where(eq(P.id, prev.id));

  revalidatePath('/', 'layout');
  const [after] = await db().select().from(P).where(eq(P.id, prev.id)).limit(1);
  return Response.json({ ok: true, product: toAdminProduct(after) });
}

export async function DELETE(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  if (!useDb()) return noDb();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id 필요' }, { status: 400 });
  const r = await db().delete(P).where(eq(P.id, id)).returning({ id: P.id });
  if (!r.length) return Response.json({ error: '상품 없음' }, { status: 404 });
  revalidatePath('/', 'layout');
  return Response.json({ ok: true });
}
