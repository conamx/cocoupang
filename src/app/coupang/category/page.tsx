import type { Metadata } from 'next';
import { CategoryGrid } from '@/components/CategoryGrid';
import { getActiveCategories } from '@/lib/data';
import { site } from '@/lib/site';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '쿠팡 카테고리별 최저가',
  description: '식품·생활용품·PC부품·가전디지털 등 쿠팡 카테고리별 상품의 오늘 가격과 역대 최저가를 확인하세요.',
  alternates: { canonical: '/coupang/category' },
};

export default async function CategoryIndexPage() {
  const cats = await getActiveCategories();
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: site.url },
        { '@type': 'ListItem', position: 2, name: '카테고리', item: `${site.url}/coupang/category` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: '쿠팡 카테고리',
      numberOfItems: cats.length,
      itemListElement: cats.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.label,
        url: `${site.url}/coupang/category/${c.id}`,
      })),
    },
  ];
  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="mb-1 text-xl font-bold">카테고리</h1>
      <p className="mb-5 text-[13px] text-gray-500">카테고리를 고르면 상품별 오늘 가격과 역대 최저가를 볼 수 있어요.</p>
      <CategoryGrid />
    </div>
  );
}
