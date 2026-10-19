import Link from 'next/link';
import { getDeals, getProducts, getProductSections } from '@/lib/data';
import { DealCard } from '@/components/DealCard';
import { ProductSection } from '@/components/ProductSection';
import { CategoryChips } from '@/components/CategoryChips';

// 데이터는 상품 저장·수집 때 /api/revalidate·관리자 API 로 즉시 갱신됩니다.
// 이 값은 안전망(최대 1시간) — 짧게 잡을수록 Netlify 함수 실행(크레딧)이 늘어납니다.
export const revalidate = 3600;

export default async function HomePage() {
  const [sections, deals, latest] = await Promise.all([getProductSections(), getDeals(10), getProducts(undefined, 10)]);

  return (
    <div className="space-y-10">
      {/* 소개 + 카테고리 바로가기 */}
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-6 text-white sm:px-8 sm:py-8">
        <h1 className="text-xl font-extrabold leading-snug sm:text-2xl">
          쿠팡 최저가, 사기 전에 한 번만 확인하세요
        </h1>
        <p className="mt-1.5 text-sm text-blue-100">
          매일 기록한 가격으로 지금 가격이 싼지 비싼지 알려드려요. 마음에 들면 바로 쿠팡으로!
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold">
          {['📈 매일 가격 기록', '🏷️ 역대 최저가 비교', '🚀 쿠팡 바로 구매'].map((t) => (
            <span key={t} className="rounded-full bg-white/15 px-3 py-1">
              {t}
            </span>
          ))}
        </div>
      </section>

      <div className="-mt-4">
        <CategoryChips />
      </div>

      <ProductSection title="새로 들어온 최저가" sub="최근 등록·갱신" href="/coupang" products={latest} />
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
    </div>
  );
}
