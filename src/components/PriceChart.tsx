import type { PricePoint } from '@/lib/types';
import { shortDate } from '@/lib/format';

/**
 * 가격 그래프 (서버에서 그리는 SVG, JS 없음).
 * 가격은 하루 동안 그대로이므로 계단형 선. 최저(파랑)·최고(빨강) 지점 표시, 평균은 점선.
 */
/** compact: 모바일용 (좁은 비율 → 글자가 작아지지 않게) */
export function PriceChart({ history, avg, compact }: { history: PricePoint[]; avg?: number; compact?: boolean }) {
  const data = [...history].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (!data.length) return null;
  const w = compact ? 380 : 640;
  const h = compact ? 210 : 220;
  const padL = 8;
  const padR = 8;
  const padT = 26;
  const padB = 24;

  const prices = data.map((p) => p.price);
  let lo = Math.min(...prices);
  let hi = Math.max(...prices);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.2;
  lo -= pad;
  hi += pad;

  const t0 = new Date(data[0].observedAt).getTime();
  const t1 = new Date(data[data.length - 1].observedAt).getTime();
  const X = (iso: string) =>
    padL + (w - padL - padR) * (t1 === t0 ? 0.5 : (new Date(iso).getTime() - t0) / (t1 - t0));
  const Y = (v: number) => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo));
  const pts = data.map((p) => ({ x: X(p.observedAt), y: Y(p.price), ...p }));

  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += `H${pts[i].x.toFixed(1)}V${pts[i].y.toFixed(1)}`;
  if (pts.length === 1) d += `H${(w - padR).toFixed(1)}`;
  const last = pts.length === 1 ? w - padR : pts[pts.length - 1].x;

  // 같은 값이면 가장 최근 지점
  const mn = pts.reduce((a, p) => (p.price <= a.price ? p : a));
  const mx = pts.reduce((a, p) => (p.price >= a.price ? p : a));
  const labelX = (x: number) => Math.min(Math.max(x, 48), w - 48);
  const ticks = pts.length > 2 ? [0, Math.floor((pts.length - 1) / 2), pts.length - 1] : pts.map((_, i) => i);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="날짜별 쿠팡 판매가 그래프">
      <defs>
        <linearGradient id={compact ? "pc-fill-m" : "pc-fill"} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}V${h - padB}H${pts[0].x.toFixed(1)}Z`} fill={`url(#${compact ? "pc-fill-m" : "pc-fill"})`} />
      <path d={d} fill="none" className="stroke-gray-900 dark:stroke-gray-100" strokeWidth={2.2} strokeLinejoin="round" />
      {avg !== undefined && avg > lo && avg < hi && (
        <line x1={padL} x2={w - padR} y1={Y(avg)} y2={Y(avg)} className="stroke-gray-400" strokeDasharray="4 4" strokeWidth={1} />
      )}
      {mn.price !== mx.price &&
        [
          { p: mn, color: '#2563eb', label: '최저', dy: 18 },
          { p: mx, color: '#dc2626', label: '최고', dy: -10 },
        ].map(({ p, color, label, dy }) => (
          <g key={label}>
            <circle cx={p.x} cy={p.y} r={4.5} fill="#fff" stroke={color} strokeWidth={2.4} />
            <text x={labelX(p.x)} y={p.y + dy} textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>
              {label} {p.price.toLocaleString('ko-KR')}
            </text>
          </g>
        ))}
      {pts.length === 1 && <circle cx={last} cy={pts[0].y} r={4} className="fill-gray-900 dark:fill-gray-100" />}
      {ticks.map((k, j) => (
        <text
          key={k}
          x={pts[k].x}
          y={h - 6}
          textAnchor={ticks.length > 1 ? (j === 0 ? 'start' : j === ticks.length - 1 ? 'end' : 'middle') : 'middle'}
          fontSize={11}
          className="fill-gray-400"
        >
          {shortDate(pts[k].observedAt)}
        </text>
      ))}
    </svg>
  );
}
