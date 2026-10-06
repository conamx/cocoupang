import type { Metadata } from 'next';
import { getProducts } from '@/lib/data';
import { CategoryChips } from '@/components/CategoryChips';
import { ProductCard } from '@/components/ProductCard';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: '쿠팡 최저가·가격 변동 추이',
  description: '쿠팡 인기 상품의 역대 최저가·최고가와 가격 변동 추이를 카테고리별로 확인하세요.',
  alternates: { canonical: '/coupang' },
};

export default async function CoupangPage() {
  const products = await getProducts(undefined, 120);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">쿠팡 최저가</h1>
      <CategoryChips />
      {products.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">추적 중인 상품이 아직 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
