import Link from 'next/link';
import { RemoteImg } from '@/components/RemoteImg';
import type { Deal } from '@/lib/types';
import { timeAgo } from '@/lib/format';

export function DealCard({ deal }: { deal: Deal }) {
  return (
    <Link href={`/deal/${deal.id}`} className="group flex gap-3 rounded-xl border border-gray-100 p-2.5 transition hover:border-blue-200 hover:bg-blue-50/30 dark:border-gray-800 dark:hover:border-blue-900 dark:hover:bg-blue-950/20">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-950">
        <RemoteImg src={deal.thumb} alt={deal.title} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">{deal.source}</span>
          <span className="text-gray-400">{deal.category}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-blue-600 dark:text-gray-100">
          {deal.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs">
          {deal.price && <span className="font-bold text-gray-900 dark:text-white">{deal.price}</span>}
          <span className="text-gray-400">{timeAgo(deal.postedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
