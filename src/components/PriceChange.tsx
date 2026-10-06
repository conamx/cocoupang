import { dayChange, won } from '@/lib/format';

// 전일대비 상승/하락 표시 — 상승 빨강 ▲, 하락 파랑 ▼ (국내 증권 표기 관례)
export function PriceChange({
  currentPrice,
  prevPrice,
  withAmount,
  className = '',
}: {
  currentPrice: number;
  prevPrice?: number;
  withAmount?: boolean;
  className?: string;
}) {
  const rate = dayChange({ currentPrice, prevPrice });
  if (rate === null) return null;
  if (rate === 0) return <span className={`text-gray-400 ${className}`}>전일대비 0%</span>;
  const up = rate > 0;
  const diff = Math.abs(currentPrice - (prevPrice ?? currentPrice));
  return (
    <span className={`${up ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'} ${className}`}>
      {up ? '▲' : '▼'}
      {withAmount && ` ${won(diff)} `}
      {withAmount ? `(${Math.abs(rate)}%)` : `${Math.abs(rate)}%`}
    </span>
  );
}
