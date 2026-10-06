import Link from 'next/link';
import type { Product } from '@/lib/types';
import { won, dropRate, discountRate } from '@/lib/format';

export function ProductCard({ product, rank }: { product: Product; rank?: number }) {
  const atLow = product.currentPrice <= product.lowestPrice && product.highestPrice > product.lowestPrice;
  const drop = dropRate(product);
  const off = discountRate(product);
  return (
    <Link href={`/coupang/${product.id}`} className="group block">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        {/* 쿠팡 CDN 이미지를 그대로 사용 — Netlify 이미지 변환/대역폭 크레딧을 쓰지 않음 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        {rank && (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {rank}
          </span>
        )}
        <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
          {atLow && (
            <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">역대최저</span>
          )}
          {product.source === 'goldbox' && (
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">골드박스</span>
          )}
        </div>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-gray-800 group-hover:text-blue-600 dark:text-gray-200">
        {product.name}
      </p>
      <p className="mt-0.5 flex items-baseline gap-1">
        {(drop > 0 || off > 0) && <span className="text-sm font-bold text-red-500">{drop > 0 ? drop : off}%</span>}
        <span className="text-sm font-bold text-gray-900 dark:text-white">{won(product.currentPrice)}</span>
      </p>
      {product.isRocket && <p className="text-[11px] font-semibold text-blue-600">로켓배송</p>}
    </Link>
  );
}
