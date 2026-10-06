import Link from 'next/link';
import type { Product } from '@/lib/types';
import { won } from '@/lib/format';

export function ProductCard({ product }: { product: Product }) {
  const atLow = product.currentPrice <= product.lowestPrice;
  return (
    <Link href={`/coupang/${product.id}`} className="group block">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        {atLow && (
          <span className="absolute left-1.5 top-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            역대최저
          </span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-gray-800 group-hover:text-blue-600 dark:text-gray-200">
        {product.name}
      </p>
      <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-white">{won(product.currentPrice)}</p>
    </Link>
  );
}
