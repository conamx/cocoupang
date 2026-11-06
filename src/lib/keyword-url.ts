import { searchKeywords } from '@/lib/sync/keywords';
import { coupangCategories, etcCategory } from '@/lib/site';

/**
 * 품목(검색어)별 모음 페이지 주소 — /coupang/k/계란, /coupang/k/생수-2L
 * 수집 검색어 목록(keywords.ts)에 있는 것만 페이지가 됩니다.
 */
export const keywordSlug = (k: string) => k.trim().replace(/\s+/g, '-');
export const keywordPath = (k: string) => `/coupang/k/${keywordSlug(k)}`;

/** 주소 조각 → 검색어 (목록에 없으면 null) */
export function findKeyword(slug: string): { keyword: string; categoryId: string; categoryLabel: string } | null {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {}
  const hit = searchKeywords.find((k) => keywordSlug(k.keyword) === s);
  if (!hit) return null;
  const cat = coupangCategories.find((c) => c.id === hit.categoryId) ?? etcCategory;
  return { keyword: hit.keyword, categoryId: cat.id, categoryLabel: cat.label };
}

/** 같은 카테고리의 다른 검색어 */
export const keywordsInCategory = (categoryId: string) =>
  searchKeywords.filter((k) => k.categoryId === categoryId).map((k) => k.keyword);

/** 검색어 페이지를 검색 노출하는 최소 상품 수 (너무 빈 페이지는 noindex) */
export const KEYWORD_MIN_PRODUCTS = 3;
