import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBrand, getBrands } from '@/lib/data';
import { site } from '@/lib/site';

export const revalidate = 3600;

export async function generateStaticParams() {
  const brands = await getBrands();
  return brands.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBrand(slug);
  if (!b) return {};
  const title = `${b.name} 할인코드`;
  return {
    title,
    description: `${b.name} ${b.blurb}. 최신 할인코드와 적용법을 확인하세요.`,
    alternates: { canonical: `/travel/${b.slug}` },
    openGraph: { title, url: `${site.url}/travel/${b.slug}` },
  };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBrand(slug);
  if (!b) notFound();

  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{b.name} 할인코드</h1>
      <p className="mt-2 text-gray-500">{b.blurb}</p>

      <div className="mt-6 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          최신 할인코드는 수시로 변경됩니다. 아래 버튼으로 {b.name} 공식 페이지에서 현재 적용 가능한 코드와
          프로모션을 확인하세요.
        </p>
        <a
          href={b.url}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="mt-4 block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700"
        >
          {b.name} 할인코드 확인하기 →
        </a>
        <p className="mt-2 text-[11px] text-gray-400">일부 링크는 제휴 링크로, 구매 시 수수료를 받을 수 있습니다.</p>
      </div>
    </article>
  );
}
