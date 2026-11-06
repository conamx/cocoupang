import Link from 'next/link';
import { getKeywordCounts } from '@/lib/data';
import { KEYWORD_MIN_PRODUCTS, keywordPath, keywordsInCategory } from '@/lib/keyword-url';
import { searchKeywords } from '@/lib/sync/keywords';

/**
 * 품목별 최저가 페이지로 가는 링크 묶음 (상품이 충분히 모인 품목만, 상품 많은 순).
 * 검색엔진이 품목 페이지를 찾아가는 길이기도 함.
 */
export async function KeywordLinks({ title, categoryId, limit = 30 }: { title: string; categoryId?: string; limit?: number }) {
  const counts = await getKeywordCounts();
  const pool = categoryId ? keywordsInCategory(categoryId) : searchKeywords.map((k) => k.keyword);
  const list = pool
    .filter((w) => (counts[w] ?? 0) >= KEYWORD_MIN_PRODUCTS)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, limit);
  if (list.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className="flex flex-wrap gap-1.5">
        {list.map((w) => (
          <Link
            key={w}
            href={keywordPath(w)}
            className="rounded-full bg-white px-3 py-1.5 text-[13px] text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-800"
          >
            {w}
          </Link>
        ))}
      </div>
    </section>
  );
}
