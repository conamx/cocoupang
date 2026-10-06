'use client';

import { useState } from 'react';

export function PriceAlertForm({ productId, currentPrice }: { productId: string; currentPrice: number }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(Math.round(currentPrice * 0.9));
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<null | boolean>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, targetPrice: target, channel: 'email', destination: email }),
    }).then((r) => r.json());
    setDone(Boolean(res?.ok));
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
      >
        🔔 가격 내려가면 알림받기
      </button>
    );
  }

  if (done) {
    return <p className="mt-2 text-sm font-semibold text-emerald-600">알림이 등록되었습니다.</p>;
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center gap-2 text-sm">
        <label className="text-gray-500">목표가</label>
        <input
          type="number"
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
        />
        <span className="text-gray-500">원 이하</span>
      </div>
      <input
        type="email"
        required
        placeholder="알림 받을 이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
      />
      <button className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700">
        알림 등록
      </button>
    </form>
  );
}
