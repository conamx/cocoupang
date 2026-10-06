import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { getProducts, getDeals, getPosts, getBrands } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url;
  const [products, deals, posts, brands] = await Promise.all([
    getProducts(),
    getDeals(),
    getPosts(),
    getBrands(),
  ]);

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/coupang`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/travel`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/blog`, changeFrequency: 'weekly', priority: 0.7 },
  ];

  return [
    ...staticUrls,
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
