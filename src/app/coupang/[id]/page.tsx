import Link from "next/link";
import { productSummary } from "@/lib/product-summary";
import { md, priceStats } from "@/lib/price-stats";
import { RemoteImg } from "@/components/RemoteImg";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  decodedParam,
  productIdFromParam,
  productPath,
  productSlug,
} from "@/lib/product-url";
import { getProduct, getRelatedProducts } from "@/lib/data";
import { won, isoDate, coupangLink } from "@/lib/format";
import { site } from "@/lib/site";
import { PriceChart } from "@/components/PriceChart";
import { ProductCard } from "@/components/ProductCard";
import { ReactionButtons } from "@/components/ReactionButtons";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Comments } from "@/components/Comments";
import type { Product } from "@/lib/types";

// 가격은 하루 1회 수집 → 수집 직후 /api/revalidate 로 갱신. 평소엔 하루 캐시(크레딧 절약).
export const revalidate = 86400;

// 빌드 때 미리 만들지 않고 첫 방문 때 만들어 캐시 (빌드 중 DB 호출이 몰려 시간 초과 나는 것 방지)
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

/** 제목·설명용 상품명: 첫 쉼표 앞, 너무 길면 자름 */
const headName = (name: string) => {
  const h = name.split(",")[0].trim() || name;
  return h.length > 42 ? h.slice(0, 41).trim() + "…" : h;
};

/** 검색 결과에 보이는 제목·설명 — 가격 숫자를 앞에 (클릭률) */
function seoText(p: Product) {
  const s = priceStats(p);
  const name = headName(p.name);
  if (s.count < 2) {
    return {
      title: `${name} 쿠팡 가격 ${won(p.currentPrice)}, 가격 변동 기록`,
      description: `${name} 쿠팡 판매가 ${won(p.currentPrice)} (${md(s.checkedAt)} 확인). 날짜별 가격 변동을 기록해 지금 사도 되는지 알려드려요.`,
    };
  }
  return {
    title: `${name} 최저가 ${won(s.low.price)}, 쿠팡 가격 변동`,
    description: `${name} 쿠팡 최저가 ${won(s.low.price)}은 ${md(s.low.at)}, 평균 ${won(s.avg)}, 지금 ${won(p.currentPrice)}. 최근 ${s.days}일 가격 기록.`,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = productIdFromParam((await params).id);
  const p = id ? await getProduct(id) : undefined;
  if (!p) return {};
  const { title, description } = seoText(p);
  return {
    title,
    description,
    alternates: { canonical: productPath(p) },
    openGraph: {
      type: "website",
      title,
      description,
      images: [p.image],
      url: `${site.url}${productPath(p)}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [p.image],
    },
    keywords: ["최저가", "가격비교", "쿠팡", p.name, p.categoryLabel],
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const param = (await params).id;
  const id = productIdFromParam(param);
  const p = id ? await getProduct(id) : undefined;
  if (!p) notFound();
  // 예전 주소(/coupang/{ID})나 상품명이 바뀐 주소 → 현재 주소로 영구 이동 (검색엔진도 새 주소로 갱신)
  if (decodedParam(param) !== productSlug(p)) permanentRedirect(productPath(p));
  const related = await getRelatedProducts(p.id, 10);
  const affiliate = coupangLink(p);
  const summary = productSummary(p);
  const s = priceStats(p);
  const url = `${site.url}${productPath(p)}`;
  const hasRange = s.count >= 2 && s.high.price > s.low.price;

  const validUntil = new Date(new Date(s.checkedAt).getTime() + 2 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      image: [p.image],
      sku: p.id,
      category: p.categoryLabel,
      description: summary.intro || seoText(p).description,
      offers: {
        "@type": "Offer",
        price: p.currentPrice,
        priceCurrency: "KRW",
        priceValidUntil: validUntil,
        itemCondition: "https://schema.org/NewCondition",
        availability: "https://schema.org/InStock",
        url,
        seller: { "@type": "Organization", name: "쿠팡" },
      },
      ...(hasRange
        ? {
            additionalProperty: [
              {
                "@type": "PropertyValue",
                name: `최근 ${s.days}일 최저가`,
                value: s.low.price,
                unitText: "KRW",
              },
              {
                "@type": "PropertyValue",
                name: `최근 ${s.days}일 최고가`,
                value: s.high.price,
                unitText: "KRW",
              },
              {
                "@type": "PropertyValue",
                name: `최근 ${s.days}일 평균가`,
                value: s.avg,
                unitText: "KRW",
              },
              {
                "@type": "PropertyValue",
                name: "가격 기준",
                value: "쿠팡 판매가 (와우 쿠폰과 카드 할인 전)",
              },
            ],
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: summary.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "셰어인포", item: site.url },
        {
          "@type": "ListItem",
          position: 2,
          name: `${p.categoryLabel} 최저가`,
          item: `${site.url}/coupang/category/${p.categoryId}`,
        },
        { "@type": "ListItem", position: 3, name: p.name, item: url },
      ],
    },
  ];

  const toneText = {
    down: "text-blue-600 dark:text-blue-400",
    up: "text-red-600 dark:text-red-400",
    flat: "text-gray-900 dark:text-gray-100",
  }[s.verdict.tone];

  return (
    <article className="mx-auto max-w-5xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav
        aria-label="breadcrumb"
        className="mb-4 truncate text-[13px] text-gray-500"
      >
        <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100">
          셰어인포
        </Link>
        <span className="mx-1">›</span>
        <Link
          href={`/coupang/category/${p.categoryId}`}
          className="hover:text-gray-900 dark:hover:text-gray-100"
        >
          {p.categoryLabel} 최저가
        </Link>
      </nav>

      {/* ── 상품 머리 + 가격표 ── */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-9">
        <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-start gap-3.5 md:grid-cols-[240px_minmax(0,1fr)_auto]">
          <div className="aspect-square overflow-hidden rounded-xl bg-white dark:bg-gray-900">
            <RemoteImg
              src={p.image}
              alt={p.name}
              lazy={false}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="line-clamp-3 text-lg font-bold leading-snug tracking-tight text-gray-900 md:text-[22px] dark:text-gray-100">
              {p.name}
            </h1>
            {p.option && (
              <p className="mt-1 text-[13px] text-gray-500">{p.option}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hasRange && p.currentPrice <= s.low.price && (
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                  기록상 최저가
                </span>
              )}
              {p.isRocket && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  로켓배송
                </span>
              )}
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {p.categoryLabel}
              </span>
            </div>
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

        <div className="mt-5 md:mt-0">
          <div className="rounded-lg border-2 border-gray-900 bg-white p-4 pb-3.5 dark:border-gray-100 dark:bg-gray-950">
            <p className="text-[13px] text-gray-500">
              쿠팡 판매가 · {md(s.checkedAt)} 확인
            </p>
            <p className="mt-1.5 text-5xl font-extrabold leading-none tracking-tight text-gray-900 tabular-nums md:text-[56px] dark:text-gray-100">
              {p.currentPrice.toLocaleString("ko-KR")}
              <span className="ml-0.5 text-xl font-bold">원</span>
            </p>
            <p className={`mt-2.5 text-base font-bold ${toneText}`}>
              {s.verdict.text}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              와우 쿠폰과 카드 할인 전 가격이에요.
            </p>
          </div>

          {hasRange && (
            <div
              className="mt-7"
              role="img"
              aria-label={`최근 ${s.days}일 최저 ${won(s.low.price)}, 최고 ${won(s.high.price)} 사이에서 지금 가격 ${won(p.currentPrice)}의 위치`}
            >
              <div className="relative h-0">
                <span
                  className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[11px] text-gray-500"
                  style={{ left: `${s.avgPos}%` }}
                >
                  평균 {s.avg.toLocaleString("ko-KR")}
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-gradient-to-r from-blue-600 via-gray-300 to-red-600">
                <i
                  className="absolute -top-[5px] h-4 w-0.5 -translate-x-1/2 bg-gray-400"
                  style={{ left: `${s.avgPos}%` }}
                />
                <i
                  className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-gray-900 shadow-[0_0_0_1px_#111827] dark:bg-gray-100"
                  style={{ left: `${s.pos}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <div>
                  최저
                  <b className="block text-[17px] font-bold text-blue-600 tabular-nums">
                    {won(s.low.price)}
                  </b>
                </div>
                <div className="text-right">
                  최고
                  <b className="block text-[17px] font-bold text-red-600 tabular-nums">
                    {won(s.high.price)}
                  </b>
                </div>
              </div>
            </div>
          )}

          <a
            href={affiliate}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-4 text-[17px] font-bold text-white transition hover:bg-blue-700 active:scale-[.99]"
          >
            쿠팡에서 보기 <span aria-hidden>↗</span>
          </a>
          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            {site.partnersDisclosure}
          </p>
        </div>
      </div>

      {/* ── 가격 기록 숫자 ── */}
      <Section title={hasRange ? `최근 ${s.days}일 가격 기록` : "가격 기록"}>
        <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {hasRange
            ? `셰어인포가 ${md(s.firstAt)}부터 ${s.count}번 기록한 결과 최저가는 ${md(s.low.at)}의 ${won(s.low.price)}, 평균은 ${won(s.avg)}이에요.`
            : `${md(s.checkedAt)}부터 가격을 기록하고 있어요. 기록이 쌓이면 최저가와 평균가를 비교해 드려요.`}
        </p>
        {hasRange && (
          <dl className="grid grid-cols-2 md:grid-cols-4">
            <Fact label="최저가" value={won(s.low.price)} sub={md(s.low.at)} />
            <Fact
              label="최고가"
              value={won(s.high.price)}
              sub={md(s.high.at)}
            />
            <Fact
              label="평균가"
              value={won(s.avg)}
              sub={`${s.count}번 기록 기준`}
            />
            <Fact
              label="최근 30일 변동"
              value={`${s.changes30}번`}
              sub={s.firstAt ? `${md(s.firstAt)}부터 기록` : ""}
            />
          </dl>
        )}
      </Section>

      {s.count >= 2 && (
        <Section title="가격 그래프">
          <div className="mt-4 sm:hidden">
            <PriceChart
              history={p.history}
              avg={hasRange ? s.avg : undefined}
              compact
            />
          </div>
          <div className="mt-4 hidden sm:block">
            <PriceChart
              history={p.history}
              avg={hasRange ? s.avg : undefined}
            />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-gray-500">
            <span>
              <i className="mr-1.5 inline-block w-3.5 border-t-2 border-gray-900 align-middle dark:border-gray-100" />
              판매가
            </span>
            {hasRange && (
              <span>
                <i className="mr-1.5 inline-block w-3.5 border-t-2 border-dashed border-gray-400 align-middle" />
                평균 {won(s.avg)}
              </span>
            )}
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-bold text-gray-900 dark:text-gray-100">
              날짜별 가격 보기
            </summary>
            <table className="mt-2 w-full">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[...p.history].reverse().map((h, i) => (
                  <tr key={i}>
                    <td className="py-2 text-gray-500">
                      {isoDate(h.observedAt)}
                    </td>
                    <td className="py-2 text-right font-bold tabular-nums">
                      {won(h.price)}
                      {hasRange && h.price === s.low.price && (
                        <span className="ml-1.5 text-xs font-semibold text-blue-600">
                          최저
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Section>
      )}

      {summary.intro && (
        <Section title="상품 소개">
          <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
            {summary.intro.split(/\n+/).map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        </Section>
      )}

      <Section title="자주 묻는 질문">
        <div>
          {summary.faq.map((f, i) => (
            <details
              key={f.q}
              className="group border-b border-gray-200 dark:border-gray-800"
              open={i === 0}
            >
              <summary className="relative cursor-pointer list-none py-3.5 pr-7 text-[15px] font-bold text-gray-900 dark:text-gray-100 [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="absolute right-1 top-3 text-xl font-normal text-gray-400 group-open:hidden">
                  +
                </span>
                <span className="absolute right-1 top-3 hidden text-xl font-normal text-gray-400 group-open:inline">
                  −
                </span>
              </summary>
              <p className="mb-3.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </Section>

      {related.length > 0 && (
        <Section
          title="비슷한 상품"
          right={
            <Link
              href={`/coupang/category/${p.categoryId}`}
              className="whitespace-nowrap text-sm font-bold text-gray-900 hover:underline dark:text-gray-100"
            >
              {p.categoryLabel} 전체 ›
            </Link>
          }
        >
          <div className="no-scrollbar -mx-4 mt-3 grid auto-cols-[46%] grid-flow-col gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} showRange />
            ))}
          </div>
        </Section>
      )}

      <section className="mt-10 flex flex-col items-center gap-2 border-t border-gray-200 pt-6 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          이 상품, 어땠나요?
        </p>
        <ReactionButtons targetType="product" targetId={p.id} />
      </section>
      <Comments targetType="product" targetId={p.id} />

      {/* 모바일: 하단 고정 구매 버튼 (하단 탭바 바로 위) */}
      <div className="h-16 sm:hidden" />
      <div className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 sm:hidden">
        <a
          href={affiliate}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="flex items-center gap-3 rounded-lg bg-gray-900 py-2.5 pl-4 pr-2.5 text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
        >
          <span className="min-w-0 flex-1 leading-tight">
            <small className="block text-[11px] opacity-75">
              {hasRange && p.currentPrice <= s.low.price
                ? "기록상 최저가"
                : "쿠팡 판매가"}
            </small>
            <b className="text-xl tabular-nums">{won(p.currentPrice)}</b>
          </span>
          <span className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">
            쿠팡에서 보기
          </span>
        </a>
      </div>
    </article>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="flex items-baseline justify-between gap-3 border-b-2 border-gray-900 pb-2.5 text-xl font-extrabold tracking-tight text-gray-900 dark:border-gray-100 dark:text-gray-100">
        {title}
        {right}
      </h2>
      {children}
    </section>
  );
}

function Fact({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border-b border-gray-200 py-3.5 pr-4 dark:border-gray-800">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-gray-100">
        {value}
        {sub && (
          <small className="block text-xs font-normal tracking-normal text-gray-500">
            {sub}
          </small>
        )}
      </dd>
    </div>
  );
}
