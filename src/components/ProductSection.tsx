import Link from 'next/link';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';

export function ProductSection({
  title,
  sub,
  href,
  products,
  ranked,
  as: Heading = 'h2',
}: {
  title: string;
  sub?: string;
  href?: string;
  products: Product[];
  ranked?: boolean;
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
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} rank={ranked ? i + 1 : undefined} />
        ))}
      </div>
    </section>
  );
}
