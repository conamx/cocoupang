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
