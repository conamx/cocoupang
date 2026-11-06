import Link from 'next/link';
import { productSummary } from '@/lib/product-summary';
import { md, priceStats } from '@/lib/price-stats';
import { RemoteImg } from '@/components/RemoteImg';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { decodedParam, productIdFromParam, productPath, productSlug } from '@/lib/product-url';
import { getProduct, getRelatedProducts } from '@/lib/data';
import { won, isoDate, coupangLink } from '@/lib/format';
import { site } from '@/lib/site';
import { PriceChart } from '@/components/PriceChart';
import { ProductCard } from '@/components/ProductCard';
import { ReactionButtons } from '@/components/ReactionButtons';
import { BookmarkButton } from '@/components/BookmarkButton';
import { Comments } from '@/components/Comments';
import type { Product } from '@/lib/types';

// 가격은 하루 1회 수집 → 수집 직후 /api/revalidate 로 갱신. 평소엔 하루 캐시(크레딧 절약).
export const revalidate = 86400;

// 빌드 때 미리 만들지 않고 첫 방문 때 만들어 캐시 (빌드 중 DB 호출이 몰려 시간 초과 나는 것 방지)
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

/** 제목·설명용 상품명: 첫 쉼표 앞, 너무 길면 자름 */
const headName = (name: string) => {
  const h = name.split(',')[0].trim() || name;
  return h.length > 42 ? h.slice(0, 41).trim() + '…' : h;
};

/** 검색 결과에 보이는 제목·설명 — 가격 숫자를 앞에 (클릭률) */
function seoText(p: Product) {
  const s = priceStats(p);
  const name = headName(p.name);
  if (s.count < 2) {
    return {
      title: `${name} 쿠팡 가격 ${won(p.currentPrice)}, 가격 변동 기록`,
      description: `${name} 쿠팡 가격 ${won(p.currentPrice)} (${md(s.checkedAt)} 기준). 가격이 바뀔 때마다 기록해 그래프로 보여 드려요.`,
    };
  }
  return {
    title: `${name} 최저가 ${won(s.low.price)}, 쿠팡 가격 변동`,
    description: `${name} 지금 ${won(p.currentPrice)} · 최저 ${won(s.low.price)}(${md(s.low.at)}) · 평균 ${won(s.avg)}. ${s.days}일간 쿠팡 가격 그래프.`,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = productIdFromParam((await params).id);
  const p = id ? await getProduct(id) : undefined;
  if (!p) return {};
  const { title, description } = seoText(p);
  return {
    title,
    description,
    alternates: { canonical: productPath(p) },
    openGraph: {
      type: 'website',
      title,
      description,
      images: [p.image],
      url: `${site.url}${productPath(p)}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [p.image],
    },
    keywords: ['최저가', '가격비교', '쿠팡', p.name, p.categoryLabel],
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const param = (await params).id;
  const id = productIdFromParam(param);
  // 상품·관련상품을 동시에 조회 (순서대로 기다리지 않게)
  const [p, related] = id ? await Promise.all([getProduct(id), getRelatedProducts(id, 10)]) : [undefined, []];
  if (!p) notFound();
  // 예전 주소(/coupang/{ID})나 상품명이 바뀐 주소 → 현재 주소로 영구 이동 (검색엔진도 새 주소로 갱신)
  // Location 헤더에는 한글을 그대로 못 넣으므로 인코딩 (안 하면 500 오류)
  if (decodedParam(param) !== productSlug(p)) permanentRedirect(encodeURI(productPath(p)));
  const affiliate = coupangLink(p);
  const summary = productSummary(p);
  const s = priceStats(p);
  const url = `${site.url}${productPath(p)}`;
  const hasRange = s.count >= 2 && s.high.price > s.low.price;

  const validUntil = new Date(new Date(s.checkedAt).getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      image: [p.image],
      sku: p.id,
      category: p.categoryLabel,
      description: summary.intro || seoText(p).description,
      offers: {
        '@type': 'Offer',
        price: p.currentPrice,
        priceCurrency: 'KRW',
        priceValidUntil: validUntil,
        itemCondition: 'https://schema.org/NewCondition',
        availability: 'https://schema.org/InStock',
        url,
        seller: { '@type': 'Organization', name: '쿠팡' },
      },
      ...(hasRange
        ? {
            additionalProperty: [
              {
                '@type': 'PropertyValue',
                name: `최근 ${s.days}일 최저가`,
                value: s.low.price,
                unitText: 'KRW',
              },
              {
                '@type': 'PropertyValue',
                name: `최근 ${s.days}일 최고가`,
                value: s.high.price,
                unitText: 'KRW',
              },
              {
                '@type': 'PropertyValue',
                name: `최근 ${s.days}일 평균가`,
                value: s.avg,
                unitText: 'KRW',
              },
              {
                '@type': 'PropertyValue',
                name: '가격 기준',
                value: '쿠팡 표시 판매가 (쿠폰·카드 할인 제외)',
              },
            ],
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: summary.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '셰어인포', item: site.url },
        {
          '@type': 'ListItem',
          position: 2,
          name: `${p.categoryLabel} 최저가`,
          item: `${site.url}/coupang/category/${p.categoryId}`,
        },
        { '@type': 'ListItem', position: 3, name: p.name, item: url },
      ],
    },
  ];

  const verdictCls = {
    down: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    up: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    flat: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  }[s.verdict.tone];
  const card = 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950';

  return (
    <article className="mx-auto max-w-4xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="breadcrumb" className="mb-3 flex items-center gap-1 text-xs text-gray-400">
        <Link href="/coupang" className="hover:text-blue-600">
          쿠팡최저가
        </Link>
        <span>›</span>
        <Link href={`/coupang/category/${p.categoryId}`} className="hover:text-blue-600">
          {p.categoryLabel}
        </Link>
      </nav>

      <div className="grid gap-4 md:grid-cols-[300px_minmax(0,1fr)] md:items-start">
        {/* 사진: 모바일은 작게, PC는 왼쪽 */}
        <div className="hidden aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-white md:block dark:border-gray-800">
          <RemoteImg src={p.image} alt={p.name} lazy={false} size={492} className="h-full w-full object-contain" />
        </div>

        <div className={card}>
          <div className="flex items-start gap-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-50 md:hidden dark:bg-gray-900">
              <RemoteImg src={p.image} alt="" lazy={false} size={230} className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="line-clamp-3 text-[17px] font-bold leading-snug md:text-xl">{p.name}</h1>
              <p className="mt-1 text-xs text-gray-400">
                {p.categoryLabel}
                {p.isRocket ? ' · 로켓배송' : ''}
                {p.option ? ` · ${p.option}` : ''}
              </p>
            </div>
            <BookmarkButton
              type="product"
              id={p.id}
              title={p.name}
              image={p.image}
              href={productPath(p)}
              price={won(p.currentPrice)}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[34px] font-extrabold leading-none tracking-tight tabular-nums">{won(p.currentPrice)}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${verdictCls}`}>{s.verdict.text}</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">쿠팡 표시가 · {md(s.checkedAt)} 기준 · 쿠폰·카드 할인 제외</p>

          {hasRange && (
            <div className="mt-4 rounded-xl bg-gray-50 px-3 pb-3 pt-2 dark:bg-gray-900">
              <PriceChart history={p.history} mini />
              <div className="mt-1 grid grid-cols-3 text-center text-[11px] text-gray-400">
                <span>
                  최저<b className="block text-sm text-blue-600 tabular-nums dark:text-blue-400">{won(s.low.price)}</b>
                </span>
                <span>
                  평균<b className="block text-sm text-gray-700 tabular-nums dark:text-gray-200">{won(s.avg)}</b>
                </span>
                <span>
                  최고<b className="block text-sm text-gray-700 tabular-nums dark:text-gray-200">{won(s.high.price)}</b>
                </span>
              </div>
            </div>
          )}

          <a
            href={affiliate}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="mt-4 block rounded-xl bg-blue-600 py-3.5 text-center text-[15px] font-bold text-white transition hover:bg-blue-700"
          >
            쿠팡에서 가격 확인
          </a>
          <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{site.partnersDisclosure}</p>
        </div>
      </div>

      {hasRange && (
        <section className="mt-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-bold">가격 변동</h2>
            <span className="text-xs text-gray-400">
              {md(s.firstAt)}부터 {s.count}회 기록 · 30일간 {s.changes30}번 바뀜
            </span>
          </div>
          <div className={card}>
            <div className="sm:hidden">
              <PriceChart history={p.history} avg={s.avg} compact />
            </div>
            <div className="hidden sm:block">
              <PriceChart history={p.history} avg={s.avg} />
            </div>
            <details className="mt-3 border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
              <summary className="cursor-pointer text-[13px] font-semibold text-gray-500">날짜별 가격</summary>
              <table className="mt-2 w-full">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[...p.history].reverse().map((h, i) => (
                    <tr key={i}>
                      <td className="py-2 text-gray-500">{isoDate(h.observedAt)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {won(h.price)}
                        {h.price === s.low.price && <span className="ml-1.5 text-xs text-blue-600">최저</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        </section>
      )}

      {summary.intro && (
        <section className="mt-8">
          <h2 className="mb-2 text-base font-bold">상품 소개</h2>
          <div className={`${card} space-y-2 text-[14px] leading-relaxed text-gray-700 dark:text-gray-300`}>
            {summary.intro.split(/\n+/).map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-base font-bold">자주 묻는 질문</h2>
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-950">
          {summary.faq.map((f, i) => (
            <details key={f.q} className="px-4 py-3" open={i === 0}>
              <summary className="cursor-pointer text-[14px] font-semibold">{f.q}</summary>
              <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-bold">같은 카테고리 상품</h2>
            <Link href={`/coupang/category/${p.categoryId}`} className="text-xs font-semibold text-blue-600 hover:underline">
              {p.categoryLabel} 더보기 ›
            </Link>
          </div>
          <div className="no-scrollbar -mx-4 grid auto-cols-[46%] grid-flow-col gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} showRange />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 flex flex-col items-center gap-2 border-t border-gray-100 pt-6 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">이 상품, 어땠나요?</p>
        <ReactionButtons targetType="product" targetId={p.id} />
      </section>
      <Comments targetType="product" targetId={p.id} />

      {/* 모바일: 하단 고정 구매 버튼 (하단 탭바 바로 위) */}
      <div className="h-16 sm:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t border-gray-200 bg-white/95 px-4 py-2 backdrop-blur sm:hidden dark:border-gray-800 dark:bg-gray-950/95">
        <a
          href={affiliate}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="flex items-center justify-between gap-3 rounded-xl bg-blue-600 px-4 py-2.5 text-white"
        >
          <span className="text-[15px] font-extrabold tabular-nums">{won(p.currentPrice)}</span>
          <span className="text-sm font-bold">쿠팡에서 가격 확인 ›</span>
        </a>
      </div>
    </article>
  );
}
