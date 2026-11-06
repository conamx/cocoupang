import type { Metadata } from 'next';
import { SpecialListing, specialMetadata } from '@/components/SpecialListing';

// 매일 수집 후 즉시 갱신(/api/revalidate) + 안전망 하루
export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return specialMetadata('drops', 1);
}

export default function Page() {
  return <SpecialListing kind="drops" page={1} />;
}
