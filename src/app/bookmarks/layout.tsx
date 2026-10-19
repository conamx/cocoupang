import type { Metadata } from 'next';

// 찜 목록은 사람마다 다른 개인 화면 — 검색 노출 제외
export const metadata: Metadata = { title: '찜한 상품', robots: { index: false, follow: true } };

export default function BookmarksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
