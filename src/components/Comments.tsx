'use client';

import { useEffect, useState } from 'react';
import { timeAgo } from '@/lib/format';

type Comment = { id: number; nickname: string; body: string; createdAt: string };

export function Comments({ targetType, targetId }: { targetType: 'deal' | 'product'; targetId: string }) {
  const [list, setList] = useState<Comment[]>([]);
  const [nickname, setNickname] = useState('');
  const [body, setBody] = useState('');
  const [demo, setDemo] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/comments?type=${targetType}&id=${targetId}`)
      .then((r) => r.json())
      .then((d) => {
        setList(d.comments ?? []);
        setDemo(Boolean(d.demo));
      })
      .catch(() => {});
  }, [targetType, targetId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: targetType, id: targetId, nickname, body }),
    }).then((r) => r.json());
    setSending(false);
    if (res?.comment) setList((prev) => [res.comment, ...prev]);
    if (res?.demo) setDemo(true);
    setBody('');
  }

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-gray-800 sm:p-5">
      <h2 className="mb-3 text-base font-bold">댓글 {list.length > 0 && <span className="text-gray-400">{list.length}</span>}</h2>

      <form onSubmit={submit} className="mb-5 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <input
          maxLength={20}
          placeholder="닉네임 (비워두면 익명)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="mb-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
        />
        <textarea
          required
          maxLength={1000}
          rows={2}
          placeholder="댓글을 입력해주세요..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">{body.length}/1000</span>
          <button
            disabled={sending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            댓글 작성
          </button>
        </div>
      </form>

      {demo && <p className="mb-3 text-[11px] text-gray-400">데모 모드 — DB 연결 시 댓글이 저장됩니다.</p>}

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">첫 댓글을 남겨주세요!</p>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="border-b border-gray-100 pb-3 last:border-0 dark:border-gray-800">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-200">{c.nickname}</span>
                <span className="text-gray-400">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
