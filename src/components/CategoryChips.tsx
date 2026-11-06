import Link from 'next/link';
import { getActiveCategories } from '@/lib/data';
import { categoryPath } from '@/lib/category-url';
import { HScroll } from '@/components/HScroll';

const chip = (on: boolean) =>
  `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
    on
      ? 'bg-blue-600 text-white'
      : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-800 dark:hover:bg-gray-800'
  }`;

/** 가로 카테고리 칩 + 좌우 넘김 버튼 — 상품 있는 카테고리만, 많은 순 */
export async function CategoryChips({ active }: { active?: string }) {
  const cats = await getActiveCategories();
  return (
    <HScroll className="mb-5">
      <Link href="/coupang" className={chip(!active)} aria-current={!active ? 'page' : undefined}>
        전체
      </Link>
      {cats.map((c) => (
        <Link key={c.id} href={categoryPath(c.id)} className={chip(active === c.id)} aria-current={active === c.id ? 'page' : undefined}>
          {c.label}
        </Link>
      ))}
    </HScroll>
  );
}
