import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { SpecialListing, specialMetadata, specialPath } from '@/components/SpecialListing';

// 빌드 때 미리 만들지 않고(빌드 중 DB 조회가 몰려 시간 초과 나는 것 방지) 첫 방문 때 만들어 캐시.
// 1쪽: /coupang/lowest, 2쪽부터: /coupang/lowest/2 — 매일 수집 후 즉시 갱신(/api/revalidate)
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

// 주소 조각 → 쪽 번호 (없으면 1쪽, 이상하면 NaN)
const toPage = (seg?: string[]) => (!seg || seg.length === 0 ? 1 : seg.length === 1 && /^\d{1,4}$/.test(seg[0]) ? Number(seg[0]) : NaN);

export async function generateMetadata({ params }: { params: Promise<{ page?: string[] }> }): Promise<Metadata> {
  const n = toPage((await params).page);
  return Number.isNaN(n) ? {} : specialMetadata('lowest', n);
}

export default async function Page({ params }: { params: Promise<{ page?: string[] }> }) {
  const n = toPage((await params).page);
  if (Number.isNaN(n) || n < 1) notFound();
  if (n === 1 && (await params).page?.length) permanentRedirect(specialPath('lowest'));
  return <SpecialListing kind="lowest" page={n} />;
}
