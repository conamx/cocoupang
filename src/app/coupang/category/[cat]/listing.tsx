import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryCounts, getProducts } from '@/lib/data';
import { coupangCategories, etcCategory } from '@/lib/site';
import { CategoryChips } from '@/components/CategoryChips';
import { ProductCard } from '@/components/ProductCard';
import { KeywordLinks } from '@/components/KeywordLinks';
import { Pager } from '@/components/Pager';
import { PER_PAGE, categoryPath } from '@/lib/category-url';

/** 카테고리 목록 공통 (1쪽: /coupang/category/{cat}, 2쪽부터: /coupang/category/{cat}/{n}) */

const all = [...coupangCategories, etcCategory];
export const findCategory = (id: string) => all.find((c) => c.id === id);

export async function categoryMetadata(id: string, page: number): Promise<Metadata> {
  const c = findCategory(id);
  if (!c) return {};
  const count = (await getCategoryCounts())[c.id] ?? 0;
  const pages = Math.max(1, Math.ceil(count / PER_PAGE));
  if (page > pages) return { robots: { index: false, follow: true } };
  const suffix = page > 1 ? ` ${page}페이지` : '';
  return {
    // 상품이 아직 없는 카테고리는 검색 노출 제외 (빈 페이지로 평가되지 않게)
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
    title: `${c.label} 쿠팡 최저가·인기 순위${suffix}`,
    description: `쿠팡 ${c.label} 인기 상품 ${count.toLocaleString('ko-KR')}개의 오늘 가격, 역대 최저가, 가격 변동 추이를 한눈에 비교하세요.${suffix}`,
    alternates: { canonical: categoryPath(c.id, page) },
  };
}

export async function CategoryListing({ id, page }: { id: string; page: number }) {
  const c = findCategory(id);
  if (!c || !Number.isInteger(page) || page < 1) notFound();
  const [counts, products] = await Promise.all([
    getCategoryCounts(),
    getProducts(c.id, PER_PAGE, (page - 1) * PER_PAGE),
  ]);
  const count = counts[c.id] ?? 0;
  const pages = Math.max(1, Math.ceil(count / PER_PAGE));
  if (page > 1 && products.length === 0) notFound();
  const atLowest = products.filter((p) => p.highestPrice > p.lowestPrice && p.currentPrice <= p.lowestPrice).length;

  return (
    <div>
      <h1 className="text-xl font-bold">
        {c.label} 쿠팡 최저가{page > 1 && <span className="ml-1.5 text-base font-medium text-gray-400">{page}페이지</span>}
      </h1>
      {count > 0 && page === 1 && (
        <p className="mb-4 mt-1.5 text-[13px] leading-relaxed text-gray-500">
          쿠팡 {c.label} 상품 {count.toLocaleString('ko-KR')}개의 오늘 가격과 역대 최저가를 매일 기록해 비교합니다.
          {atLowest > 0 && ` 이 페이지에서 지금 역대 최저가인 상품은 ${atLowest}개예요.`} 상품을 누르면 가격 변동 추이를 볼 수 있어요.
        </p>
      )}
      {(count === 0 || page > 1) && <div className="mb-4" />}
      <CategoryChips active={c.id} />
      {products.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">이 카테고리에 추적 중인 상품이 아직 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} rank={(page - 1) * PER_PAGE + i + 1} />
          ))}
        </div>
      )}
      <Pager page={page} pages={pages} href={(n) => categoryPath(c.id, n)} />
      {page === 1 && (
        <div className="mt-10">
          <KeywordLinks title={`${c.label} 품목별 최저가`} categoryId={c.id} limit={40} />
        </div>
      )}
    </div>
  );
}
