import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryCounts, getProducts } from '@/lib/data';
import { coupangCategories, etcCategory } from '@/lib/site';
import { CategoryChips } from '@/components/CategoryChips';
import { ProductCard } from '@/components/ProductCard';

// 정적 페이지 + 수집 후 즉시 갱신(/api/revalidate). 요청마다 함수가 돌지 않게 searchParams 를 쓰지 않습니다.
export const revalidate = 86400;

const all = [...coupangCategories, etcCategory];
const find = (id: string) => all.find((c) => c.id === id);

// 빌드 때 미리 만들지 않고 첫 방문 때 만들어 캐시 (빌드 중 DB 호출이 몰려 시간 초과 나는 것 방지)
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ cat: string }> }): Promise<Metadata> {
  const c = find((await params).cat);
  if (!c) return {};
  const count = (await getCategoryCounts())[c.id] ?? 0;
  return {
    // 상품이 아직 없는 카테고리는 검색 노출 제외 (빈 페이지로 평가되지 않게)
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
    title: `${c.label} 쿠팡 최저가·인기 순위`,
    description: `쿠팡 ${c.label} 인기 상품의 오늘 가격, 역대 최저가, 가격 변동 추이를 한눈에 비교하세요.`,
    alternates: { canonical: `/coupang/category/${c.id}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ cat: string }> }) {
  const c = find((await params).cat);
  if (!c) notFound();
  const products = await getProducts(c.id, 120);
  const atLowest = products.filter((p) => p.highestPrice > p.lowestPrice && p.currentPrice <= p.lowestPrice).length;

  return (
    <div>
      <h1 className="text-xl font-bold">{c.label} 쿠팡 최저가</h1>
      {products.length > 0 && (
        <p className="mb-4 mt-1.5 text-[13px] leading-relaxed text-gray-500">
          쿠팡 {c.label} 상품 {products.length}개의 오늘 가격과 역대 최저가를 매일 기록해 비교합니다.
          {atLowest > 0 && ` 지금 역대 최저가인 상품은 ${atLowest}개예요.`} 상품을 누르면 가격 변동 추이를 볼 수 있어요.
        </p>
      )}
      {products.length === 0 && <div className="mb-4" />}
      <CategoryChips active={c.id} />
      {products.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">이 카테고리에 추적 중인 상품이 아직 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
