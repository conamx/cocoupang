import Link from 'next/link';
import { getActiveCategories } from '@/lib/data';

const chip = (on: boolean) =>
  `shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
    on ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
  }`;

/** 가로 스크롤 카테고리 칩 — 상품 있는 카테고리만, 많은 순 */
export async function CategoryChips({ active }: { active?: string }) {
  const cats = await getActiveCategories();
  return (
    <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto pb-1">
      <Link href="/coupang" className={chip(!active)}>
        전체
      </Link>
      {cats.map((c) => (
        <Link key={c.id} href={`/coupang/category/${c.id}`} className={chip(active === c.id)}>
          {c.label}
        </Link>
      ))}
    </div>
  );
}
