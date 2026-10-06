import Link from 'next/link';
import { site } from '@/lib/site';
import { getBrands } from '@/lib/data';

export async function SiteFooter() {
  const travel = await getBrands('travel');
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white py-8 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-content px-4 text-center">
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold text-gray-400">인기 할인코드</p>
          <div className="mx-auto grid max-w-md grid-cols-2 gap-1.5 sm:grid-cols-3">
            {travel.map((b) => (
              <Link
                key={b.slug}
                href={`/travel/${b.slug}`}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
              >
                {b.name} 할인코드
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <Link href="/terms" className="hover:underline">이용약관</Link>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <Link href="/privacy" className="font-semibold hover:underline">개인정보처리방침</Link>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <Link href="/blog" className="hover:underline">정보</Link>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          {site.name}는 커뮤니티에 공유된 핫딜 정보를 모아 보여주는 서비스이며, 상품 판매에 직접 관여하지 않습니다.
          <br />
          {site.partnersDisclosure}
        </p>
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} {site.name} ({new URL(site.url).host})
        </p>
      </div>
    </footer>
  );
}
