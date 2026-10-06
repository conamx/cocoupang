import { inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema, useDb } from '@/db/client';
import { isAdmin } from '@/lib/admin-auth';
import { isAffiliateLink, productIdFromUrl, type ParsedRow } from '@/lib/manual-import';
import { coupangCategories, etcCategory } from '@/lib/site';
import { upsertProducts, type UpsertRow } from '@/lib/sync/upsert';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

const labelOf = (id: string) =>
  [...coupangCategories, etcCategory].find((c) => c.id === id)?.label ?? etcCategory.label;

// 로그인 확인용
export async function GET(req: Request) {
  if (!isAdmin(req)) return new Response('Unauthorized', { status: 401 });
  return Response.json({ ok: true, db: useDb() });
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

type Result = { link: string; ok: boolean; id?: string; error?: string; created?: boolean };

// 붙여넣기 등록 — 새 상품은 상품명·이미지·가격 필수, 기존 상품은 빈 칸이면 기존 값 유지
export async function POST(req: Request) {
  if (!isAdmin(req)) return new Response('Unauthorized', { status: 401 });
  if (!useDb()) return Response.json({ error: 'DB 미연결(DATA_SOURCE=db 필요)' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { rows?: ParsedRow[]; defaultCategoryId?: string };
  const input = (body.rows ?? []).slice(0, 50); // 한 번에 50개 (함수 시간 제한)

  const ids = await Promise.all(input.map((r) => resolveProductId(r.link)));
  const known = ids.filter((x): x is string => Boolean(x));
  const existing = known.length
    ? await db().select().from(schema.products).where(inArray(schema.products.id, known))
    : [];
  const byId = new Map(existing.map((e) => [e.id, e]));

  const results: Result[] = [];
  const toSave: UpsertRow[] = [];
  input.forEach((r, i) => {
    const id = ids[i];
    if (!id) return results.push({ link: r.link, ok: false, error: '상품 ID를 찾지 못함 (쿠팡 상품 링크인지 확인)' });
    const prev = byId.get(id);
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
  }
  return Response.json({ results });
}
