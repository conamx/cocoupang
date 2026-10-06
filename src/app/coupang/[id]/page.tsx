import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct, getProducts, getRelatedProducts } from '@/lib/data';
import { won, isoDate, coupangLink } from '@/lib/format';
import { site } from '@/lib/site';
import { PriceChart } from '@/components/PriceChart';
import { ProductCard } from '@/components/ProductCard';
import { ReactionButtons } from '@/components/ReactionButtons';
import { PriceChange } from '@/components/PriceChange';
import { BookmarkButton } from '@/components/BookmarkButton';
import { Comments } from '@/components/Comments';

// 가격은 하루 1회 수집 → 수집 직후 /api/revalidate 로 갱신. 평소엔 하루 캐시(크레딧 절약).
export const revalidate = 86400;

export async function generateStaticParams() {
  // 인기 상위만 빌드 때 생성, 나머지는 첫 방문 시 생성 후 캐시 (빌드 시간·크레딧 절약)
  const products = await getProducts(undefined, 100);
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
  const related = await getRelatedProducts(id, 12);
  const affiliate = coupangLink(p);

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
      { '@type': 'ListItem', position: 2, name: p.categoryLabel, item: `${site.url}/coupang/category/${p.categoryId}` },
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
        <Link href={`/coupang/category/${p.categoryId}`} className="hover:text-blue-600">{p.categoryLabel}</Link>
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

          <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl font-extrabold">{won(p.currentPrice)}</span>
            <PriceChange
              currentPrice={p.currentPrice}
              prevPrice={p.prevPrice}
              withAmount
              className="text-sm font-bold"
            />
          </div>
          <BuyVerdict current={p.currentPrice} lowest={p.lowestPrice} highest={p.highestPrice} />

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
              쿠팡에서 최저가로 구매하기
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

      <a
        href={affiliate}
        target="_blank"
        rel="noopener noreferrer nofollow sponsored"
        className="mb-8 block rounded-lg bg-blue-600 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700"
      >
        지금 {won(p.currentPrice)} — 쿠팡에서 바로 보기
      </a>

      <section className="mb-8 flex flex-col items-center gap-2 border-t border-gray-100 pt-6 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">이 상품, 어땠나요?</p>
        <ReactionButtons targetType="product" targetId={p.id} />
      </section>

      <Comments targetType="product" targetId={p.id} />


      {related.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-base font-bold">비슷한 가격대 {p.categoryLabel} 상품</h2>
            <span className="text-xs text-gray-400">{won(p.currentPrice)} 전후</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} showRange />
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

// 지금 사도 될까? — 역대 최저/최고가 대비 현재 위치를 한 줄로
function BuyVerdict({ current, lowest, highest }: { current: number; lowest: number; highest: number }) {
  let text: string;
  let tone: string;
  if (highest === lowest) {
    text = '가격 추적을 시작한 상품이에요 · 매일 가격이 기록됩니다';
    tone = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  } else if (current <= lowest) {
    text = '지금이 역대 최저가예요 · 구매 추천';
    tone = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
  } else if (current - lowest <= (highest - lowest) * 0.3) {
    text = `역대 최저가보다 ${won(current - lowest)} 비싸요 · 괜찮은 가격`;
    tone = 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
  } else {
    text = `역대 최저가보다 ${won(current - lowest)} 비싸요 · 가격 하락을 기다려 보세요`;
    tone = 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
  }
  return <p className={`mt-2 inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}>{text}</p>;
}
