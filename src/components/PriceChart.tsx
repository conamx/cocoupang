import type { PricePoint } from '@/lib/types';
import { won, shortDate } from '@/lib/format';

// 인라인 SVG 가격 그래프 (딜바고 스타일). 서버 렌더 가능 — JS 불필요.
export function PriceChart({ history }: { history: PricePoint[] }) {
  const w = 600;
  const h = 200;
  const padL = 54;
  const padR = 14;
  const padT = 16;
  const padB = 28;

  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(1, max - min);

  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const pts = history.map((p, i) => {
    const x = padL + (history.length === 1 ? innerW / 2 : (i / (history.length - 1)) * innerW);
    const y = padT + innerH - ((p.price - min) / range) * innerH;
    return { x, y, ...p };
  });

  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
  const area = `M${line} L${pts[pts.length - 1].x.toFixed(1)},${padT + innerH} L${pts[0].x.toFixed(1)},${padT + innerH} Z`;

  // x축 라벨: 최대 5개만
  const step = Math.max(1, Math.ceil(history.length / 5));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="가격 변동 그래프">
      {/* 최저/최고 가이드 라인 */}
      <line x1={padL} x2={w - padR} y1={padT} y2={padT} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={1} />
      <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize={10} className="fill-gray-400">{won(max)}</text>
      <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={1} />
      <text x={padL - 6} y={padT + innerH + 4} textAnchor="end" fontSize={10} className="fill-gray-400">{won(min)}</text>

      <path d={area} className="fill-blue-500/10" />
      <path d={`M${line}`} className="fill-none stroke-blue-500" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} className="fill-blue-500" />
      ))}

      {pts.map((p, i) =>
        i % step === 0 || i === pts.length - 1 ? (
          <text key={`x${i}`} x={p.x} y={h - 8} textAnchor="middle" fontSize={10} className="fill-gray-400">
            {shortDate(p.observedAt)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
