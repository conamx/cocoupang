import Link from 'next/link';
import type { Metadata } from 'next';
import { getPosts } from '@/lib/data';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '쇼핑·할인 정보',
  description: '쿠팡 최저가 활용법, 핫딜 커뮤니티 가이드, 여행 할인코드 등 쇼핑에 도움되는 정보.',
  alternates: { canonical: '/blog' },
};

export default async function BlogPage() {
  const posts = await getPosts();
  return (
    <div>
      <h1 className="mb-5 text-xl font-bold">쇼핑·할인 정보</h1>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {posts.map((p) => (
          <li key={p.slug} className="py-4">
            <Link href={`/blog/${p.slug}`} className="group block">
              <div className="text-xs font-semibold text-blue-600">{p.category}</div>
              <h2 className="mt-1 text-base font-bold group-hover:text-blue-600">{p.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{p.summary}</p>
              <div className="mt-1 text-xs text-gray-400">{p.date}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
