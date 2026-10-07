import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPost, getPosts } from '@/lib/data';
import { site } from '@/lib/site';
import { PostBody } from '@/components/PostBody';

export const revalidate = 3600;

// 한글 주소는 인코딩된 채로(%ED%96%87…) 들어오므로 풀어서 찾는다
function decodeSlug(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeSlug((await params).slug);
  const p = await getPost(slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.summary,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { title: p.title, description: p.summary, type: 'article', url: `${site.url}/blog/${p.slug}` },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeSlug((await params).slug);
  const p = await getPost(slug);
  if (!p) notFound();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.title,
    description: p.summary,
    datePublished: p.date,
    author: { '@type': 'Organization', name: site.name },
  };

  return (
    <article className="mx-auto max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <div className="text-xs font-semibold text-blue-600">{p.category}</div>
      <h1 className="mt-1 text-2xl font-bold leading-snug">{p.title}</h1>
      <div className="mt-2 text-xs text-gray-400">{p.date}</div>
      <PostBody body={p.body} />
    </article>
  );
}
