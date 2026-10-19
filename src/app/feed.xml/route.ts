import { site } from '@/lib/site';
import { getDeals, getPosts, getProducts } from '@/lib/data';
import { won } from '@/lib/format';
import { productPath } from '@/lib/product-url';

// 네이버 서치어드바이저 'RSS 제출'용 — 새 상품·정보글·핫딜을 최신순으로
export const revalidate = 3600;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type Item = { title: string; link: string; category: string; date: string; description: string };

export async function GET() {
  const [products, posts, deals] = await Promise.all([getProducts(undefined, 200), getPosts(), getDeals(50)]);
  const list: Item[] = [
    ...products.map((p) => ({
      title: `${p.name} 최저가`,
      link: `${site.url}${productPath(p)}`,
      category: p.categoryLabel,
      date: p.updatedAt,
      description: `${p.name} 쿠팡 현재가 ${won(p.currentPrice)}, 역대 최저가 ${won(p.lowestPrice)}. 가격 변동 추이를 확인하세요.`,
    })),
    ...posts.map((p) => ({
      title: p.title,
      link: `${site.url}/blog/${p.slug}`,
      category: p.category,
      date: p.date,
      description: p.summary,
    })),
    ...deals.map((d) => ({
      title: d.title,
      link: `${site.url}/deal/${d.id}`,
      category: d.category,
      date: d.postedAt,
      description: d.title,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 100);

  const items = list
    .map(
      (i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${i.link}</link>
      <guid isPermaLink="true">${i.link}</guid>
      <description>${esc(i.description)}</description>
      <category>${esc(i.category)}</category>
      <pubDate>${new Date(i.date).toUTCString()}</pubDate>
    </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(site.name)}</title>
    <link>${site.url}</link>
    <description>${esc(site.description)}</description>
    <language>ko</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
