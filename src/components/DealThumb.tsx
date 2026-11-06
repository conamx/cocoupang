import { RemoteImg } from '@/components/RemoteImg';

const MALL_COLOR: Record<string, string> = {
  쿠팡: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300',
  옥션: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
  G마켓: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  지마켓: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  네이버: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  '11번가': 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300',
  롯데온: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  SSG: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  위메프: 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-300',
  티몬: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950 dark:text-fuchsia-300',
  알리: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
};

/** 제목 맨 앞 [쇼핑몰] 표시 → '옥션', 'G마켓' 등 */
export const mallOf = (title: string) => title.match(/^\s*\[([^\]]{1,10})\]/)?.[1]?.trim();

export const hasRealThumb = (thumb?: string) => !!thumb && !thumb.endsWith('/placeholder.svg');

/**
 * 핫딜 썸네일. 커뮤니티 RSS 에 이미지가 없는 글이 많아서,
 * 이미지가 없으면 빈 그림 대신 쇼핑몰 이름 칸을 보여 줌.
 */
export function DealThumb({ thumb, title, className = '' }: { thumb?: string; title: string; className?: string }) {
  if (hasRealThumb(thumb)) return <RemoteImg src={thumb!} alt={title} className={`h-full w-full object-cover ${className}`} />;
  const mall = mallOf(title) ?? '핫딜';
  const color = Object.entries(MALL_COLOR).find(([k]) => mall.toLowerCase().includes(k.toLowerCase()))?.[1] ?? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
  return (
    <div className={`flex h-full w-full items-center justify-center px-1 text-center text-[13px] font-extrabold leading-tight ${color} ${className}`}>
      {mall}
    </div>
  );
}
