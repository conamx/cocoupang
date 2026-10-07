'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addDays,
  assignDates,
  parseTable,
  POST_CATEGORIES,
  tableToDrafts,
  todayKst,
  type PostDraft,
} from '@/lib/post-import';
import { readXlsxFirstSheet } from '@/lib/xlsx-read';

const CHUNK = 50;
const TEMPLATE = '/templates/shareinfo-posts-template.xlsx';

type Draft = PostDraft & { _k: number; error?: string };
type Listed = { slug: string; title: string; category: string; date: string; published: boolean };

const input =
  'w-full rounded border border-gray-200 bg-white px-2 py-1 text-[13px] dark:border-gray-700 dark:bg-gray-900';

export function AdminPosts({ adminKey, dbOn }: { adminKey: string; dbOn: boolean }) {
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [start, setStart] = useState(() => addDays(todayKst(), 1));
  const [perDay, setPerDay] = useState(2);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [listed, setListed] = useState<Listed[]>([]);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/posts', { headers: { 'x-admin-key': adminKey } });
    if (res.ok) setListed(((await res.json()) as { posts: Listed[] }).posts);
  }, [adminKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function take(table: string[][]) {
    const { drafts: ds, problems: ps } = tableToDrafts(table);
    const taken = new Set(listed.map((l) => l.slug));
    const dup = ds.filter((d) => taken.has(d.slug)).length;
    setDrafts(ds.map((d, i) => ({ ...d, _k: Date.now() + i })));
    setProblems(
      dup && !overwrite
        ? [...ps, `${dup}개는 이미 등록된 글과 주소가 같아요 → 그대로 등록하면 건너뛰고, '같은 주소면 덮어쓰기'를 켜면 교체해요.`]
        : ps,
    );
    setLog(ds.length ? [`${ds.length}개 읽음 — 발행일을 확인하고 등록하세요.`] : []);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setLog([`${f.name} 읽는 중…`]);
    try {
      if (/\.xlsx$/i.test(f.name)) take(await readXlsxFirstSheet(f));
      else if (/\.(csv|tsv|txt)$/i.test(f.name)) take(parseTable(await f.text()));
      else setLog(['.xlsx 또는 .csv 파일을 올려주세요 (.xls 옛 형식은 엑셀에서 .xlsx로 다시 저장)']);
    } catch (e) {
      setLog([`파일을 읽지 못했어요: ${(e as Error).message}`]);
    }
  }

  const scheduled = assignDates(drafts, start, perDay) as Draft[];
  const autoCount = drafts.filter((d) => !d.date).length;
  const lastDay = scheduled.reduce((m, d) => (d.date > m ? d.date : m), '');

  function update(k: number, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d) => (d._k === k ? { ...d, ...patch, error: undefined } : d)));
  }

  async function save() {
    setBusy(true);
    const toSend = scheduled;
    let remaining = [...toSend];
    let created = 0;
    let updated = 0;
    const lines: string[] = [];
    for (let i = 0; i < toSend.length; i += CHUNK) {
      const chunk = toSend.slice(i, i + CHUNK);
      const res = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ overwrite, posts: chunk.map(({ _k, error, ...d }) => d) }),
      });
      if (!res.ok) {
        lines.push(`오류 ${res.status}: ${await res.text()}`);
        break;
      }
      const { results } = (await res.json()) as {
        results: { slug: string; ok: boolean; status?: string; error?: string }[];
      };
      for (const r of results) {
        if (r.ok) {
          if (r.status === 'updated') updated++;
          else created++;
          remaining = remaining.filter((d) => d.slug !== r.slug);
        } else {
          remaining = remaining.map((d) => (d.slug === r.slug ? { ...d, error: r.error } : d));
        }
      }
      setLog([`등록 중… ${Math.min(i + CHUNK, toSend.length)}/${toSend.length}`]);
    }
    lines.unshift(
      `✅ 새 글 ${created}개${updated ? ` · 교체 ${updated}개` : ''} 등록${
        remaining.length ? ` · ⚠ ${remaining.length}개는 표에 남겨둠(빨간 줄 확인)` : ''
      }`,
    );
    // 남은 글은 화면에 보이던 날짜를 그대로 고정해 둔다
    setDrafts(remaining);
    setLog(lines);
    setBusy(false);
    void load();
  }

  async function remove(slug: string, title: string) {
    if (!confirm(`"${title}" 글을 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/posts?slug=${encodeURIComponent(slug)}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    });
    if (res.ok) setListed((l) => l.filter((x) => x.slug !== slug));
  }

  const pub = listed.filter((l) => l.published);
  const sch = listed.filter((l) => !l.published);
  const shown = showAll ? listed : [...sch, ...pub.slice(-10).reverse()];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">정보글 예약 등록</h1>
      {!dbOn && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          지금은 데모(시드) 모드라 저장되지 않습니다. DATA_SOURCE=db 와 DATABASE_URL 을 설정하세요.
        </p>
      )}

      <details className="rounded-lg border border-gray-200 p-3 text-[13px] text-gray-600 dark:border-gray-800 dark:text-gray-300" open={drafts.length === 0}>
        <summary className="cursor-pointer font-semibold">사용법</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            <a href={TEMPLATE} className="font-semibold text-blue-600 underline" download>
              엑셀 양식 내려받기
            </a>{' '}
            → 한 줄에 글 하나씩 채우기 (제목·본문만 필수)
          </li>
          <li>저장한 엑셀 파일을 아래에 올리기 (또는 엑셀에서 표 전체를 복사해 붙여넣기)</li>
          <li>발행일을 비운 글은 &lsquo;시작일부터 하루 N개씩&rsquo; 자동으로 날짜가 정해져요</li>
          <li>
            발행일 <b>오전 9시</b>부터 사이트·사이트맵에 나타나요. 그 전에는 방문자·검색엔진에 안 보여요
          </li>
        </ol>
        <p className="mt-2">
          본문 서식: 빈 줄 = 문단 나눔 · <code>## 소제목</code> · <code>### 작은 소제목</code> · <code>- 목록</code> ·
          한 줄에 <code>[상품:상품ID]</code> = 상품 카드 (상품ID는 &lsquo;상품 관리&rsquo; 탭이나 상품 페이지 주소 끝 숫자)
        </p>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded bg-gray-800 px-4 py-2 text-sm font-bold text-white dark:bg-gray-200 dark:text-gray-900">
          엑셀 파일 올리기
          <input
            type="file"
            accept=".xlsx,.csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <span className="text-xs text-gray-400">또는 아래에 붙여넣기</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className={`${input} font-mono`}
        placeholder={'엑셀에서 제목줄 포함해서 표 전체를 복사(Ctrl+A, Ctrl+C) → 여기에 붙여넣기(Ctrl+V)'}
      />
      {text.trim() && (
        <button
          onClick={() => {
            take(parseTable(text));
            setText('');
          }}
          className="rounded bg-gray-800 px-4 py-2 text-sm font-bold text-white dark:bg-gray-200 dark:text-gray-900"
        >
          표로 정리하기
        </button>
      )}

      {log.map((l) => (
        <p key={l} className="text-sm font-semibold">{l}</p>
      ))}
      {problems.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded bg-amber-50 p-3 pl-7 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {drafts.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-gray-50 p-3 text-[13px] dark:bg-gray-900">
            <label>
              자동 배정 시작일{' '}
              <input type="date" value={start} onChange={(e) => setStart(e.target.value || todayKst())} className="rounded border border-gray-200 px-2 py-1 dark:border-gray-700 dark:bg-gray-950" />
            </label>
            <label>
              하루{' '}
              <input
                type="number"
                min={1}
                max={50}
                value={perDay}
                onChange={(e) => setPerDay(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 rounded border border-gray-200 px-2 py-1 dark:border-gray-700 dark:bg-gray-950"
              />{' '}
              개씩
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              같은 주소면 덮어쓰기
            </label>
            <span className="text-gray-500">
              {autoCount ? `날짜 빈 글 ${autoCount}개 자동 배정 · ` : ''}마지막 발행일 {lastDay}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900">
                <tr>
                  <th className="w-36 p-2">발행일</th>
                  <th className="p-2">제목 · 요약</th>
                  <th className="w-32 p-2">카테고리</th>
                  <th className="w-44 p-2">주소 (/blog/…)</th>
                  <th className="w-16 p-2">상품</th>
                  <th className="w-10 p-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {scheduled.map((d) => (
                  <tr key={d._k} className={d.error ? 'bg-red-50 dark:bg-red-950/40' : ''}>
                    <td className="p-2">
                      <input
                        type="date"
                        value={d.date}
                        onChange={(e) => update(d._k, { date: e.target.value })}
                        className={`${input} ${drafts.find((x) => x._k === d._k)?.date ? '' : 'text-gray-400'}`}
                      />
                    </td>
                    <td className="p-2">
                      <input value={d.title} onChange={(e) => update(d._k, { title: e.target.value })} className={`${input} font-semibold`} />
                      <p className="mt-1 line-clamp-1 text-[11px] text-gray-400">{d.summary}</p>
                      {d.error && <p className="mt-1 text-xs text-red-600">{d.error}</p>}
                    </td>
                    <td className="p-2">
                      <input
                        list="post-cats"
                        value={d.category}
                        onChange={(e) => update(d._k, { category: e.target.value })}
                        className={input}
                      />
                    </td>
                    <td className="p-2">
                      <input value={d.slug} onChange={(e) => update(d._k, { slug: e.target.value })} className={`${input} font-mono text-[12px]`} />
                    </td>
                    <td className="p-2 text-center text-xs text-gray-500">
                      {d.products.length + (d.body.match(/\[\s*상품\s*[:：]/g)?.length ?? 0) || '-'}
                    </td>
                    <td className="p-2">
                      <button onClick={() => setDrafts((ds) => ds.filter((x) => x._k !== d._k))} className="text-xs text-gray-400 hover:text-red-500">
                        빼기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="post-cats">
              {POST_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <button onClick={save} disabled={busy || !dbOn} className="rounded bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {busy ? '등록 중…' : `${drafts.length}개 예약 등록하기`}
          </button>
        </>
      )}

      <section className="space-y-2 border-t border-gray-200 pt-5 dark:border-gray-800">
        <h2 className="text-base font-bold">
          등록된 글 <span className="text-sm font-normal text-gray-500">공개 {pub.length} · 예약 {sch.length}
          {sch.length ? ` (마지막 예약 ${sch[sch.length - 1].date})` : ''}</span>
        </h2>
        {listed.length === 0 ? (
          <p className="text-sm text-gray-400">아직 없어요.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800">
            {shown.map((l) => (
              <li key={l.slug} className="flex items-center gap-3 py-1.5">
                <span className={`w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-bold ${l.published ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                  {l.published ? '공개' : '예약'}
                </span>
                <span className="w-24 shrink-0 text-gray-500">{l.date}</span>
                {l.published ? (
                  <a href={`/blog/${l.slug}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-blue-600">
                    {l.title}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                )}
                <span className="hidden shrink-0 text-gray-400 sm:inline">{l.category}</span>
                <button onClick={() => remove(l.slug, l.title)} className="shrink-0 text-xs text-gray-400 hover:text-red-500">
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        {listed.length > shown.length && (
          <button onClick={() => setShowAll(true)} className="text-xs text-blue-600">
            전체 {listed.length}개 보기
          </button>
        )}
      </section>
    </div>
  );
}
