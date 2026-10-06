import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProducts } from '@/lib/data';
import { coupangCategories, etcCategory } from '@/lib/site';
import { CategoryChips } from '@/components/CategoryChips';
import { ProductCard } from '@/components/ProductCard';

// 정적 페이지 + 수집 후 즉시 갱신(/api/revalidate). 요청마다 함수가 돌지 않게 searchParams 를 쓰지 않습니다.
export const revalidate = 86400;

const all = [...coupangCategories, etcCategory];
const find = (id: string) => all.find((c) => c.id === id);

export function generateStaticParams() {
  return all.map((c) => ({ cat: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ cat: string }> }): Promise<Metadata> {
  const c = find((await params).cat);
  if (!c) return {};
  return {
    title: `${c.label} 쿠팡 최저가·인기 순위`,
    description: `쿠팡 ${c.label} 인기 상품의 오늘 가격, 역대 최저가, 가격 변동 추이를 한눈에 비교하세요.`,
    alternates: { canonical: `/coupang/category/${c.id}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ cat: string }> }) {
  const c = find((await params).cat);
  if (!c) notFound();
  const products = await getProducts(c.id, 120);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{c.label} 쿠팡 최저가</h1>
      <CategoryChips active={c.id} />
      {products.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">이 카테고리에 추적 중인 상품이 아직 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
