'use client';

import { useEffect, useState } from 'react';
import { badImageReason, isAffiliateLink, parsePaste, parsePrice, type ParsedRow } from '@/lib/manual-import';
import { coupangCategories, etcCategory } from '@/lib/site';
import { AdminPosts } from './AdminPosts';
import { AdminProducts } from './AdminProducts';

const CATS = [...coupangCategories, etcCategory];
const KEY = 'shareinfo-admin-key';
const CHUNK = 50;

type Row = ParsedRow & { _k: number; error?: string; priceText?: string };

const input =
  'w-full rounded border border-gray-200 bg-white px-2 py-1 text-[13px] dark:border-gray-700 dark:bg-gray-900';

export function AdminImport() {
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [dbOn, setDbOn] = useState(true);
  const [text, setText] = useState('');
  const [defaultCat, setDefaultCat] = useState(coupangCategories[0].id);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [tab, setTab] = useState<'import' | 'manage' | 'posts'>('import');

  async function login(k: string) {
    const res = await fetch('/api/admin/products', { headers: { 'x-admin-key': k } });
    if (!res.ok) return false;
    const j = (await res.json()) as { db: boolean };
    setDbOn(j.db);
    setAuthed(true);
    setLog([]); // 이전 로그인 실패 문구가 남지 않도록
    try {
      sessionStorage.setItem(KEY, k);
    } catch {}
    return true;
  }

  useEffect(() => {
    let saved = '';
    try {
      saved = sessionStorage.getItem(KEY) ?? '';
    } catch {}
    if (saved) {
      setKey(saved);
      void login(saved);
    }
  }, []);

  function analyze() {
    const parsed = parsePaste(text).map((r, i) => ({ ...r, _k: Date.now() + i }));
    setRows((prev) => [...prev, ...parsed]);
    setText('');
    setLog([`${parsed.length}개 인식됨 — 아래 표에서 확인·수정 후 등록하세요.`]);
  }

  function update(k: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r._k === k ? { ...r, ...patch, error: undefined } : r)));
  }

  async function save() {
    setBusy(true);
    const lines: string[] = [];
    let remaining = [...rows];
    let okCount = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({
          defaultCategoryId: defaultCat,
          rows: chunk.map(({ _k, error, priceText, ...r }) => r),
        }),
      });
      if (!res.ok) {
        lines.push(`오류 ${res.status}: ${await res.text()}`);
        break;
      }
      const { results } = (await res.json()) as {
        results: { link: string; ok: boolean; id?: string; error?: string; created?: boolean }[];
      };
      for (const r of results) {
        if (r.ok) {
          okCount++;
          remaining = remaining.filter((x) => x.link !== r.link);
        } else {
          remaining = remaining.map((x) => (x.link === r.link ? { ...x, error: r.error } : x));
        }
      }
      setLog([`저장 중… ${Math.min(i + CHUNK, rows.length)}/${rows.length}`]);
    }
    lines.unshift(`✅ ${okCount}개 저장 완료${remaining.length ? ` · ⚠ ${remaining.length}개는 표에 남겨둠(오류 확인)` : ''}`);
    setRows(remaining);
    setLog(lines);
    setBusy(false);
  }

  if (!authed) {
    return (
      <form
        className="mx-auto mt-16 max-w-xs space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!(await login(key))) setLog(['비밀번호가 맞지 않습니다 (ADMIN_PASSWORD).']);
        }}
      >
        <h1 className="text-lg font-bold">관리자 로그인</h1>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} className={input} placeholder="비밀번호" />
        <button className="w-full rounded bg-blue-600 py-2 text-sm font-bold text-white">로그인</button>
        {log.map((l) => (
          <p key={l} className="text-xs text-red-500">{l}</p>
        ))}
      </form>
    );
  }

  const bad = rows.filter((r) => !r.name || !r.image || !r.price).length;

  const tabs = (
    <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
      {(
        [
          ['import', '붙여넣기 등록'],
          ['manage', '상품 관리 (수정·삭제)'],
          ['posts', '정보글 예약 등록'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-bold ${
            tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (tab === 'posts') {
    return (
      <div className="space-y-5">
        {tabs}
        <AdminPosts adminKey={key} dbOn={dbOn} />
      </div>
    );
  }

  if (tab === 'manage') {
    return (
      <div className="space-y-5">
        {tabs}
        <AdminProducts adminKey={key} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {tabs}
      <h1 className="text-xl font-bold">상품 붙여넣기 등록</h1>
      {!dbOn && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          지금은 데모(시드) 모드라 저장되지 않습니다. DATA_SOURCE=db 와 DATABASE_URL 을 설정하세요.
        </p>
      )}

      <details className="rounded-lg border border-gray-200 p-3 text-[13px] text-gray-600 dark:border-gray-800 dark:text-gray-300" open={rows.length === 0}>
        <summary className="cursor-pointer font-semibold">붙여넣을 수 있는 형식 (섞어도 됨)</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>쿠팡 파트너스 HTML 코드</b> — 상품 링크 만들기 → HTML 복사. 링크·이미지·상품명이 한 번에 들어옵니다(가격만 입력).
          </li>
          <li>
            <b>엑셀/구글시트 행 복사</b> — 열 순서 상관없이 링크 · 상품명 · 가격 · 이미지주소 · 카테고리
          </li>
          <li>
            <b>줄 단위</b> — 상품명 ↵ 가격 ↵ 링크 순으로 여러 개
          </li>
          <li>이미 등록된 상품은 <b>링크 + 가격</b>만 넣으면 가격만 갱신됩니다(가격 이력·전일대비 자동 계산).</li>
        </ul>
      </details>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        className={`${input} font-mono`}
        placeholder={'<a href="https://link.coupang.com/a/..."><img src="..." alt="상품명"></a>\n또는\nhttps://link.coupang.com/a/...\t상품명\t12,900\t이미지주소'}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={analyze} disabled={!text.trim()} className="rounded bg-gray-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 dark:bg-gray-200 dark:text-gray-900">
          표로 정리하기
        </button>
        <label className="text-[13px] text-gray-500">
          기본 카테고리{' '}
          <select value={defaultCat} onChange={(e) => setDefaultCat(e.target.value)} className="rounded border border-gray-200 px-2 py-1 dark:border-gray-700 dark:bg-gray-900">
            {CATS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
      </div>

      {log.map((l) => (
        <p key={l} className="text-sm font-semibold">{l}</p>
      ))}

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900">
                <tr>
                  <th className="p-2">사진</th>
                  <th className="p-2">상품명</th>
                  <th className="w-28 p-2">가격</th>
                  <th className="w-32 p-2">카테고리</th>
                  <th className="p-2">이미지 주소 · 링크</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((r) => (
                  <tr key={r._k} className={r.error ? 'bg-red-50 dark:bg-red-950/40' : ''}>
                    <td className="p-2">
                      {r.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-gray-100 dark:bg-gray-800" />
                      )}
                    </td>
                    <td className="p-2">
                      <input value={r.name ?? ''} onChange={(e) => update(r._k, { name: e.target.value })} className={input} placeholder="상품명" />
                      {r.error && <p className="mt-1 text-xs text-red-600">{r.error}</p>}
                    </td>
                    <td className="p-2">
                      <input
                        value={r.priceText ?? r.price?.toLocaleString('ko-KR') ?? ''}
                        onChange={(e) => update(r._k, { priceText: e.target.value, price: parsePrice(e.target.value) })}
                        className={input}
                        placeholder="12,900"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="p-2">
                      <select value={r.categoryId ?? defaultCat} onChange={(e) => update(r._k, { categoryId: e.target.value })} className={input}>
                        {CATS.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="space-y-1 p-2">
                      <input value={r.image ?? ''} onChange={(e) => update(r._k, { image: e.target.value })} className={input} placeholder="이미지 주소" />
                      {badImageReason(r.image) && <p className="text-[11px] text-red-600">{badImageReason(r.image)}</p>}
                      <p className="truncate text-[11px] text-gray-400" title={r.link}>
                        {isAffiliateLink(r.link) ? '✔ 파트너스 링크' : '⚠ 일반 링크(수수료 X)'} · {r.link}
                      </p>
                    </td>
                    <td className="p-2">
                      <button onClick={() => setRows((rs) => rs.filter((x) => x._k !== r._k))} className="text-xs text-gray-400 hover:text-red-500">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy || !dbOn} className="rounded bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {busy ? '저장 중…' : `${rows.length}개 등록하기`}
            </button>
            {bad > 0 && (
              <span className="text-xs text-gray-500">
                빈 칸이 있는 {bad}개는 새 상품이면 저장되지 않습니다(이미 등록된 상품은 기존 값 사용).
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
