import crypto from 'node:crypto';

/**
 * 쿠팡 파트너스 Open API 클라이언트 (서버/스크립트 전용).
 *
 * 키가 없으면 null 을 반환하도록 설계되어, 개발 중에는 시드 데이터로 동작합니다.
 * 운영 시 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 를 채우세요.
 *
 * 파트너스 API에는 "상품 ID로 현재가 조회" 엔드포인트가 없습니다.
 * 그래서 카테고리 베스트·골드박스·키워드 검색 결과를 매일 받아 가격을 갱신합니다
 * (src/lib/sync/coupang-sync.ts).
 *
 * 문서: https://developers.coupangcorp.com (파트너스 Open API)
 */

const DOMAIN = 'https://api-gateway.coupang.com';
const BASE = '/v2/providers/affiliate_open_api/apis/openapi/v1';

export function hasCoupangKeys(): boolean {
  return Boolean(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY);
}

// HMAC 서명 (쿠팡 규격).
// signed-date 는 GMT 기준 yyMMdd'T'HHmmss'Z', 서명 메시지는 date + method + path + query('?' 제외).
function signedHeaders(method: string, path: string, query: string): Record<string, string> {
  const accessKey = process.env.COUPANG_ACCESS_KEY!;
  const secretKey = process.env.COUPANG_SECRET_KEY!;
  const iso = new Date().toISOString(); // 2026-10-06T07:25:00.000Z
  const datetime =
    iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10) + 'T' + iso.slice(11, 13) + iso.slice(14, 16) + iso.slice(17, 19) + 'Z';
  const message = datetime + method + path + query;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
  return { Authorization: authorization, 'Content-Type': 'application/json;charset=UTF-8' };
}

async function call<T>(method: 'GET' | 'POST', path: string, params?: Record<string, string | number>, body?: unknown): Promise<T> {
  // 공백은 '+' 가 아니라 %20 으로 (서명 문자열과 실제 요청이 정확히 같아야 함)
  const query = params
    ? Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const res = await fetch(DOMAIN + path + (query ? `?${query}` : ''), {
    method,
    headers: signedHeaders(method, path, query),
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`coupang ${res.status} ${path}: ${text.slice(0, 200)}`);
  const json = JSON.parse(text) as { rCode?: string; rMessage?: string; data?: T };
  if (json.rCode && json.rCode !== '0') throw new Error(`coupang rCode ${json.rCode}: ${json.rMessage}`);
  return json.data as T;
}

/** 파트너스 API 상품 응답을 정규화한 형태 */
export type CoupangItem = {
  productId: string;
  name: string;
  price: number;
  image: string;
  affiliateUrl: string; // 수수료 추적 포함 링크
  categoryName?: string;
  isRocket: boolean;
  rank?: number;
};

type RawItem = {
  productId: number | string;
  productName: string;
  productPrice: number | string;
  productImage: string;
  productUrl: string;
  categoryName?: string;
  isRocket?: boolean;
  rank?: number;
};

function normalize(r: RawItem, i: number): CoupangItem | null {
  const price = Number(r.productPrice);
  if (!r.productId || !Number.isFinite(price) || price <= 0) return null;
  return {
    productId: String(r.productId),
    name: r.productName.trim(),
    price: Math.round(price),
    image: r.productImage,
    affiliateUrl: r.productUrl,
    categoryName: r.categoryName,
    isRocket: Boolean(r.isRocket),
    rank: r.rank ?? i + 1,
  };
}

const subId = () => process.env.COUPANG_SUBID ?? 'shareinfo';

/** 카테고리 베스트 상품 (categoryId: 1001~1030, limit 최대 100) */
export async function fetchBestCategory(categoryId: string, limit = 50): Promise<CoupangItem[] | null> {
  if (!hasCoupangKeys()) return null;
  const data = await call<RawItem[]>('GET', `${BASE}/products/bestcategories/${categoryId}`, {
    limit,
    subId: subId(),
  });
  return (data ?? []).map(normalize).filter((x): x is CoupangItem => x !== null);
}

/** 골드박스(매일 07:30 갱신되는 오늘의 특가) */
export async function fetchGoldbox(): Promise<CoupangItem[] | null> {
  if (!hasCoupangKeys()) return null;
  const data = await call<RawItem[]>('GET', `${BASE}/products/goldbox`, { subId: subId() });
  return (data ?? []).map(normalize).filter((x): x is CoupangItem => x !== null);
}

/** 키워드 검색 (limit 최대 10). 검색 API는 시간당 호출 제한이 있으니 키워드 수를 조절하세요. */
export async function searchProducts(keyword: string, limit = 10): Promise<CoupangItem[] | null> {
  if (!hasCoupangKeys()) return null;
  const data = await call<{ productData?: RawItem[] }>('GET', `${BASE}/products/search`, {
    keyword,
    limit: Math.min(limit, 10),
    subId: subId(),
  });
  return (data?.productData ?? []).map(normalize).filter((x): x is CoupangItem => x !== null);
}

export type CoupangDeeplink = { originalUrl: string; shortenUrl: string; landingUrl: string };

/** 쿠팡 상품 URL을 파트너스 딥링크(수수료 추적 포함)로 변환. 한 번에 최대 20개. */
export async function createDeeplinks(urls: string[]): Promise<CoupangDeeplink[] | null> {
  if (!hasCoupangKeys() || urls.length === 0) return null;
  return call<CoupangDeeplink[]>('POST', `${BASE}/deeplink`, undefined, {
    coupangUrls: urls.slice(0, 20),
    subId: subId(),
  });
}
