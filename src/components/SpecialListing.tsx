import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSpecialProducts, type SpecialKind } from '@/lib/data';
import { CategoryChips } from '@/components/CategoryChips';
import { ProductCard } from '@/components/ProductCard';
import { Pager } from '@/components/Pager';

/** 홈 '더보기' 목록 — 지금 역대최저가 / 가격 하락 TOP / 오늘의 골드박스 */
const PER = 60;

export const SPECIAL: Record<SpecialKind, { path: string; title: string; h1: string; desc: string; empty: string; showRange?: boolean; ranked?: boolean }> = {
  lowest: {
    path: '/coupang/lowest',
    title: '지금 역대최저가 쿠팡 상품',
    h1: '지금 역대최저가',
    desc: '지금 가격이 셰어인포가 기록한 가격 중 가장 낮은 쿠팡 상품만 모았어요. 최고가 대비 많이 내린 순서예요.',
    empty: '지금 역대최저가인 상품이 없어요. 가격이 기록되면서 채워집니다.',
    showRange: true,
  },
  drops: {
    path: '/coupang/drops',
    title: '쿠팡 가격 하락 TOP · 어제보다 내린 상품',
    h1: '가격 하락 TOP',
    desc: '어제보다 가격이 내려간 쿠팡 상품을 많이 내린 순서로 보여드려요.',
    empty: '어제보다 가격이 내린 상품이 아직 없어요.',
    ranked: true,
  },
  goldbox: {
    path: '/coupang/goldbox',
    title: '오늘의 쿠팡 골드박스 특가',
    h1: '오늘의 골드박스 특가',
    desc: '쿠팡이 하루 한정으로 할인하는 골드박스 상품이에요. 매일 아침 새로 바뀌고, 할인은 옵션(용량·구성)마다 다를 수 있어 표시 가격과 다를 수 있어요.',
    empty: '오늘 골드박스 상품을 불러오는 중이에요.',
    ranked: true,
  },
};

export const specialPath = (kind: SpecialKind, page = 1) => (page > 1 ? `${SPECIAL[kind].path}/${page}` : SPECIAL[kind].path);

export async function specialMetadata(kind: SpecialKind, page: number): Promise<Metadata> {
  const c = SPECIAL[kind];
  const { total } = await getSpecialProducts(kind, 1, 0);
  const suffix = page > 1 ? ` ${page}페이지` : '';
  return {
    title: `${c.title}${suffix}`,
    description: `${c.desc} 지금 ${total.toLocaleString('ko-KR')}개.`,
    alternates: { canonical: specialPath(kind, page) },
    ...(total === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export async function SpecialListing({ kind, page }: { kind: SpecialKind; page: number }) {
  if (!Number.isInteger(page) || page < 1) notFound();
  const c = SPECIAL[kind];
  const { products, total } = await getSpecialProducts(kind, PER, (page - 1) * PER);
  if (page > 1 && products.length === 0) notFound();
  const pages = Math.max(1, Math.ceil(total / PER));
  return (
    <div>
      <h1 className="text-xl font-bold">
        {c.h1}
        <span className="ml-1.5 text-base font-medium text-gray-400">
          {total.toLocaleString('ko-KR')}개{page > 1 && ` · ${page}페이지`}
        </span>
      </h1>
      <p className="mb-4 mt-1.5 text-[13px] leading-relaxed text-gray-500">{c.desc}</p>
      <CategoryChips />
      {products.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">{c.empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} showRange={c.showRange} rank={c.ranked ? (page - 1) * PER + i + 1 : undefined} />
          ))}
        </div>
      )}
      <Pager page={page} pages={pages} href={(n) => specialPath(kind, n)} />
    </div>
  );
}
