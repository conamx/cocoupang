import Link from 'next/link';
import { getDeals, getProducts } from '@/lib/data';
import { DealCard } from '@/components/DealCard';
import { ProductCard } from '@/components/ProductCard';

// 핫딜은 자주 갱신 → 짧은 ISR
export const revalidate = 300;

export default async function HomePage() {
  const [deals, products] = await Promise.all([getDeals(), getProducts()]);
  const lowNow = products.filter((p) => p.currentPrice <= p.lowestPrice).slice(0, 6);
  const trending = (lowNow.length ? lowNow : products).slice(0, 6);

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-bold">실시간 핫딜</h1>
          <span className="text-xs text-gray-400">뽐뿌 · 펨코 · 루리웹</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {deals.map((d) => (
            <DealCard key={d.id} deal={d} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">지금 역대최저가</h2>
          <Link href="/coupang" className="text-sm font-semibold text-blue-600 hover:underline">
            최저가 전체 →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          {trending.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
