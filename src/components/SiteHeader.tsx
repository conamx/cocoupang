import Link from 'next/link';
import { site } from '@/lib/site';
import { ThemeToggle } from './ThemeToggle';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <div className="mx-auto flex max-w-content items-center gap-3 px-4 py-3 sm:gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 text-xl font-extrabold text-gray-900 dark:text-white">
          <span>
            share<span className="text-blue-600">info</span>
          </span>
        </Link>

        <form action="/search" className="mx-auto hidden w-full min-w-0 max-w-md sm:block">
          <div className="relative">
            <input
              type="search"
              name="q"
              placeholder="상품·핫딜 검색"
              className="w-full rounded-full border border-gray-300 bg-gray-50 py-2 pl-4 pr-10 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900"
            />
            <button type="submit" aria-label="검색" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-500 hover:text-blue-600">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <circle cx="9" cy="9" r="6" />
                <path d="M14 14l4 4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ThemeToggle />
        </div>
      </div>

      <nav className="border-t border-gray-100 dark:border-gray-800/60">
        <div className="no-scrollbar mx-auto flex max-w-content items-center gap-1 overflow-x-auto px-4">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-bold text-gray-700 transition hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
