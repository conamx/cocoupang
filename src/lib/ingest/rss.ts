// 의존성 없는 가벼운 RSS 2.0 파서. <item> 단위로 주요 필드를 추출합니다.

export type RssItem = {
  title: string;
  link: string;
  description: string;
  category?: string;
  pubDate?: string;
  guid?: string;
};

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : undefined;
}

export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const b of blocks) {
    const title = tag(b, 'title');
    const link = tag(b, 'link');
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description: tag(b, 'description') ?? '',
      category: tag(b, 'category'),
      pubDate: tag(b, 'pubDate'),
      guid: tag(b, 'guid'),
    });
  }
  return items;
}

// description 안의 첫 <img src> 추출 (썸네일).
export function firstImage(html: string): string | undefined {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1];
}
