'use client';

import { useEffect, useState } from 'react';
import { isBookmarked, toggleBookmark } from '@/lib/bookmarks';

type Props = {
  type: 'product' | 'deal';
  id: string;
  title: string;
  image: string;
  href: string;
  price?: string;
};

export function BookmarkButton(props: Props) {
  const key = `${props.type}:${props.id}`;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isBookmarked(key));
  }, [key]);

  function onClick() {
    setSaved(toggleBookmark({ ...props, key }));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? '찜 해제' : '찜하기'}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
        saved
          ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
          : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {saved ? '찜됨' : '찜하기'}
    </button>
  );
}
