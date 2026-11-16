import { ProductCard } from '@/components/ProductCard';
import { getProduct } from '@/lib/data';
import { parseBody } from '@/lib/post-import';
import type { Product } from '@/lib/types';
import Link from 'next/link';
import { findKeyword, keywordPath, keywordSlug } from '@/lib/keyword-url';

/** 정보글 본문: 소제목(##, ###) · 목록(-) · 문단 · [상품:ID] 상품 카드 · [품목:계란] 품목 페이지 링크 */
export async function PostBody({ body }: { body: string }) {
  const blocks = parseBody(body);
  const ids = [...new Set(blocks.flatMap((b) => (b.t === 'products' ? b.ids : [])))];
  const found = await Promise.all(ids.map((id) => getProduct(id).catch(() => null)));
  const byId = new Map(found.filter((p): p is Product => !!p).map((p) => [p.id, p]));

  return (
    <div className="prose-body mt-6 text-[15px] text-gray-800 dark:text-gray-200">
      {blocks.map((b, i) => {
        if (b.t === 'h2') return <h2 key={i}>{b.text}</h2>;
        if (b.t === 'h3') return <h3 key={i}>{b.text}</h3>;
        if (b.t === 'ul')
          return (
            <ul key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        if (b.t === 'products') {
          const list = b.ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
          if (!list.length) return null; // 삭제된 상품은 조용히 뺀다
          return (
            <div key={i} className="not-prose my-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {list.map((p) => (
                <ProductCard key={p.id} product={p} showRange />
              ))}
            </div>
          );
        }
        if (b.t === 'keywords') {
          // 품목 페이지가 있는 검색어만 링크 (없는 품목은 조용히 뺀다)
          const list = b.keywords.filter((w) => findKeyword(keywordSlug(w)));
          if (!list.length) return null;
          return (
            <div key={i} className="not-prose my-4 flex flex-wrap gap-1.5">
              {list.map((w) => (
                <Link
                  key={w}
                  href={keywordPath(w)}
                  className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50 dark:bg-gray-900 dark:text-blue-300 dark:ring-blue-900"
                >
                  {w} 최저가 모아보기 ›
                </Link>
              ))}
            </div>
          );
        }
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}
