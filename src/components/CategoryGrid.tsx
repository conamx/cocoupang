import Link from 'next/link';
import { categoryIcons, coupangCategories, etcCategory } from '@/lib/site';

/** 아이콘 카테고리 바로가기 (모바일 4열 · PC 8열) */
export function CategoryGrid({ counts }: { counts?: Record<string, number> }) {
  const cats = [...coupangCategories, etcCategory];
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
            {counts?.[c.id] ? <span className="block text-[10px] font-normal text-gray-400">{counts[c.id]}개</span> : null}
          </span>
        </Link>
      ))}
    </div>
  );
}
