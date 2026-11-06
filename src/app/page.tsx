import type { Metadata } from 'next';
import Link from 'next/link';
import { getCategoryCounts, getDeals, getProducts, getProductSections } from '@/lib/data';
import { DealCard } from '@/components/DealCard';
import { ProductSection } from '@/components/ProductSection';
import { CategoryChips } from '@/components/CategoryChips';
import { CategoryGrid } from '@/components/CategoryGrid';
import { KeywordLinks } from '@/components/KeywordLinks';
import { site } from '@/lib/site';
import { productPath } from '@/lib/product-url';

// 데이터는 상품 저장·수집 때 /api/revalidate·관리자 API 로 즉시 갱신됩니다.
// 이 값은 안전망(최대 1시간) — 짧게 잡을수록 Netlify 함수 실행(크레딧)이 늘어납니다.
export const revalidate = 3600;

// 네이버·구글에서 실제로 들어오는 검색어: 쿠팡 가격변동 사이트, 쿠팡 최저가 사이트, 쿠팡 가격 비교 사이트, 쿠팡 역대가, 가격변동 조회
const HOME_TITLE = '쿠팡 가격변동 조회 · 역대가 확인 사이트';

export async function generateMetadata(): Promise<Metadata> {
  const total = Object.values(await getCategoryCounts()).reduce((s, n) => s + n, 0);
  const description = `쿠팡 상품 ${total.toLocaleString('ko-KR')}개의 가격 변동 그래프와 역대가(역대 최저가)를 매일 기록하는 쿠팡 가격 비교 사이트. 지금 가격이 싼지 비싼지 바로 확인하세요.`;
  return {
    title: { absolute: `${HOME_TITLE} | ${site.name}` },
    description,
    alternates: { canonical: '/' },
    openGraph: { title: `${HOME_TITLE} | ${site.name}`, description, url: site.url },
  };
}

// 홈 하단 자주 묻는 질문 (검색 결과 FAQ 표시용 구조화 데이터도 함께)
const homeFaq = [
  {
    q: '셰어인포는 어떤 사이트인가요?',
    a: '쿠팡 가격변동 조회 사이트입니다. 쿠팡 상품의 가격을 매일 기록해 두고, 지금 가격을 역대 최저가·평균 가격과 비교해 싼지 비싼지 보여드려요.',
  },
  {
    q: '쿠팡 가격 변동은 어떻게 확인하나요?',
    a: '상품을 검색하거나 카테고리에서 고른 뒤 상품 페이지를 열면 날짜별 가격 변동 그래프와 가격표가 나옵니다. 가격은 매일 확인하고, 바뀔 때마다 기록합니다.',
  },
  {
    q: '쿠팡 역대가(역대 최저가)는 무엇을 기준으로 하나요?',
    a: '셰어인포가 기록한 쿠팡 판매가 중 가장 낮았던 가격입니다. 쿠폰·카드 할인은 빠진 표시 가격 기준이라, 결제 직전 금액은 쿠팡에서 한 번 더 확인해 주세요.',
  },
  {
    q: '다른 쿠팡 최저가 사이트와 무엇이 다른가요?',
    a: '생활용품·식품·가전처럼 자주 사는 상품 위주로 매일 가격을 갱신하고, 지금 가격이 역대가 대비 어느 정도인지 한눈에 보이게 정리했습니다.',
  },
  {
    q: '이용료가 있나요? 구매 가격이 달라지나요?',
    a: '무료이며 회원가입도 필요 없습니다. 쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받으며, 구매 가격에는 영향이 없습니다.',
  },
];

export default async function HomePage() {
  const [sections, deals, latest, counts] = await Promise.all([
    // 섹션당 10개(PC 5칸×2줄), 카테고리당 5개(PC 1줄, 모바일 4개) — 홈을 가볍게
    getProductSections(10, 5),
    getDeals(10),
    getProducts(undefined, 10),
    getCategoryCounts(),
  ]);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: homeFaq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: '지금 인기 쿠팡 상품',
      numberOfItems: latest.length,
      itemListElement: latest.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: p.name,
          image: p.image,
          url: `${site.url}${productPath(p)}`,
          offers: { '@type': 'Offer', price: p.currentPrice, priceCurrency: 'KRW', availability: 'https://schema.org/InStock' },
        },
      })),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">쿠팡 가격변동 조회 · 역대가 확인</h1>
          <p className="mt-1 text-[13px] text-gray-500">
            쿠팡 상품 {total.toLocaleString('ko-KR')}개의 가격을 매일 기록해 지금 가격이 싼지 비싼지 비교해 드려요.
          </p>
        </div>
        <CategoryChips />
      </div>

      <ProductSection title="오늘의 골드박스 특가" sub="쿠팡 하루 한정" products={sections.goldbox} ranked />
      <ProductSection title="지금 인기 상품" href="/coupang" products={latest} />
      <ProductSection title="지금 역대최저가" sub="가격 추적 기준" href="/coupang" products={sections.lowest} />
      <ProductSection title="가격 하락 TOP" sub="어제보다 내려간 상품" products={sections.drops} ranked />

      {sections.byCategory.map((c) => (
        <ProductSection
          key={c.id}
          title={`${c.label} 인기 최저가`}
          href={`/coupang/category/${c.id}`}
          products={c.products}
          ranked
          mobileMax={4}
        />
      ))}

      {deals.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">실시간 핫딜</h2>
            <Link href="/deal" className="text-sm font-semibold text-blue-600 hover:underline">
              더보기 →
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {deals.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </div>
        </section>
      )}
      <KeywordLinks title="많이 찾는 품목 최저가" limit={40} />

      <section>
        <h2 className="mb-3 text-lg font-bold">카테고리별 최저가 찾기</h2>
        <CategoryGrid />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-lg font-bold">쿠팡 가격, 기록해 두면 보입니다</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">
          쿠팡 가격은 할인 쿠폰과 재고에 따라 하루에도 여러 번 바뀝니다. 셰어인포는 상품 가격을 날짜별로 기록해 두고
          지금 가격을 역대 최저가·평균 가격과 비교해 보여줍니다. 사고 싶은 상품이 지금 싼 편인지, 조금 기다리는 게 나은지
          그래프로 확인해 보세요.
        </p>
        <h2 className="mt-6 text-lg font-bold">자주 묻는 질문</h2>
        <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
          {homeFaq.map((f) => (
            <details key={f.q} className="py-3">
              <summary className="cursor-pointer text-[14px] font-semibold">Q. {f.q}</summary>
              <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
