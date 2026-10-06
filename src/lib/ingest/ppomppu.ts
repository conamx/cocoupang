import type { RawDeal, SourceAdapter } from './types';
import { parseRss, firstImage } from './rss';

// 뽐뿌 핫딜 RSS 어댑터. 표준 RSS 2.0.
// 제목 패턴 예: "[지마켓] 상품명 (가격/배송)" → 카테고리/가격을 최대한 추출.
const FEED = 'https://www.ppomppu.co.kr/rss.php?id=ppomppu';

function extractPrice(title: string): string | undefined {
  // 괄호 안 "12,000원" / "$12" 류를 가볍게 추출
  const m = title.match(/([₩$]?\s?[\d,]+\s?원?)(?=\s*[/)\]])/);
  return m ? m[1].trim() : undefined;
}

export const ppomppu: SourceAdapter = {
  name: '뽐뿌',
  async fetchDeals(): Promise<RawDeal[]> {
    const res = await fetch(FEED, {
      headers: { 'User-Agent': 'shareinfo-bot/1.0 (+https://shareinfo.co.kr)' },
      // RSS는 캐시 가능. 과도한 호출 방지.
      next: { revalidate: 600 },
    });
    if (!res.ok) throw new Error(`ppomppu RSS ${res.status}`);
    const xml = await res.text();
    const items = parseRss(xml);

    return items.map((it, i): RawDeal => {
      const idMatch = it.link.match(/no=(\d+)/) ?? it.guid?.match(/(\d+)/);
      return {
        sourceId: idMatch?.[1] ?? String(i),
        source: '뽐뿌',
        title: it.title.replace(/\s+/g, ' ').trim(),
        url: it.link,
        category: it.category ?? '핫딜',
        price: extractPrice(it.title),
        thumb: firstImage(it.description),
        postedAt: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
      };
    });
  },
};
