import Link from 'next/link';
import { getActiveCategories } from '@/lib/data';
import { categoryIcons } from '@/lib/site';

/** 아이콘 카테고리 바로가기 (모바일 4열 · PC 6~9열) — 상품 있는 카테고리만, 많은 순 */
export async function CategoryGrid() {
  const cats = await getActiveCategories();
  if (!cats.length) return null;
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-9">
      {cats.map((c) => (
        <Link
          key={c.id}
          href={`/coupang/category/${c.id}`}
          className="group flex flex-col items-center gap-1.5 rounded-2xl p-2 transition active:scale-95"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[28px] shadow-sm ring-1 ring-gray-100 transition group-hover:ring-blue-200 dark:bg-gray-900 dark:ring-gray-800">
            <span aria-hidden>{categoryIcons[c.id] ?? '🏷️'}</span>
          </span>
          <span className="text-center text-[12px] font-semibold leading-tight text-gray-700 dark:text-gray-300">
            {c.label}
            <span className="block text-[11px] font-normal text-gray-400">{c.count.toLocaleString('ko-KR')}개</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
