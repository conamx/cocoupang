export function won(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function isoDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

// 쿠팡 파트너스 딥링크 생성 (실제 서명 호출은 lib/coupang.ts 참고).
// 키가 없으면 원본 상품 URL 그대로 반환합니다.
export function coupangLink(productId: string, vendorItemId?: string): string {
  const base = `https://www.coupang.com/vp/products/${productId}`;
  return vendorItemId ? `${base}?vendorItemId=${vendorItemId}` : base;
}
