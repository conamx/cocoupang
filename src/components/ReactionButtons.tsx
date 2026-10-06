'use client';

import { useEffect, useState } from 'react';

type Props = { targetType: 'deal' | 'product'; targetId: string };

export function ReactionButtons({ targetType, targetId }: Props) {
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [mine, setMine] = useState(0);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    fetch(`/api/reactions?type=${targetType}&id=${targetId}`)
      .then((r) => r.json())
      .then((d) => {
        setLikes(d.likes ?? 0);
        setDislikes(d.dislikes ?? 0);
        setDemo(Boolean(d.demo));
      })
      .catch(() => {});
  }, [targetType, targetId]);

  async function react(value: 1 | -1) {
    const next = mine === value ? 0 : value;
    setMine(next);
    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: targetType, id: targetId, value: next }),
    }).then((r) => r.json());
    if (res) {
      setLikes(res.likes ?? 0);
      setDislikes(res.dislikes ?? 0);
      setDemo(Boolean(res.demo));
    }
  }

  const base =
    'inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-bold transition';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => react(1)}
          aria-pressed={mine === 1}
          className={`${base} ${mine === 1 ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200'}`}
        >
          👍 좋아요 {likes > 0 && <span>{likes}</span>}
        </button>
        <button
          onClick={() => react(-1)}
          aria-pressed={mine === -1}
          className={`${base} ${mine === -1 ? 'border-gray-500 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100' : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200'}`}
        >
          👎 별로예요 {dislikes > 0 && <span>{dislikes}</span>}
        </button>
      </div>
      {demo && <p className="text-[11px] text-gray-400">데모 모드 — DB 연결 시 반응이 저장됩니다.</p>}
    </div>
  );
}
