import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { categoryPath } from '@/lib/category-url';
import { CategoryListing, categoryMetadata } from '../listing';

// 카테고리 2쪽 이후 — 1쪽과 같은 방식(첫 방문 때 만들어 캐시, 수집 후 갱신)
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const toPage = (s: string) => (/^\d{1,4}$/.test(s) ? Number(s) : NaN);

export async function generateMetadata({ params }: { params: Promise<{ cat: string; page: string }> }): Promise<Metadata> {
  const { cat, page } = await params;
  const n = toPage(page);
  return Number.isNaN(n) ? {} : categoryMetadata(cat, n);
}

export default async function CategoryPageN({ params }: { params: Promise<{ cat: string; page: string }> }) {
  const { cat, page } = await params;
  const n = toPage(page);
  if (Number.isNaN(n) || n < 1) notFound();
  if (n === 1) permanentRedirect(categoryPath(cat));
  return <CategoryListing id={cat} page={n} />;
}
