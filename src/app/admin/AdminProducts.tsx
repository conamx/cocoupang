'use client';

import { useCallback, useEffect, useState } from 'react';
import { badImageReason, parsePrice } from '@/lib/manual-import';
import { coupangCategories, etcCategory } from '@/lib/site';

const CATS = [...coupangCategories, etcCategory];
const PAGE = 50;

type AdminProduct = {
  id: string;
  name: string;
  image: string;
  price: number;
  prevPrice: number | null;
  lowestPrice: number;
  highestPrice: number;
  categoryId: string;
  buyUrl: string;
  affiliateUrl: string | null;
  updatedAt: string;
};

type Edit = { name?: string; priceText?: string; image?: string; categoryId?: string };

const input =
  'w-full rounded border border-gray-200 bg-white px-2 py-1 text-[13px] dark:border-gray-700 dark:bg-gray-900';

const won = (n: number) => n.toLocaleString('ko-KR');
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const kstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);

export function AdminProducts({ adminKey }: { adminKey: string }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [stale, setStale] = useState(false);
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const headers = { 'Content-Type': 'application/json', 'x-admin-key': adminKey };

  const load = useCallback(
    async (offset = 0) => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ list: '1', q, cat, offset: String(offset), limit: String(PAGE) });
      if (stale) params.set('stale', '1');
      const res = await fetch(`/api/admin/products?${params}`, { headers: { 'x-admin-key': adminKey } });
      setLoading(false);
      if (!res.ok) return setError(`불러오기 실패 (${res.status}) ${await res.text()}`);
      const j = (await res.json()) as { total: number; products: AdminProduct[] };
      setTotal(j.total);
      setItems((prev) => (offset ? [...prev, ...j.products] : j.products));
      if (!offset) setEdits({});
    },
    [adminKey, q, cat, stale],
  );

  useEffect(() => {
    void load(0);
    // 필터 변경 시 자동 조회 (검색어는 Enter/버튼으로)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, stale]);

  const edit = (id: string, patch: Edit) => {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
    setStatus((s) => ({ ...s, [id]: '' }));
  };

  // override: 방금 입력한 값(상태 반영 전)으로 바로 저장할 때
  async function save(p: AdminProduct, override?: Edit): Promise<boolean> {
    const e = override ?? edits[p.id];
    if (!e) return true;
    const body: Record<string, unknown> = { id: p.id };
    if (e.name !== undefined && e.name.trim() !== p.name) body.name = e.name.trim();
    if (e.image !== undefined && e.image.trim() !== p.image) body.image = e.image.trim();
    if (e.categoryId !== undefined && e.categoryId !== p.categoryId) body.categoryId = e.categoryId;
    if (e.priceText !== undefined) {
      const price = parsePrice(e.priceText);
      if (!price) {
        setStatus((s) => ({ ...s, [p.id]: '가격을 숫자로 입력하세요' }));
        return false;
      }
      if (price !== p.price || stale) body.price = price; // 가격 확인 모드에선 같은 가격도 '오늘 확인'으로 기록
    }
    if (Object.keys(body).length === 1) {
      setEdits((x) => {
        const { [p.id]: _, ...rest } = x;
        return rest;
      });
      return true;
    }
    setStatus((s) => ({ ...s, [p.id]: '저장 중…' }));
    const res = await fetch('/api/admin/products', { method: 'PATCH', headers, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => ({}))) as { product?: AdminProduct; error?: string };
    if (!res.ok || !j.product) {
      setStatus((s) => ({ ...s, [p.id]: j.error ?? `실패 (${res.status})` }));
      return false;
    }
    setItems((list) => list.map((x) => (x.id === p.id ? j.product! : x)));
    setEdits((x) => {
      const { [p.id]: _, ...rest } = x;
      return rest;
    });
    setStatus((s) => ({ ...s, [p.id]: '✓ 저장됨' }));
    return true;
  }

  async function remove(p: AdminProduct) {
    if (!confirm(`삭제할까요?\n${p.name}\n(가격 이력도 함께 삭제됩니다)`)) return;
    const res = await fetch(`/api/admin/products?id=${encodeURIComponent(p.id)}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    });
    if (!res.ok) return setStatus((s) => ({ ...s, [p.id]: `삭제 실패 (${res.status})` }));
    setItems((list) => list.filter((x) => x.id !== p.id));
    setTotal((t) => t - 1);
  }

  async function saveAll() {
    for (const p of items) if (edits[p.id]) await save(p);
  }

  const dirtyCount = Object.keys(edits).length;
  const today = todayKst();

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load(0);
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명 또는 상품ID 검색" className={`${input} max-w-xs`} />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded border border-gray-200 px-2 py-1 text-[13px] dark:border-gray-700 dark:bg-gray-900">
          <option value="">전체 카테고리</option>
          {CATS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <button className="rounded bg-gray-800 px-3 py-1.5 text-sm font-bold text-white dark:bg-gray-200 dark:text-gray-900">검색</button>
        <label className="flex items-center gap-1 text-[13px] text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={stale} onChange={(e) => setStale(e.target.checked)} />
          오늘 가격 확인 안 한 상품만
        </label>
        <span className="ml-auto text-xs text-gray-500">{loading ? '불러오는 중…' : `${total.toLocaleString()}개`}</span>
      </form>

      {stale && (
        <p className="rounded bg-blue-50 p-2.5 text-[13px] text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          가격 확인 모드: 가격 칸에 오늘 가격을 넣고 <b>Enter</b> 를 누르면 저장되고 다음 상품으로 넘어갑니다. 가격이 같아도 Enter 를 누르면 &lsquo;오늘 확인&rsquo;으로 기록돼요.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900">
            <tr>
              <th className="p-2">사진</th>
              <th className="p-2">상품명 · 이미지 주소</th>
              <th className="w-32 p-2">가격 (원)</th>
              <th className="w-32 p-2">카테고리</th>
              <th className="w-24 p-2">갱신일</th>
              <th className="w-28 p-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((p, i) => {
              const e = edits[p.id] ?? {};
              const img = e.image ?? p.image;
              const st = status[p.id];
              const checkedToday = kstDate(p.updatedAt) === today;
              return (
                <tr key={p.id} className={e && Object.keys(e).length ? 'bg-amber-50/60 dark:bg-amber-950/30' : ''}>
                  <td className="p-2 align-top">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded object-cover" />
                  </td>
                  <td className="space-y-1 p-2 align-top">
                    <input value={e.name ?? p.name} onChange={(ev) => edit(p.id, { name: ev.target.value })} className={input} />
                    <input value={img} onChange={(ev) => edit(p.id, { image: ev.target.value })} className={`${input} text-[11px] text-gray-500`} />
                    {badImageReason(e.image) && <p className="text-[11px] text-red-600">{badImageReason(e.image)}</p>}
                    <p className="text-[11px] text-gray-400">
                      ID {p.id} · 최저 {won(p.lowestPrice)} / 최고 {won(p.highestPrice)}
                      {!p.affiliateUrl && <span className="text-amber-600"> · ⚠ 파트너스 링크 없음</span>}
                    </p>
                  </td>
                  <td className="p-2 align-top">
                    <input
                      data-price-idx={i}
                      value={e.priceText ?? won(p.price)}
                      onChange={(ev) => edit(p.id, { priceText: ev.target.value })}
                      onFocus={(ev) => ev.target.select()}
                      onKeyDown={async (ev) => {
                        if (ev.key !== 'Enter') return;
                        ev.preventDefault();
                        const cur = edits[p.id] ?? {};
                        // 가격 확인 모드: 값을 안 바꿔도 Enter = 오늘 가격 확인
                        const ok = await save(p, stale ? { ...cur, priceText: cur.priceText ?? String(p.price) } : cur);
                        if (ok) (document.querySelector(`[data-price-idx="${i + 1}"]`) as HTMLInputElement | null)?.focus();
                      }}
                      inputMode="numeric"
                      className={`${input} text-right font-bold`}
                    />
                    {p.prevPrice && p.prevPrice !== p.price && (
                      <p className={`mt-1 text-right text-[11px] ${p.price > p.prevPrice ? 'text-red-500' : 'text-blue-600'}`}>
                        전일 {won(p.prevPrice)} {p.price > p.prevPrice ? '▲' : '▼'}
                      </p>
                    )}
                  </td>
                  <td className="p-2 align-top">
                    <select value={e.categoryId ?? p.categoryId} onChange={(ev) => edit(p.id, { categoryId: ev.target.value })} className={input}>
                      {CATS.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 align-top text-xs">
                    <span className={checkedToday ? 'text-emerald-600' : 'text-gray-400'}>{kstDate(p.updatedAt).slice(5)}</span>
                    {st && <p className={`mt-1 ${st.startsWith('✓') ? 'text-emerald-600' : st.endsWith('…') ? 'text-gray-400' : 'text-red-600'}`}>{st}</p>}
                  </td>
                  <td className="space-y-1 p-2 align-top text-xs">
                    <button
                      onClick={() => void save(p)}
                      disabled={!edits[p.id]}
                      className="w-full rounded bg-blue-600 py-1 font-bold text-white disabled:opacity-30"
                    >
                      저장
                    </button>
                    <div className="flex gap-1">
                      <a href={`/coupang/${p.id}`} target="_blank" className="flex-1 rounded border border-gray-200 py-1 text-center dark:border-gray-700">
                        페이지
                      </a>
                      <a href={p.buyUrl} target="_blank" rel="noreferrer" className="flex-1 rounded border border-gray-200 py-1 text-center dark:border-gray-700">
                        쿠팡
                      </a>
                    </div>
                    <button onClick={() => void remove(p)} className="w-full py-1 text-gray-400 hover:text-red-600">
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  {stale ? '오늘 가격 확인이 끝났어요 🎉' : '상품이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        {items.length < total && (
          <button onClick={() => void load(items.length)} className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">
            더 보기 ({items.length}/{total})
          </button>
        )}
        {dirtyCount > 0 && (
          <button onClick={() => void saveAll()} className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            변경한 {dirtyCount}개 모두 저장
          </button>
        )}
      </div>
    </div>
  );
}
