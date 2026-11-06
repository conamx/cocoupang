import Link from 'next/link';
import { getActiveCategories } from '@/lib/data';
import { categoryPath } from '@/lib/category-url';

const chip = (on: boolean) =>
  `flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[13px] font-semibold leading-tight transition ${
    on
      ? 'bg-blue-600 text-white'
      : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-800 dark:hover:bg-gray-800'
  }`;

// 모바일에서 처음부터 보이는 칸 수 (전체 포함). 나머지는 '카테고리 더보기'로 펼침.
const FIRST = 9;

/**
 * 카테고리 고르기 — 옆으로 밀어 찾지 않고 한눈에 보이게 격자로.
 * PC: 전부 펼쳐 보임 / 모바일: 3칸 × 3줄 + 더보기 (JS 없이 <details> 로 펼침)
 */
export async function CategoryChips({ active }: { active?: string }) {
  const cats = await getActiveCategories();
  const items = [{ id: '', label: '전체', count: cats.reduce((s, c) => s + c.count, 0) }, ...cats];
  const cell = (c: (typeof items)[number]) => {
    const on = c.id ? active === c.id : !active;
    return (
      <Link key={c.id || 'all'} href={c.id ? categoryPath(c.id) : '/coupang'} className={chip(on)} aria-current={on ? 'page' : undefined}>
        <span className="truncate">{c.label}</span>
        <span className={`hidden text-[11px] font-medium sm:inline ${on ? 'text-blue-100' : 'text-gray-400'}`}>{c.count.toLocaleString('ko-KR')}</span>
      </Link>
    );
  };
  const head = items.slice(0, FIRST);
  const rest = items.slice(FIRST);
  // 지금 보고 있는 카테고리가 접힌 쪽에 있으면 펼친 상태로
  const openRest = rest.some((c) => c.id === active);

  return (
    <nav aria-label="카테고리" className="mb-5">
      {/* PC: 전부 */}
      <div className="hidden flex-wrap gap-2 sm:flex [&>a]:px-3.5">{items.map(cell)}</div>
      {/* 모바일: 8칸 + 더보기 */}
      <div className="sm:hidden">
        <div className="grid grid-cols-3 gap-1.5">{head.map(cell)}</div>
        {rest.length > 0 && (
          <details className="group" open={openRest}>
            <summary className="mt-1.5 flex cursor-pointer list-none items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-gray-500 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">카테고리 {rest.length}개 더보기</span>
              <span className="hidden group-open:inline">접기</span>
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition group-open:rotate-180" fill="currentColor" aria-hidden>
                <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
              </svg>
            </summary>
            <div className="grid grid-cols-3 gap-1.5">{rest.map(cell)}</div>
          </details>
        )}
      </div>
    </nav>
  );
}
