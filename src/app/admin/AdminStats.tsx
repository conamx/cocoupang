'use client';

import { useEffect, useState } from 'react';

type Stats = {
  total: number;
  live: number;
  ended: number;
  checked24h: number;
  coverage: number;
  lastHour: number;
  today: number;
  older3d: number;
  withDesc: number;
  lastUpdate: { name: string; at: string } | null;
};

/** 관리자 상단 수집 현황판 — 목표: 판매 중인 상품을 매일 한 번 가격 확인 (24시간 안 90% 이상) */
export function AdminStats({ adminKey }: { adminKey: string }) {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/admin/products?stats=1', { headers: { 'x-admin-key': adminKey } })
      .then(async (r) => (r.ok ? setS((await r.json()) as Stats) : setErr(`현황 불러오기 실패 (${r.status})`)))
      .catch(() => setErr('현황 불러오기 실패'));
  }, [adminKey]);

  if (err) return <p className="text-xs text-red-600">{err}</p>;
  if (!s) return <p className="text-xs text-gray-400">수집 현황 불러오는 중…</p>;

  const ago = s.lastUpdate ? Math.round((Date.now() - new Date(s.lastUpdate.at).getTime()) / 60000) : null;
  const tiles: [string, string, string?][] = [
    ['24시간 안 가격 확인', `${s.coverage}%`, `${s.checked24h.toLocaleString()} / ${s.live.toLocaleString()}개 (목표 90%)`],
    ['오늘 확인한 상품', s.today.toLocaleString(), `최근 1시간 ${s.lastHour.toLocaleString()}개`],
    ['3일 넘게 확인 안 됨', s.older3d.toLocaleString(), `판매종료 의심 ${s.ended.toLocaleString()}개 (목록에서 숨김)`],
    ['소개글 있는 상품', s.withDesc.toLocaleString(), `전체 ${s.total.toLocaleString()}개 중 ${s.total ? Math.round((s.withDesc / s.total) * 100) : 0}%`],
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-[11px] text-gray-500">{label}</p>
            <p
              className={`text-xl font-extrabold tabular-nums ${
                label.startsWith('24시간') ? (s.coverage >= 90 ? 'text-blue-600' : 'text-amber-600') : ''
              }`}
            >
              {value}
            </p>
            {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
          </div>
        ))}
      </div>
      {s.lastUpdate && (
        <p className="text-[11px] text-gray-400">
          마지막 갱신: {ago !== null && ago < 60 ? `${ago}분 전` : new Date(s.lastUpdate.at).toLocaleString('ko-KR')} · {s.lastUpdate.name}
        </p>
      )}
    </div>
  );
}
