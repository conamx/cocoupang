import type { Metadata } from 'next';
import { CategoryListing, categoryMetadata } from './listing';

// 정적 페이지 + 수집 후 즉시 갱신(/api/revalidate). 요청마다 함수가 돌지 않게 searchParams 를 쓰지 않습니다.
export const revalidate = 86400;

// 빌드 때 미리 만들지 않고 첫 방문 때 만들어 캐시 (빌드 중 DB 호출이 몰려 시간 초과 나는 것 방지)
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ cat: string }> }): Promise<Metadata> {
  return categoryMetadata((await params).cat, 1);
}

export default async function CategoryPage({ params }: { params: Promise<{ cat: string }> }) {
  return <CategoryListing id={(await params).cat} page={1} />;
}
