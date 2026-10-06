import type { RawDeal, SourceAdapter } from './types';
import { parseRss, firstImage } from './rss';

export type RssAdapterConfig = {
  name: string; // 소스 표기 (뽐뿌 / 펨코 / 루리웹)
  feedUrl: string; // RSS 2.0 주소
  // 링크에서 원문 고유 id 추출 (중복 제거 키). 기본: no=\\d+ 또는 숫자열
  idPattern?: RegExp;
};

function extractPrice(title: string): string | undefined {
  const m = title.match(/([₩$]?\s?[\d,]{2,}\s?원?)(?=\s*[/)\]]|$)/);
  return m ? m[1].trim() : undefined;
}

// RSS 2.0 커뮤니티 핫딜 소스용 범용 어댑터 팩토리.
// 새 커뮤니티는 설정만 추가하면 됩니다.
export function createRssAdapter(cfg: RssAdapterConfig): SourceAdapter {
  const idPattern = cfg.idPattern ?? /(?:no|document_srl|wr_id)=(\d+)|\/(\d{4,})(?:[/?#]|$)/;
  return {
    name: cfg.name,
    async fetchDeals(): Promise<RawDeal[]> {
      const res = await fetch(cfg.feedUrl, {
        headers: { 'User-Agent': 'shareinfo-bot/1.0 (+https://shareinfo.co.kr)' },
        next: { revalidate: 600 },
      });
      if (!res.ok) throw new Error(`${cfg.name} RSS ${res.status}`);
      const xml = await res.text();
      const items = parseRss(xml);

      return items.map((it, i): RawDeal => {
        const m = it.link.match(idPattern) ?? it.guid?.match(/(\d{3,})/);
        const sourceId = m?.[1] ?? m?.[2] ?? String(i);
        return {
          sourceId,
          source: cfg.name,
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
}
