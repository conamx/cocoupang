'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 가로로 넘기는 줄 + 좌우 화살표 버튼.
 * 넘길 게 남아 있는 쪽에만 버튼·흐림 효과가 보입니다. (모바일은 손가락으로 밀어도 됨)
 */
export function HScroll({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    // 지금 선택된 칸이 화면 밖이면 보이게
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: 'smooth' });
  const btn =
    'absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-md ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700';

  return (
    <div className={`relative ${className}`}>
      <div ref={ref} className="no-scrollbar flex gap-1.5 overflow-x-auto scroll-smooth py-0.5">
        {children}
      </div>
      {edge.left && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-gray-50 to-transparent dark:from-black" />
          <button type="button" aria-label="이전 카테고리" onClick={() => go(-1)} className={`${btn} left-0`}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M12.7 5.3a1 1 0 0 1 0 1.4L9.4 10l3.3 3.3a1 1 0 1 1-1.4 1.4l-4-4a1 1 0 0 1 0-1.4l4-4a1 1 0 0 1 1.4 0z" />
            </svg>
          </button>
        </>
      )}
      {edge.right && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-gray-50 to-transparent dark:from-black" />
          <button type="button" aria-label="다음 카테고리" onClick={() => go(1)} className={`${btn} right-0`}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M7.3 14.7a1 1 0 0 1 0-1.4L10.6 10 7.3 6.7a1 1 0 0 1 1.4-1.4l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4 0z" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
