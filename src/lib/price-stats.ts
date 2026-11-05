import type { Product } from '@/lib/types';

/**
 * 상품 페이지 가격 요약 (가격 기록 기반, 계산만).
 * 같은 최저·최고가가 여러 날이면 가장 최근 날짜를 씁니다.
 */
export type PriceStats = {
  count: number; // 기록 수
  days: number; // 첫 기록부터 오늘까지 일수
  firstAt?: string;
  checkedAt: string; // 마지막 확인일
  low: { price: number; at?: string };
  high: { price: number; at?: string };
  avg: number;
  changes30: number; // 최근 30일 가격이 바뀐 횟수
  pos: number; // 최저(0)~최고(100) 사이 현재 가격 위치 %
  avgPos: number; // 같은 기준의 평균 위치 %
  verdict: { text: string; tone: 'down' | 'up' | 'flat' };
};

const DAY = 86_400_000;

export const md = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000); // 한국 날짜
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

export function priceStats(p: Product): PriceStats {
  const hist = [...p.history].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const count = hist.length;
  const prices = hist.map((h) => h.price);
  const lowPrice = count ? Math.min(...prices) : p.lowestPrice;
  const highPrice = count ? Math.max(...prices) : p.highestPrice;
  const lowAt = [...hist].reverse().find((h) => h.price === lowPrice)?.observedAt;
  const highAt = [...hist].reverse().find((h) => h.price === highPrice)?.observedAt;
  const avg = count ? Math.round(prices.reduce((s, v) => s + v, 0) / count / 10) * 10 : p.currentPrice;
  const firstAt = hist[0]?.observedAt;
  const days = firstAt ? Math.max(1, Math.round((Date.now() - new Date(firstAt).getTime()) / DAY) + 1) : 1;

  const since = Date.now() - 30 * DAY;
  let changes30 = 0;
  for (let i = 1; i < count; i++) {
    if (new Date(hist[i].observedAt).getTime() >= since && hist[i].price !== hist[i - 1].price) changes30++;
  }

  const span = Math.max(1, highPrice - lowPrice);
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
  const pos = clamp(((p.currentPrice - lowPrice) / span) * 100);
  const avgPos = clamp(((avg - lowPrice) / span) * 100);

  const cur = p.currentPrice;
  const diffPct = avg ? Math.round((Math.abs(cur - avg) / avg) * 100) : 0;
  // 짧은 라벨 하나로만 판정 (문장 반복 없이)
  let verdict: PriceStats['verdict'];
  if (count < 2 || highPrice === lowPrice) verdict = { text: '가격 기록 시작', tone: 'flat' };
  else if (cur <= lowPrice) verdict = { text: '지금 최저가', tone: 'down' };
  else if (cur >= highPrice) verdict = { text: '최근 최고가', tone: 'up' };
  else if (cur < avg) verdict = { text: `평균보다 ${diffPct}% 저렴`, tone: 'down' };
  else if (cur > avg) verdict = { text: `평균보다 ${diffPct}% 비쌈`, tone: 'up' };
  else verdict = { text: '평균 가격', tone: 'flat' };

  return {
    count,
    days,
    firstAt,
    checkedAt: p.updatedAt,
    low: { price: lowPrice, at: lowAt },
    high: { price: highPrice, at: highAt },
    avg,
    changes30,
    pos,
    avgPos,
    verdict,
  };
}
