import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-content flex-col items-center px-4 py-24 text-center">
      <p className="text-4xl font-black text-gray-300 dark:text-gray-700">404</p>
      <h1 className="mt-3 text-lg font-bold">페이지를 찾을 수 없어요</h1>
      <p className="mt-1 text-sm text-gray-500">종료됐거나 삭제된 딜·상품이거나, 주소가 바뀌었을 수 있어요.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700">
          핫딜 보러가기 →
        </Link>
        <Link href="/coupang" className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
          쿠팡 최저가
        </Link>
      </div>
    </div>
  );
}
