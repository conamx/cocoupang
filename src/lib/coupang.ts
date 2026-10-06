import crypto from 'node:crypto';

/**
 * 쿠팡 파트너스 Open API 클라이언트 (서버 전용).
 *
 * 키가 없으면 null 을 반환하도록 설계되어, 개발 중에는 시드 데이터로 동작합니다.
 * 운영 시 .env 에 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 를 채우세요.
 *
 * 문서: https://developers.coupangcorp.com (파트너스 Open API)
 */

const DOMAIN = 'https://api-gateway.coupang.com';

function hasKeys(): boolean {
  return Boolean(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY);
}

// HMAC 서명 (쿠팡 파트너스 규격)
function signedHeaders(method: string, path: string): Record<string, string> {
  const accessKey = process.env.COUPANG_ACCESS_KEY!;
  const secretKey = process.env.COUPANG_SECRET_KEY!;
  const datetime =
    new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const message = datetime + method + path;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
  return { Authorization: authorization, 'Content-Type': 'application/json' };
}

export type CoupangDeeplink = { originalUrl: string; shortenUrl: string; landingUrl: string };

/** 상품 URL을 파트너스 딥링크(수수료 추적 포함)로 변환 */
export async function createDeeplinks(urls: string[]): Promise<CoupangDeeplink[] | null> {
  if (!hasKeys()) return null;
  const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
  const res = await fetch(DOMAIN + path, {
    method: 'POST',
    headers: signedHeaders('POST', path),
    body: JSON.stringify({ coupangUrls: urls, subId: process.env.COUPANG_SUBID ?? 'shareinfo' }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

/** 특정 상품의 현재 가격 조회 (가격 추적 크론에서 사용) */
export async function fetchProductPrice(productId: string): Promise<number | null> {
  if (!hasKeys()) return null;
  // 실제 구현: 파트너스 상품검색/상세 API로 가격 파싱.
  // 여기서는 연동 지점만 표시합니다.
  void productId;
  return null;
}
