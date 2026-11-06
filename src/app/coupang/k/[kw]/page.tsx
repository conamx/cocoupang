import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getKeywordCounts, getKeywordProducts } from '@/lib/data';
import { ProductCard } from '@/components/ProductCard';
import { site } from '@/lib/site';
import { won } from '@/lib/format';
import { productPath } from '@/lib/product-url';
import { categoryPath } from '@/lib/category-url';
import { KEYWORD_MIN_PRODUCTS, findKeyword, keywordPath, keywordsInCategory } from '@/lib/keyword-url';
import { md } from '@/lib/price-stats';
import type { Product } from '@/lib/types';

/**
 * 품목(검색어)별 쿠팡 최저가 모음 — "계란 최저가", "생수 최저가" 같은 검색으로 들어오는 페이지.
 * 하루 한 번 새로 만듦 (상품 가격은 매시간 수집에서 갱신, 이 페이지는 하루 단위로 반영).
 */
// 12시간마다 갱신 (방문 시 저장된 페이지를 바로 보여주고 뒤에서 새로 만듦)
export const revalidate = 43200;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const atLowest = (p: Product) => p.highestPrice > p.lowestPrice && p.currentPrice <= p.lowestPrice;

function summarize(products: Product[]) {
  const prices = products.map((p) => p.currentPrice);
  const cheapest = products.reduce<Product | undefined>((a, p) => (!a || p.currentPrice < a.currentPrice ? p : a), undefined);
  const lowestNow = products.filter(atLowest);
  const updated = products.reduce((a, p) => (p.updatedAt > a ? p.updatedAt : a), '');
  return { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0, cheapest, lowestNow, updated };
}

export async function generateMetadata({ params }: { params: Promise<{ kw: string }> }): Promise<Metadata> {
  const k = findKeyword((await params).kw);
  if (!k) return {};
  const products = await getKeywordProducts(k.keyword);
  const s = summarize(products);
  const title = `${k.keyword} 최저가 · 쿠팡 가격변동 비교`;
  const description = products.length
    ? `쿠팡 ${k.keyword} 인기 상품 ${products.length}개의 오늘 가격과 역대가를 비교했어요. ${won(s.min)}부터${s.lowestNow.length ? ` · 지금 역대 최저가 ${s.lowestNow.length}개` : ''} · ${md(s.updated)} 기준.`
    : `쿠팡 ${k.keyword} 가격 변동과 역대 최저가를 매일 기록합니다.`;
  return {
    title,
    description,
    alternates: { canonical: keywordPath(k.keyword) },
    // 상품이 너무 적으면 빈 페이지로 보이지 않게 검색 노출 제외
    ...(products.length < KEYWORD_MIN_PRODUCTS ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url: `${site.url}${keywordPath(k.keyword)}`, images: products[0] ? [products[0].image] : undefined },
  };
}

export default async function KeywordPage({ params }: { params: Promise<{ kw: string }> }) {
  const k = findKeyword((await params).kw);
  if (!k) notFound();
  const [products, counts] = await Promise.all([getKeywordProducts(k.keyword), getKeywordCounts()]);
  const s = summarize(products);
  const url = `${site.url}${keywordPath(k.keyword)}`;
  // 같은 카테고리의 다른 품목 (상품이 충분히 모인 것만)
  const related = keywordsInCategory(k.categoryId)
    .filter((w) => w !== k.keyword && (counts[w] ?? 0) >= KEYWORD_MIN_PRODUCTS)
    .slice(0, 24);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${k.keyword} 쿠팡 최저가`,
      numberOfItems: products.length,
      itemListElement: products.slice(0, 20).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${site.url}${productPath(p)}`,
        name: p.name,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '셰어인포', item: site.url },
        { '@type': 'ListItem', position: 2, name: `${k.categoryLabel} 최저가`, item: `${site.url}${categoryPath(k.categoryId)}` },
        { '@type': 'ListItem', position: 3, name: `${k.keyword} 최저가`, item: url },
      ],
    },
  ];

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="breadcrumb" className="mb-3 flex items-center gap-1 text-xs text-gray-400">
        <Link href="/coupang" className="hover:text-blue-600">
          쿠팡최저가
        </Link>
        <span>›</span>
        <Link href={categoryPath(k.categoryId)} className="hover:text-blue-600">
          {k.categoryLabel}
        </Link>
      </nav>

      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{k.keyword} 쿠팡 최저가 · 가격변동</h1>

      {products.length > 0 ? (
        <>
          {/* 한눈에 요약 */}
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-800">
              <dt className="text-[11px] text-gray-500">오늘 가장 싼 가격</dt>
              <dd className="mt-0.5 text-[15px] font-extrabold">{won(s.min)}</dd>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-800">
              <dt className="text-[11px] text-gray-500">지금 역대 최저가</dt>
              <dd className="mt-0.5 text-[15px] font-extrabold text-blue-600">{s.lowestNow.length}개</dd>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-800">
              <dt className="text-[11px] text-gray-500">비교한 상품</dt>
              <dd className="mt-0.5 text-[15px] font-extrabold">{products.length}개</dd>
            </div>
          </dl>
          <p className="mt-3 text-[13px] leading-relaxed text-gray-500">
            쿠팡에서 많이 팔리는 {k.keyword} 상품 {products.length}개의 가격을 매일 기록해 비교했어요. 가격은 {won(s.min)}~{won(s.max)}이고,
            {s.lowestNow.length > 0 ? ` 그중 ${s.lowestNow.length}개는 지금이 기록상 가장 싼 가격(역대가)이에요.` : ' 지금 역대 최저가인 상품은 없어요.'}{' '}
            {md(s.updated)} 기준 쿠팡 표시가이며 쿠폰·카드 할인은 빠져 있어요.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      ) : (
        <p className="py-16 text-center text-sm text-gray-400">{k.keyword} 상품 가격을 모으는 중이에요. 하루 안에 채워집니다.</p>
      )}

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-bold">{k.categoryLabel} 다른 품목 최저가</h2>
          <div className="flex flex-wrap gap-1.5">
            {related.map((w) => (
              <Link
                key={w}
                href={keywordPath(w)}
                className="rounded-full bg-white px-3 py-1.5 text-[13px] text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-800"
              >
                {w} 최저가
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
