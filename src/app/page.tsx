import Link from 'next/link';
import { getDeals, getProductSections } from '@/lib/data';
import { DealCard } from '@/components/DealCard';
import { ProductSection } from '@/components/ProductSection';

// 데이터는 수집 스크립트가 끝날 때 /api/revalidate 로 즉시 갱신됩니다.
// 이 값은 안전망(최대 1시간) — 짧게 잡을수록 Netlify 함수 실행(크레딧)이 늘어납니다.
export const revalidate = 3600;

export default async function HomePage() {
  const [sections, deals] = await Promise.all([getProductSections(), getDeals(10)]);

  return (
    <div className="space-y-10">
      <ProductSection
        as="h1"
        title="오늘의 골드박스 특가"
        sub="쿠팡 하루 한정"
        products={sections.goldbox}
        ranked
      />
      <ProductSection
        as={sections.goldbox.length ? 'h2' : 'h1'}
        title="지금 역대최저가"
        sub="가격 추적 기준"
        href="/coupang"
        products={sections.lowest}
      />
      <ProductSection title="가격 하락 TOP" sub="어제보다 내려간 상품" products={sections.drops} ranked />

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">실시간 핫딜</h2>
          <span className="text-xs text-gray-400">뽐뿌 · 펨코 · 루리웹</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {deals.map((d) => (
            <DealCard key={d.id} deal={d} />
          ))}
        </div>
      </section>

      {sections.byCategory.map((c) => (
        <ProductSection
          key={c.id}
          title={`${c.label} 인기 최저가`}
          href={`/coupang/category/${c.id}`}
          products={c.products}
          ranked
        />
      ))}
    </div>
  );
}
