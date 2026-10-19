import Link from 'next/link';
import { RemoteImg } from '@/components/RemoteImg';
import type { Product } from '@/lib/types';
import { coupangLink, won } from '@/lib/format';
import { PriceChange } from '@/components/PriceChange';
import { productPath } from '@/lib/product-url';

/** 등록·갱신 3일 이내면 NEW */
const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 3 * 86_400_000;

export function ProductCard({ product, rank, showRange }: { product: Product; rank?: number; showRange?: boolean }) {
  const atLow = product.currentPrice <= product.lowestPrice && product.highestPrice > product.lowestPrice;
  const href = productPath(product);
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
      <Link href={href} className="relative block aspect-square w-full overflow-hidden bg-white">
        {/* 쿠팡 CDN 이미지를 그대로 사용 — Netlify 이미지 변환/대역폭 크레딧을 쓰지 않음 */}
        <RemoteImg
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        {rank && (
          <span className="absolute bottom-2 left-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-900/80 px-1.5 text-[11px] font-bold text-white">
            {rank}
          </span>
        )}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {atLow && (
            <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">역대최저</span>
          )}
          {product.source === 'goldbox' && (
            <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">골드박스</span>
          )}
          {!atLow && product.source !== 'goldbox' && isNew(product.updatedAt) && (
            <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col justify-between p-2.5 pt-2">
        <div>
        <Link
          href={href}
          className="line-clamp-2 min-h-[2.5em] text-[13px] leading-snug text-gray-800 hover:text-blue-600 dark:text-gray-200"
        >
          {product.name}
        </Link>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[15px] font-extrabold text-gray-900 dark:text-white">{won(product.currentPrice)}</span>
          <PriceChange currentPrice={product.currentPrice} prevPrice={product.prevPrice} className="text-xs font-semibold" />
        </p>
        {showRange && product.highestPrice > product.lowestPrice && (
          <p className="text-[11px] text-gray-400">
            가격폭 {won(product.lowestPrice)} ~ {won(product.highestPrice)}
          </p>
        )}
        {product.isRocket && <p className="text-[11px] font-semibold text-blue-600">로켓배송</p>}
        </div>
        <a
          href={coupangLink(product)}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="mt-2 block rounded-lg bg-blue-600 py-1.5 text-center text-[12px] font-bold text-white transition hover:bg-blue-700"
        >
          쿠팡 최저가 보기 ›
        </a>
      </div>
    </div>
  );
}
