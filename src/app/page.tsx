import type { Metadata } from 'next';
import Link from 'next/link';
import { getDeals, getProducts, getProductSections } from '@/lib/data';
import { DealCard } from '@/components/DealCard';
import { ProductSection } from '@/components/ProductSection';
import { CategoryChips } from '@/components/CategoryChips';
import { CategoryGrid } from '@/components/CategoryGrid';
import { site } from '@/lib/site';
import { productPath } from '@/lib/product-url';

// 데이터는 상품 저장·수집 때 /api/revalidate·관리자 API 로 즉시 갱신됩니다.
// 이 값은 안전망(최대 1시간) — 짧게 잡을수록 Netlify 함수 실행(크레딧)이 늘어납니다.
export const revalidate = 3600;

export const metadata: Metadata = { alternates: { canonical: '/' } };

// 홈 하단 자주 묻는 질문 (검색 결과 FAQ 표시용 구조화 데이터도 함께)
const homeFaq = [
  {
    q: '셰어인포는 어떤 사이트인가요?',
    a: '쿠팡 상품의 가격을 기록해 두고, 지금 가격이 역대 최저가와 비교해 싼지 비싼지 보여주는 쿠팡 최저가 조회 사이트입니다.',
  },
  {
    q: '가격은 어떻게 기록되나요?',
    a: '상품 가격을 확인할 때마다 가격 이력에 쌓고, 하루에 한 건씩 그래프로 보여드립니다. 실시간 가격은 아니므로 최종 가격은 쿠팡에서 확인해 주세요.',
  },
  {
    q: '역대 최저가는 무엇을 기준으로 하나요?',
    a: '셰어인포가 기록한 가격 중 가장 낮았던 가격입니다. 상품 페이지에서 날짜별 가격 이력과 함께 확인할 수 있어요.',
  },
  {
    q: '이용료가 있나요? 구매 가격이 달라지나요?',
    a: '무료이며 회원가입도 필요 없습니다. 쿠팡 파트너스 링크로 연결되어 일정 수수료를 받을 수 있지만, 구매 가격에는 영향이 없습니다.',
  },
];

export default async function HomePage() {
  const [sections, deals, latest] = await Promise.all([getProductSections(), getDeals(10), getProducts(undefined, 10)]);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: homeFaq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: '새로 올라온 쿠팡 최저가 상품',
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
      <CategoryChips />

      <ProductSection title="새로 올라온 상품" href="/coupang" products={latest} />
      <ProductSection title="오늘의 골드박스 특가" sub="쿠팡 하루 한정" products={sections.goldbox} ranked />
      <ProductSection title="지금 역대최저가" sub="가격 추적 기준" href="/coupang" products={sections.lowest} />
      <ProductSection title="가격 하락 TOP" sub="어제보다 내려간 상품" products={sections.drops} ranked />

      {sections.byCategory.map((c) => (
        <ProductSection
          key={c.id}
          title={`${c.label} 인기 최저가`}
          href={`/coupang/category/${c.id}`}
          products={c.products}
          ranked
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
      {/* 검색엔진용 제목 (화면에는 안 보임) */}
      <h1 className="sr-only">쿠팡 최저가 모음 · 셰어인포</h1>
    </div>
  );
}
