import { ProductCard } from '@/components/ProductCard';
import { getProduct } from '@/lib/data';
import { parseBody } from '@/lib/post-import';
import type { Product } from '@/lib/types';

/** 정보글 본문: 소제목(##, ###) · 목록(-) · 문단 · [상품:ID] 상품 카드 */
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
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}
