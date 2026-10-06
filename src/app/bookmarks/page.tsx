'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readBookmarks, removeBookmark, type Bookmark } from '@/lib/bookmarks';

export default function BookmarksPage() {
  const [items, setItems] = useState<Bookmark[]>([]);

  useEffect(() => {
    const refresh = () => setItems(readBookmarks());
    refresh();
    window.addEventListener('bookmarks-changed', refresh);
    return () => window.removeEventListener('bookmarks-changed', refresh);
  }, []);

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold">찜 목록</h1>
      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">
          아직 찜한 상품·딜이 없습니다. 하트를 눌러 저장하세요.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((b) => (
            <li key={b.key} className="flex items-center gap-3 py-3">
              <Link href={b.href} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img referrerPolicy="no-referrer" src={b.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium">{b.title}</p>
                  {b.price && <p className="text-sm font-bold text-gray-900 dark:text-white">{b.price}</p>}
                </div>
              </Link>
              <button
                onClick={() => removeBookmark(b.key)}
                className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
