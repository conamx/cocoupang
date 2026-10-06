import Link from 'next/link';
import type { Metadata } from 'next';
import { search } from '@/lib/data';
import { ProductCard } from '@/components/ProductCard';
import { DealCard } from '@/components/DealCard';

export const metadata: Metadata = {
  title: '검색',
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const { products, deals, posts } = await search(q);
  const empty = q && products.length + deals.length + posts.length === 0;

  return (
    <div>
      <form action="/search" className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="상품·핫딜·정보 검색"
          className="w-full rounded-full border border-gray-300 bg-white px-5 py-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900"
        />
      </form>

      {!q && <p className="py-16 text-center text-sm text-gray-400">검색어를 입력하세요.</p>}
      {empty && <p className="py-16 text-center text-sm text-gray-400">&quot;{q}&quot; 검색 결과가 없습니다.</p>}

      {products.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-bold">상품 {products.length}</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {deals.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-bold">핫딜 {deals.length}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {deals.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold">정보 {posts.length}</h2>
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="text-sm text-gray-700 hover:text-blue-600 dark:text-gray-300">
                  · {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
