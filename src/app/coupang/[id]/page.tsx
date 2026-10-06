import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct, getProducts, getRelatedProducts } from '@/lib/data';
import { won, isoDate, coupangLink } from '@/lib/format';
import { site } from '@/lib/site';
import { PriceChart } from '@/components/PriceChart';
import { ProductCard } from '@/components/ProductCard';
import { ReactionButtons } from '@/components/ReactionButtons';
import { PriceAlertForm } from '@/components/PriceAlertForm';
import { BookmarkButton } from '@/components/BookmarkButton';

export const revalidate = 3600;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) return {};
  const title = `${p.name} 가격 추이·최저가`;
  const description = `${p.name}의 쿠팡 가격 변동 추이와 역대 최저가(${won(p.lowestPrice)})를 확인하세요.`;
  return {
    title,
    description,
    alternates: { canonical: `/coupang/${p.id}` },
    openGraph: { title, description, images: [p.image], url: `${site.url}/coupang/${p.id}` },
    twitter: { card: 'summary_large_image', title, description, images: [p.image] },
    keywords: ['최저가', '가격비교', '쿠팡', p.name, p.categoryLabel],
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) notFound();
  const related = await getRelatedProducts(id);
  const affiliate = coupangLink(p.id, p.vendorItemId);

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: [p.image],
    description: `${p.name} 쿠팡 최저가와 가격 변동 추이. 역대 최저 ${won(p.lowestPrice)}.`,
    offers: {
      '@type': 'Offer',
      price: p.currentPrice,
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
      url: `${site.url}/coupang/${p.id}`,
    },
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '쿠팡최저가', item: `${site.url}/coupang` },
      { '@type': 'ListItem', position: 2, name: p.categoryLabel, item: `${site.url}/coupang?cat=${p.categoryId}` },
      { '@type': 'ListItem', position: 3, name: p.name, item: `${site.url}/coupang/${p.id}` },
    ],
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav aria-label="breadcrumb" className="mb-3 flex items-center gap-1 text-xs text-gray-400">
        <Link href="/coupang" className="hover:text-blue-600">쿠팡최저가</Link>
        <span>›</span>
        <Link href={`/coupang?cat=${p.categoryId}`} className="hover:text-blue-600">{p.categoryLabel}</Link>
      </nav>

      <div className="mb-6 grid gap-5 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
        </div>

        <div>
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {p.categoryLabel}
          </span>
          <h1 className="mt-2 text-[22px] font-bold leading-snug sm:text-2xl">{p.name}</h1>
          {p.option && <p className="mt-2 text-sm text-gray-500">옵션: {p.option}</p>}

          <div className="mt-3 text-3xl font-extrabold">{won(p.currentPrice)}</div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="역대 최저가" value={won(p.lowestPrice)} accent />
            <Stat label="역대 최고가" value={won(p.highestPrice)} />
            <Stat label="가격 기록" value={`${p.history.length}회`} />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <a
              href={affiliate}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
              className="flex-1 rounded-lg bg-blue-600 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700"
            >
              쿠팡에서 가격 확인하기
            </a>
            <BookmarkButton
              type="product"
              id={p.id}
              title={p.name}
              image={p.image}
              href={`/coupang/${p.id}`}
              price={won(p.currentPrice)}
            />
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            쿠팡 파트너스 활동의 일환으로 이에 따른 일정액의 수수료를 제공받습니다.
          </p>

          <PriceAlertForm productId={p.id} currentPrice={p.currentPrice} />
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-bold">가격 변동 추이</h2>
        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <PriceChart history={p.history} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-bold">가격 이력</h2>
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 font-medium">날짜</th>
                <th className="px-4 py-2 text-right font-medium">가격</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[...p.history].reverse().map((h, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 text-gray-500">{isoDate(h.observedAt)}</td>
                  <td className="px-4 py-2.5 text-right font-bold">
                    {won(h.price)}
                    {h.price === p.lowestPrice && (
                      <span className="ml-1.5 text-xs font-semibold text-emerald-600">최저</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 flex flex-col items-center gap-2 border-t border-gray-100 pt-6 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">이 상품, 어땠나요?</p>
        <ReactionButtons targetType="product" targetId={p.id} />
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold">유사한 상품</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-5">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 py-2.5 dark:bg-gray-900">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-1 text-base font-bold sm:text-lg ${accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-200'}`}>
        {value}
      </p>
    </div>
  );
}
