import { site } from '@/lib/site';

// 표시 방식: 모든 페이지 상단 한 줄(A안) + 하단 '광고안내'. 게시물별 한 줄(B안)은 꺼둠
export const SHOW_TOP_DISCLOSURE = true;
export const SHOW_POST_DISCLOSURE = false;

const Badge = () => (
  <span className="shrink-0 rounded bg-amber-500 px-1 py-px text-[10px] font-extrabold text-white">광고</span>
);

/** (A안) 모든 페이지 헤더 바로 아래 한 줄 */
export function PartnersDisclosure() {
  return (
    <div className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <p className="mx-auto flex max-w-content items-center gap-1.5 whitespace-nowrap px-4 py-1.5 text-[11px] font-semibold leading-tight text-gray-600 sm:text-xs dark:text-gray-300">
        <Badge />
        <span className="sm:hidden">쿠팡 파트너스 활동의 일환으로 수수료를 제공받습니다.</span>
        <span className="hidden sm:inline">{site.partnersDisclosure}</span>
      </p>
    </div>
  );
}

/**
 * (B안) 게시물(상품·정보글) 첫 부분에 한 줄 — 쿠팡 파트너스 가이드: 첫 부분 · 눈에 띄는 색 · 조건부 표현 없이
 */
export function PostDisclosure() {
  return (
    <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-bold leading-snug text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <Badge />
      <span>{site.partnersDisclosure}</span>
    </p>
  );
}
