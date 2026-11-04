import { site } from '@/lib/site';

/**
 * 쿠팡 파트너스 대가성 문구 — 모든 페이지 맨 위(헤더 바로 아래)에 본문과 구별되게 표시.
 * 파트너스 가이드: 게시물 첫 부분 · 본문보다 크거나 눈에 띄는 색 · 조건부 표현 없이 명확하게
 */
export function PartnersDisclosure() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
      <p className="mx-auto flex max-w-content items-center gap-2 px-4 py-2 text-[13px] font-bold leading-snug text-amber-900 sm:text-sm dark:text-amber-200">
        <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[11px] font-extrabold text-white">광고</span>
        {site.partnersDisclosure}
      </p>
    </div>
  );
}
