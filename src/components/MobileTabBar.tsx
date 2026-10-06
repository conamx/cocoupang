import Link from 'next/link';

const tabs = [
  { href: '/', label: '홈', icon: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9.5 21v-6h5v6' },
  { href: '/coupang', label: '최저가', icon: 'M3.5 17l5-5 4 4 8-8M15.5 8h5v5' },
  { href: '/travel', label: '할인코드', icon: 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 1 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 1 0 0-4V8Z' },
  { href: '/search', label: '검색', icon: 'M11 17.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM16 16l4.5 4.5' },
  { href: '/blog', label: '정보', icon: 'M4 5h16M4 12h16M4 19h10' },
];

export function MobileTabBar() {
  return (
    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-gray-800 dark:bg-gray-950/95"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="flex h-[3.75rem] flex-col items-center justify-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400"
        >
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d={t.icon} />
          </svg>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
