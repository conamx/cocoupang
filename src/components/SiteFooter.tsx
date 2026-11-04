import Link from 'next/link';
import { site } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white py-8 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-content px-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <Link href="/terms" className="hover:underline">이용약관</Link>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <Link href="/privacy" className="font-semibold hover:underline">개인정보처리방침</Link>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <Link href="/blog" className="hover:underline">정보</Link>
        </div>

        <div className="mx-auto mt-4 max-w-md rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-[12px] font-bold text-amber-800 dark:text-amber-200">광고안내</p>
          <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-amber-900 dark:text-amber-100">{site.partnersDisclosure}</p>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          {site.name}는 쿠팡 상품의 가격을 기록해 최저가 정보를 보여주는 서비스이며, 상품 판매에 직접 관여하지 않습니다.
        </p>
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} {site.name} ({new URL(site.url).host})
        </p>
      </div>
    </footer>
  );
}
