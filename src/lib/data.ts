import type { Deal, DiscountBrand, Post, Product } from '@/lib/types';
import { seedProducts } from '@/lib/seed/products';
import { seedDeals } from '@/lib/seed/deals';
import { seedPosts } from '@/lib/seed/posts';
import { seedBrands } from '@/lib/seed/brands';

/**
 * 데이터 접근 계층(Repository).
 *
 * 지금은 src/lib/seed/* 시드 데이터를 반환합니다.
 * 운영 전환 시 DATA_SOURCE=db 로 두고 아래 각 함수에서
 * src/db (Drizzle + Postgres) 쿼리로 교체하면 UI는 그대로 동작합니다.
 *
 * 예) const rows = await db.select().from(products)...
 */

export async function getProducts(categoryId?: string): Promise<Product[]> {
  const list = categoryId
    ? seedProducts.filter((p) => p.categoryId === categoryId)
    : seedProducts;
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProduct(id: string): Promise<Product | null> {
  return seedProducts.find((p) => p.id === id) ?? null;
}

export async function getRelatedProducts(id: string, limit = 5): Promise<Product[]> {
  const p = await getProduct(id);
  if (!p) return [];
  return seedProducts
    .filter((x) => x.id !== id && x.categoryId === p.categoryId)
    .slice(0, limit);
}

export async function getDeals(limit?: number): Promise<Deal[]> {
  const list = [...seedDeals].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  return limit ? list.slice(0, limit) : list;
}

export async function getDeal(id: string): Promise<Deal | null> {
  return seedDeals.find((d) => d.id === id) ?? null;
}

export async function getPosts(): Promise<Post[]> {
  return [...seedPosts].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPost(slug: string): Promise<Post | null> {
  return seedPosts.find((p) => p.slug === slug) ?? null;
}

export async function getBrands(group?: DiscountBrand['group']): Promise<DiscountBrand[]> {
  return group ? seedBrands.filter((b) => b.group === group) : seedBrands;
}

export async function getBrand(slug: string): Promise<DiscountBrand | null> {
  return seedBrands.find((b) => b.slug === slug) ?? null;
}

export async function search(q: string): Promise<{ products: Product[]; deals: Deal[]; posts: Post[] }> {
  const needle = q.trim().toLowerCase();
  if (!needle) return { products: [], deals: [], posts: [] };
  const match = (s: string) => s.toLowerCase().includes(needle);
  return {
    products: seedProducts.filter((p) => match(p.name)),
    deals: seedDeals.filter((d) => match(d.title)),
    posts: seedPosts.filter((p) => match(p.title) || match(p.summary)),
  };
}
