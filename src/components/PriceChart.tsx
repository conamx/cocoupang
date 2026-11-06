import type { PricePoint } from '@/lib/types';
import { shortDate } from '@/lib/format';

/**
 * 가격 그래프 (서버에서 그리는 SVG, JS 없음). 가격은 하루 동안 그대로라 계단형 선.
 *   mini    — 가격 카드 안에 들어가는 작은 선 (글자 없음)
 *   compact — 모바일용 비율 (글자가 작아지지 않게)
 */
export function PriceChart({
  history,
  avg,
  compact,
  mini,
}: {
  history: PricePoint[];
  avg?: number;
  compact?: boolean;
  mini?: boolean;
}) {
  // 하루에 여러 번 바뀐 날은 그날 마지막 가격 하나로 (한국 날짜 기준) → 세로로 튀는 선 없이 날짜별로
  const byDay = new Map<string, PricePoint>();
  for (const p of [...history].sort((a, b) => a.observedAt.localeCompare(b.observedAt))) {
    byDay.set(new Date(new Date(p.observedAt).getTime() + 9 * 3600_000).toISOString().slice(0, 10), p);
  }
  const data = [...byDay.values()];
  if (data.length < 2) return null;
  const w = mini ? 400 : compact ? 380 : 640;
  const h = mini ? 64 : compact ? 200 : 210;
  const padL = mini ? 4 : 8;
  const padR = mini ? 6 : 8;
  const padT = mini ? 6 : 24;
  const padB = mini ? 6 : 24;
  const id = mini ? 'pcm' : compact ? 'pcc' : 'pcd';

  const prices = data.map((p) => p.price);
  let lo = Math.min(...prices);
  let hi = Math.max(...prices);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * (mini ? 0.08 : 0.2);
  lo -= pad;
  hi += pad;

  const t0 = new Date(data[0].observedAt).getTime();
  const t1 = new Date(data[data.length - 1].observedAt).getTime();
  const X = (iso: string) => padL + (w - padL - padR) * (t1 === t0 ? 0.5 : (new Date(iso).getTime() - t0) / (t1 - t0));
  const Y = (v: number) => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo));
  const pts = data.map((p) => ({ x: X(p.observedAt), y: Y(p.price), ...p }));

  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += `H${pts[i].x.toFixed(1)}V${pts[i].y.toFixed(1)}`;
  const end = pts[pts.length - 1];

  // 같은 값이면 가장 최근 지점
  const mn = pts.reduce((a, p) => (p.price <= a.price ? p : a));
  const mx = pts.reduce((a, p) => (p.price >= a.price ? p : a));
  const labelX = (x: number) => Math.min(Math.max(x, 44), w - 44);
  // 날짜 눈금: 처음·끝은 항상, 가운데는 겹치지 않을 때만 (같은 날짜이거나 너무 붙으면 생략)
  const last = pts.length - 1;
  const mid = Math.floor(last / 2);
  const ticks = [0, last];
  if (
    mid !== 0 &&
    mid !== last &&
    [0, last].every((u) => shortDate(pts[u].observedAt) !== shortDate(pts[mid].observedAt) && Math.abs(pts[u].x - pts[mid].x) > 56)
  )
    ticks.splice(1, 0, mid);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="날짜별 쿠팡 판매가 그래프">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}V${h - padB}H${pts[0].x.toFixed(1)}Z`} fill={`url(#${id})`} />
      {!mini && avg !== undefined && avg > lo && avg < hi && (
        <line x1={padL} x2={w - padR} y1={Y(avg)} y2={Y(avg)} className="stroke-gray-300 dark:stroke-gray-600" strokeDasharray="3 4" strokeWidth={1} />
      )}
      <path d={d} fill="none" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={mini ? 2 : 2.2} strokeLinejoin="round" />
      <circle cx={end.x} cy={end.y} r={mini ? 3.5 : 4.5} className="fill-blue-600 dark:fill-blue-400" />
      {!mini &&
        mn.price !== mx.price &&
        [
          { p: mn, label: '최저', dy: 18 },
          { p: mx, label: '최고', dy: -10 },
        ].map(({ p, label, dy }) => (
          <text key={label} x={labelX(p.x)} y={p.y + dy} textAnchor="middle" fontSize={12} fontWeight={700} className="fill-gray-500">
            {label} {p.price.toLocaleString('ko-KR')}
          </text>
        ))}
      {!mini &&
        ticks.map((k) => (
          <text
            key={k}
            x={pts[k].x}
            y={h - 5}
            textAnchor={k === 0 ? 'start' : k === last ? 'end' : 'middle'}
            fontSize={11}
            className="fill-gray-400"
          >
            {shortDate(pts[k].observedAt)}
          </text>
        ))}
    </svg>
  );
}
