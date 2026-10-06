import type { Metadata } from 'next';
import { getDeals } from '@/lib/data';
import { DealCard } from '@/components/DealCard';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '실시간 핫딜 모음',
  description: '뽐뿌·펨코·루리웹 등 국내 커뮤니티 핫딜을 한곳에서 모아봅니다.',
  alternates: { canonical: '/deal' },
};

export default async function DealsPage() {
  const deals = await getDeals(100);
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">실시간 핫딜 모음</h1>
        <span className="text-xs text-gray-400">뽐뿌 · 펨코 · 루리웹</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} />
        ))}
      </div>
    </div>
  );
}
