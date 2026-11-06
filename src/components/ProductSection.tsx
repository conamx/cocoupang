import Link from 'next/link';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';

export function ProductSection({
  title,
  sub,
  href,
  products,
  ranked,
  mobileMax,
  as: Heading = 'h2',
}: {
  title: string;
  sub?: string;
  href?: string;
  products: Product[];
  ranked?: boolean;
  mobileMax?: number; // 모바일(2칸)에서 보여 줄 최대 개수 — 줄이 홀수로 끝나지 않게
  as?: 'h1' | 'h2';
}) {
  if (products.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <Heading className="text-lg font-bold">{title}</Heading>
          {sub && <span className="text-xs text-gray-400">{sub}</span>}
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-sm font-semibold text-blue-600 hover:underline">
            더보기 →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {products.map((p, i) =>
          mobileMax !== undefined && i >= mobileMax ? (
            <div key={p.id} className="hidden sm:contents">
              <ProductCard product={p} rank={ranked ? i + 1 : undefined} />
            </div>
          ) : (
            <ProductCard key={p.id} product={p} rank={ranked ? i + 1 : undefined} />
          ),
        )}
      </div>
    </section>
  );
}
