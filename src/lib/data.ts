import type { Deal, DiscountBrand, Post, Product } from '@/lib/types';
import { seedProducts } from '@/lib/seed/products';
import { seedDeals } from '@/lib/seed/deals';
import { seedPosts } from '@/lib/seed/posts';
import { seedBrands } from '@/lib/seed/brands';

/**
 * 데이터 접근 계층(Repository).
 *
 * DATA_SOURCE=db 이면 Postgres(src/lib/data-db.ts)를, 아니면 시드 데이터를 사용합니다.
 * UI/페이지는 이 모듈만 바라보므로 소스를 바꿔도 화면 코드는 그대로입니다.
 */
const useDb = () => (process.env.DATA_SOURCE ?? 'seed') === 'db';

async function repo() {
  // 지연 import: 시드 모드에서는 DB 드라이버를 아예 로드하지 않음.
  const { dbData } = await import('@/lib/data-db');
  return dbData;
}

export async function getProducts(categoryId?: string): Promise<Product[]> {
  if (useDb()) return (await repo()).getProducts(categoryId);
  const list = categoryId ? seedProducts.filter((p) => p.categoryId === categoryId) : seedProducts;
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProduct(id: string): Promise<Product | null> {
  if (useDb()) return (await repo()).getProduct(id);
  return seedProducts.find((p) => p.id === id) ?? null;
}

export async function getRelatedProducts(id: string, limit = 5): Promise<Product[]> {
  if (useDb()) return (await repo()).getRelatedProducts(id, limit);
  const p = seedProducts.find((x) => x.id === id);
  if (!p) return [];
  return seedProducts.filter((x) => x.id !== id && x.categoryId === p.categoryId).slice(0, limit);
}

export async function getDeals(limit?: number): Promise<Deal[]> {
  if (useDb()) return (await repo()).getDeals(limit);
  const list = [...seedDeals].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  return limit ? list.slice(0, limit) : list;
}

export async function getDeal(id: string): Promise<Deal | null> {
  if (useDb()) return (await repo()).getDeal(id);
  return seedDeals.find((d) => d.id === id) ?? null;
}

export async function getPosts(): Promise<Post[]> {
  if (useDb()) return (await repo()).getPosts();
  return [...seedPosts].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPost(slug: string): Promise<Post | null> {
  if (useDb()) return (await repo()).getPost(slug);
  return seedPosts.find((p) => p.slug === slug) ?? null;
}

// 할인코드 브랜드는 정적 목록(시드)으로 관리.
export async function getBrands(group?: DiscountBrand['group']): Promise<DiscountBrand[]> {
  return group ? seedBrands.filter((b) => b.group === group) : seedBrands;
}

export async function getBrand(slug: string): Promise<DiscountBrand | null> {
  return seedBrands.find((b) => b.slug === slug) ?? null;
}

export async function search(q: string): Promise<{ products: Product[]; deals: Deal[]; posts: Post[] }> {
  const needle = q.trim();
  if (!needle) return { products: [], deals: [], posts: [] };
  if (useDb()) return (await repo()).search(needle);
  const n = needle.toLowerCase();
  const match = (s: string) => s.toLowerCase().includes(n);
  return {
    products: seedProducts.filter((p) => match(p.name)),
    deals: seedDeals.filter((d) => match(d.title)),
    posts: seedPosts.filter((p) => match(p.title) || match(p.summary)),
  };
}
