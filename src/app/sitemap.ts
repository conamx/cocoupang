import type { MetadataRoute } from 'next';
import { site, coupangCategories } from '@/lib/site';
import { getProductIndex, getDeals, getPosts, getBrands } from '@/lib/data';

// 예약 발행한 정보글이 발행일에 맞춰 들어가도록 1시간마다 새로 만든다
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url;
  const [products, deals, posts, brands] = await Promise.all([
    getProductIndex(),
    getDeals(5000),
    getPosts(),
    getBrands(),
  ]);

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/coupang`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/deal`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/travel`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/blog`, changeFrequency: 'weekly', priority: 0.7 },
  ];

  return [
    ...staticUrls,
    ...coupangCategories.map((c) => ({
      url: `${base}/coupang/category/${c.id}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${base}/coupang/${p.id}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...deals.map((d) => ({
      url: `${base}/deal/${d.id}`,
      lastModified: new Date(d.postedAt),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    ...posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...brands.map((b) => ({
      url: `${base}/travel/${b.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ];
}
