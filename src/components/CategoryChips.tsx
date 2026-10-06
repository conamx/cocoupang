import Link from 'next/link';
import { coupangCategories } from '@/lib/site';

const chip = (on: boolean) =>
  `shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
    on ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
  }`;

export function CategoryChips({ active }: { active?: string }) {
  return (
    <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto pb-1">
      <Link href="/coupang" className={chip(!active)}>
        전체
      </Link>
      {coupangCategories.map((c) => (
        <Link key={c.id} href={`/coupang/category/${c.id}`} className={chip(active === c.id)}>
          {c.label}
        </Link>
      ))}
    </div>
  );
}
