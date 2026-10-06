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

// 전일대비 변동률(%) — 양수 상승, 음수 하락, 전일 기록이 없으면 null
export function dayChange(p: { currentPrice: number; prevPrice?: number }): number | null {
  if (!p.prevPrice) return null;
  return Math.round(((p.currentPrice - p.prevPrice) / p.prevPrice) * 1000) / 10;
}

// 전일대비 하락률(%) — 정렬용 (하락이 아니면 0)
export function dropRate(p: { currentPrice: number; prevPrice?: number }): number {
  const c = dayChange(p);
  return c !== null && c < 0 ? -c : 0;
}

// 역대 최고가 대비 할인율(%)
export function discountRate(p: { currentPrice: number; highestPrice: number }): number {
  if (p.highestPrice <= p.currentPrice) return 0;
  return Math.round(((p.highestPrice - p.currentPrice) / p.highestPrice) * 100);
}

// 구매 링크: 파트너스 API가 준 수수료 추적 링크 우선, 없으면 원본 상품 URL.
export function coupangLink(p: { id: string; vendorItemId?: string; affiliateUrl?: string }): string {
  if (p.affiliateUrl) return p.affiliateUrl;
  const base = `https://www.coupang.com/vp/products/${p.id}`;
  return p.vendorItemId ? `${base}?vendorItemId=${p.vendorItemId}` : base;
}
