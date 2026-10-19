import { shortName } from '@/lib/product-summary';

/**
 * 상품 주소: /coupang/{짧은 상품명}-{쿠팡 상품ID}  예) /coupang/amd-라이젠5-5세대-7500f-8394671274
 * 주소에 상품명이 들어가 검색 노출에 유리. 상품 찾기는 끝의 숫자 ID로만 하므로 이름이 바뀌어도 안전
 * (예전 /coupang/{ID} 나 이름이 달라진 주소는 상품 페이지에서 새 주소로 영구 이동)
 */
export function productSlug(p: { id: string; name: string }): string {
  const words = shortName(p.name)
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s-]/g, ' ')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  const base = words.join('-').slice(0, 40).replace(/-+$/, '');
  return base ? `${base}-${p.id}` : p.id;
}

export const productPath = (p: { id: string; name: string }) => `/coupang/${productSlug(p)}`;

/** 주소 조각(슬러그 또는 예전 숫자 ID)에서 상품 ID 추출 */
export function productIdFromParam(param: string): string | undefined {
  let s = param;
  try {
    s = decodeURIComponent(param);
  } catch {}
  return s.match(/(\d+)$/)?.[1];
}

export function decodedParam(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
