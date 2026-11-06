import Link from 'next/link';

/** 페이지 번호 (현재 쪽 주변 + 처음·끝, 검색엔진이 모든 쪽을 따라갈 수 있게 링크로) */
export function Pager({ page, pages, href }: { page: number; pages: number; href: (n: number) => string }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const btn = 'flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm';
  return (
    <nav aria-label="페이지" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className={`${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800`}>
          ‹ 이전
        </Link>
      )}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1] > 1 && <span className="text-gray-300">…</span>}
          {n === page ? (
            <span aria-current="page" className={`${btn} bg-blue-600 font-bold text-white`}>
              {n}
            </span>
          ) : (
            <Link href={href(n)} className={`${btn} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800`}>
              {n}
            </Link>
          )}
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} rel="next" className={`${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800`}>
          다음 ›
        </Link>
      )}
    </nav>
  );
}
