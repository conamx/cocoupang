import { coupangCategories, etcCategory } from '@/lib/site';

/**
 * 관리자 "붙여넣기 등록" 파서 (브라우저·서버 공용, 순수 함수).
 *
 * 받는 형식 — 섞여 있어도 됩니다:
 *  1) 쿠팡 파트너스 "HTML 코드"  <a href="https://link.coupang.com/a/..."><img src="..." alt="상품명"></a>
 *  2) 엑셀/구글시트에서 복사한 행 (탭 구분, 열 순서 무관)  링크 | 상품명 | 가격 | 이미지 | 카테고리
 *  3) 줄 단위 블록  상품명 ↵ 가격 ↵ 링크   (링크가 나오기 전 줄들이 그 상품 정보가 됨)
 */

export type ParsedRow = {
  link: string;
  name?: string;
  price?: number;
  image?: string;
  categoryId?: string;
};

const ALL_CATS = [...coupangCategories, etcCategory];

const isCoupangLink = (s: string) => /^https?:\/\/([a-z0-9-]+\.)*(coupang\.com|coupa\.ng)\//i.test(s);
const isImageUrl = (s: string) =>
  /^https?:\/\//i.test(s) && (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(s) || /coupangcdn|ads-partners/i.test(s));

export function parsePrice(s: string): number | undefined {
  const m = s.replace(/\s/g, '').match(/^₩?([\d,]+)(원)?$/);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ''));
  return n >= 10 ? n : undefined;
}

export function matchCategoryId(s: string): string | undefined {
  const t = s.trim();
  return ALL_CATS.find((c) => c.id === t || c.label === t)?.id;
}

/** 상품명 정리: 공백 정리, 광고성 꼬리표 제거 */
export function cleanName(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^\s*(\[[^\]]{1,12}\]|【[^】]{1,12}】)\s*/, '') // 앞머리 [쿠팡단독] 같은 태그
    .trim();
}

/** 쿠팡 URL에서 상품 ID 추출 (단축링크는 서버에서 따로 해석) */
export function productIdFromUrl(url: string): string | undefined {
  return url.match(/\/vp\/products\/(\d+)/)?.[1] ?? url.match(/[?&]pageKey=(\d+)/)?.[1];
}

/** 이미지 주소 칸에 상품 링크를 넣은 경우 등 — 이미지로 쓸 수 없는 주소인지 */
export function badImageReason(url?: string): string | undefined {
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) return '이미지 주소는 http로 시작해야 해요';
  if (isCoupangLink(url) && !isImageUrl(url))
    return '이미지 주소가 아니라 상품 링크예요 — 사진을 우클릭 → "이미지 주소 복사"';
  return undefined;
}

export const isAffiliateLink = (url: string) => /link\.coupang\.com|coupa\.ng/i.test(url);

function fromCells(cells: string[], into: Partial<ParsedRow>) {
  for (const raw of cells) {
    const c = raw.trim();
    if (!c) continue;
    if (isImageUrl(c)) into.image ??= c;
    else if (isCoupangLink(c)) into.link ??= c;
    else if (parsePrice(c) !== undefined && into.price === undefined) into.price = parsePrice(c);
    else if (matchCategoryId(c) && !into.categoryId) into.categoryId = matchCategoryId(c);
    else if (!/^https?:\/\//i.test(c) && (!into.name || c.length > into.name.length)) into.name = cleanName(c);
  }
}

// 엑셀 머리글 줄(링크 / 상품명 / 가격 …)은 건너뜀
const HEADER = /^((링크|url|상품명|이름|가격|이미지|사진|카테고리|분류)[\s|,]*)+$/i;

export function parsePaste(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];

  // 1) HTML 코드 블록
  const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let rest = text;
  for (const m of text.matchAll(anchor)) {
    const [whole, href, inner] = m;
    if (!isCoupangLink(href)) continue;
    const img = inner.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1];
    const alt = inner.match(/<img\b[^>]*alt=["']([^"']*)["']/i)?.[1];
    const label = inner.replace(/<[^>]+>/g, ' ').trim();
    rows.push({ link: href, image: img, name: cleanName(alt || label) || undefined });
    rest = rest.replace(whole, '\n');
  }

  // 2)·3) 표/줄 단위
  let pending: Partial<ParsedRow> = {};
  for (const line of rest.replace(/<[^>]+>/g, ' ').split(/\r?\n/)) {
    if (!line.trim() || HEADER.test(line.trim())) continue;
    const cells = line.includes('\t') ? line.split('\t') : line.split(/\s+\|\s+|\s{2,}/);
    const cur: Partial<ParsedRow> = {};
    fromCells(cells, cur);
    if (cur.link) {
      // 링크가 있는 줄 = 상품 하나 확정. 앞 줄에서 모아둔 정보와 합침.
      rows.push({
        link: cur.link,
        name: cur.name ?? pending.name,
        price: cur.price ?? pending.price,
        image: cur.image ?? pending.image,
        categoryId: cur.categoryId ?? pending.categoryId,
      });
      pending = {};
    } else {
      fromCells(cells, pending);
    }
  }

  // 같은 링크 중복 제거 (뒤에 나온 값 우선)
  const byLink = new Map<string, ParsedRow>();
  for (const r of rows) byLink.set(r.link, { ...byLink.get(r.link), ...stripUndefined(r) });
  return [...byLink.values()];
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
