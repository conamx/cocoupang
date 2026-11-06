import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { SpecialListing, specialMetadata, specialPath } from '@/components/SpecialListing';

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const toPage = (s: string) => (/^\d{1,4}$/.test(s) ? Number(s) : NaN);

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const n = toPage((await params).page);
  return Number.isNaN(n) ? {} : specialMetadata('drops', n);
}

export default async function PageN({ params }: { params: Promise<{ page: string }> }) {
  const n = toPage((await params).page);
  if (Number.isNaN(n) || n < 1) notFound();
  if (n === 1) permanentRedirect(specialPath('drops'));
  return <SpecialListing kind="drops" page={n} />;
}
