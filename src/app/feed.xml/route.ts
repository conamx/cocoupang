import { site } from '@/lib/site';
import { getDeals } from '@/lib/data';

export const revalidate = 300;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET() {
  const deals = await getDeals(50);
  const items = deals
    .map(
      (d) => `    <item>
      <title>${esc(d.title)}</title>
      <link>${site.url}/deal/${d.id}</link>
      <guid isPermaLink="true">${site.url}/deal/${d.id}</guid>
      <category>${esc(d.category)}</category>
      <pubDate>${new Date(d.postedAt).toUTCString()}</pubDate>
    </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(site.name)} 핫딜</title>
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
