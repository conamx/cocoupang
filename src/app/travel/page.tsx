import Link from 'next/link';
import type { Metadata } from 'next';
import { getBrands } from '@/lib/data';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '할인코드 모음',
  description: '아고다·클룩·트립닷컴·알리익스프레스 등 여행·쇼핑 할인코드를 모아봤습니다.',
  alternates: { canonical: '/travel' },
};

export default async function TravelPage() {
  const brands = await getBrands();
  const travel = brands.filter((b) => b.group === 'travel');
  const shopping = brands.filter((b) => b.group === 'shopping');

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">할인코드 모음</h1>
      <Group title="여행" items={travel} />
      <Group title="쇼핑" items={shopping} />
    </div>
  );
}

function Group({ title, items }: { title: string; items: Awaited<ReturnType<typeof getBrands>> }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((b) => (
          <Link
            key={b.slug}
            href={`/travel/${b.slug}`}
            className="rounded-xl border border-gray-200 p-4 transition hover:border-blue-300 dark:border-gray-800"
          >
            <div className="font-bold">{b.name}</div>
            <div className="mt-0.5 text-sm text-gray-500">{b.blurb}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
