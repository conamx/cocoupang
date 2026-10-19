import Link from 'next/link';
import { productSummary } from '@/lib/product-summary';
import { RemoteImg } from '@/components/RemoteImg';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { decodedParam, productIdFromParam, productPath, productSlug } from '@/lib/product-url';
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
  return products.map((p) => ({ id: productSlug(p) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = productIdFromParam((await params).id);
  const p = id ? await getProduct(id) : undefined;
  if (!p) return {};
  const title = `${p.name} 가격 추이·최저가`;
  const description = productSummary(p).meta;
  return {
    title,
    description,
    alternates: { canonical: productPath(p) },
    openGraph: { title, description, images: [p.image], url: `${site.url}${productPath(p)}` },
    twitter: { card: 'summary_large_image', title, description, images: [p.image] },
    keywords: ['최저가', '가격비교', '쿠팡', p.name, p.categoryLabel],
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const param = (await params).id;
  const id = productIdFromParam(param);
  const p = id ? await getProduct(id) : undefined;
  if (!p) notFound();
  // 예전 주소(/coupang/{ID})나 상품명이 바뀐 주소 → 현재 주소로 영구 이동 (검색엔진도 새 주소로 갱신)
  if (decodedParam(param) !== productSlug(p)) permanentRedirect(productPath(p));
  const related = await getRelatedProducts(p.id, 12);
  const affiliate = coupangLink(p);
  const summary = productSummary(p);

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: [p.image],
    description: summary.intro || `${p.name} 쿠팡 최저가와 가격 변동 추이. 역대 최저 ${won(p.lowestPrice)}.`,
    offers: {
      '@type': 'Offer',
      price: p.currentPrice,
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
      url: `${site.url}${productPath(p)}`,
    },
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: summary.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '쿠팡최저가', item: `${site.url}/coupang` },
      { '@type': 'ListItem', position: 2, name: p.categoryLabel, item: `${site.url}/coupang/category/${p.categoryId}` },
      { '@type': 'ListItem', position: 3, name: p.name, item: `${site.url}${productPath(p)}` },
    ],
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <nav aria-label="breadcrumb" className="mb-3 flex items-center gap-1 text-xs text-gray-400">
        <Link href="/coupang" className="hover:text-blue-600">쿠팡최저가</Link>
        <span>›</span>
        <Link href={`/coupang/category/${p.categoryId}`} className="hover:text-blue-600">{p.categoryLabel}</Link>
      </nav>

      <div className="mb-6 grid gap-5 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-950">
          <RemoteImg src={p.image} alt={p.name} lazy={false} className="h-full w-full object-cover" />
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
              href={productPath(p)}
              price={won(p.currentPrice)}
            />
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            쿠팡 파트너스 활동의 일환으로 이에 따른 일정액의 수수료를 제공받습니다.
          </p>

        </div>
      </div>

      {summary.intro && (
        <section className="mb-8">
          <h2 className="mb-2 text-base font-bold">상품 소개</h2>
          <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 text-[14px] leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            {summary.intro.split(/\n+/).map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-base font-bold">상품 가격 정보</h2>
        <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 text-[14px] leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          {summary.paragraphs.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      </section>

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

      <section className="mb-8">
        <h2 className="mb-2 text-base font-bold">자주 묻는 질문</h2>
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-950">
          {summary.faq.map((f) => (
            <details key={f.q} className="group px-4 py-3" open>
              <summary className="cursor-pointer list-none text-[14px] font-semibold">Q. {f.q}</summary>
              <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">{f.a}</p>
            </details>
          ))}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} showRange />
            ))}
          </div>
        </section>
      )}
      {/* 모바일: 하단 고정 구매 버튼 (하단 탭바 바로 위) */}
      <div className="h-16 sm:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t border-gray-200 bg-white/95 px-4 py-2 backdrop-blur sm:hidden dark:border-gray-800 dark:bg-gray-950/95">
        <a
          href={affiliate}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="flex items-center justify-between gap-3 rounded-xl bg-blue-600 px-4 py-2.5 text-white"
        >
          <span className="text-[15px] font-extrabold">{won(p.currentPrice)}</span>
          <span className="text-sm font-bold">쿠팡에서 최저가 보기 ›</span>
        </a>
      </div>
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
