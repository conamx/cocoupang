import type { CSSProperties } from 'react';

/**
 * 쿠팡 파트너스 '블로그용 HTML' 이미지(세로 배너 1:2)인지.
 * 배너 = 위 쿠팡 로고 · 가운데 상품 사진 · 아래 상품명/로켓배송/쇼핑하기 버튼.
 */
export const isPartnerBanner = (src?: string) => !!src && /\/affiliate\/banner\//.test(src);

/**
 * 정사각형 칸에 배너를 넣을 때 가운데 상품 사진 부분(세로 12%~62%)만 보이게.
 * object-fit: cover 로 폭을 맞추면 세로 절반이 보이고, 위치 24% → 12%~62% 구간.
 */
export function bannerCropStyle(src?: string): CSSProperties | undefined {
  return isPartnerBanner(src) ? { objectFit: 'cover', objectPosition: '50% 24%' } : undefined;
}

/**
 * 쿠팡 상품 이미지를 작은 썸네일 주소로 바꿈 (원본 약 260KB → 320px 썸네일 약 25KB).
 * 쿠팡 CDN 이 경로만 바꾸면 크기별 썸네일을 바로 만들어 줌 — 우리 서버 비용 없음.
 * 쿠팡 이미지가 아니거나 파트너스 배너면 그대로 둠.
 */
export function coupangThumb(src: string | undefined, size: 230 | 320 | 492 = 320): string | undefined {
  if (!src || isPartnerBanner(src)) return src;
  const box = `${size}x${size}ex`;
  // 이미 썸네일 주소면 크기만 교체
  const t = src.match(/^https:\/\/thumbnail\d*\.coupangcdn\.com\/thumbnails\/remote\/[^/]+\/(image\/.+)$/);
  if (t) return `https://thumbnail6.coupangcdn.com/thumbnails/remote/${box}/${t[1]}`;
  const m = src.match(/^https:\/\/image\d*\.coupangcdn\.com\/(image\/.+)$/);
  return m ? `https://thumbnail6.coupangcdn.com/thumbnails/remote/${box}/${m[1]}` : src;
}
