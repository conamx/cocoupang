import Link from 'next/link';
import type { Metadata } from 'next';
import { getProducts } from '@/lib/data';
import { coupangCategories } from '@/lib/site';
import { ProductCard } from '@/components/ProductCard';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: '쿠팡 최저가·가격 변동 추이',
  description: '쿠팡 인기 상품의 역대 최저가·최고가와 가격 변동 추이를 카테고리별로 확인하세요.',
  alternates: { canonical: '/coupang' },
};

export default async function CoupangPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const products = await getProducts(cat);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">쿠팡 최저가</h1>

      <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto pb-1">
        <Link
          href="/coupang"
          className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
            !cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          전체
        </Link>
        {coupangCategories.map((c) => (
          <Link
            key={c.id}
            href={`/coupang?cat=${c.id}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
              cat === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">이 카테고리에 추적 중인 상품이 아직 없습니다.</p>
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
