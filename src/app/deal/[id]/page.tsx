import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDeal, getDeals } from '@/lib/data';
import { timeAgo } from '@/lib/format';
import { site } from '@/lib/site';
import { ReactionButtons } from '@/components/ReactionButtons';
import { BookmarkButton } from '@/components/BookmarkButton';
import { Comments } from '@/components/Comments';
import { hasRealThumb } from '@/components/DealThumb';

export const revalidate = 3600;

export async function generateStaticParams() {
  const deals = await getDeals(50); // 나머지는 첫 방문 때 생성
  return deals.map((d) => ({ id: d.id }));
}

// 핫딜 ID 에 한글('뽐뿌-746482')이 들어 있어 주소에서는 인코딩된 채로 들어옴 → 풀어서 조회
const dealId = (raw: string) => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = dealId((await params).id);
  const d = await getDeal(id);
  if (!d) return {};
  return {
    title: d.title,
    description: `${d.source} 핫딜 · ${d.title}${d.price ? ` (${d.price})` : ''}`,
    alternates: { canonical: `/deal/${d.id}` },
    openGraph: { title: d.title, images: hasRealThumb(d.thumb) ? [d.thumb] : undefined, url: `${site.url}/deal/${d.id}` },
  };
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const id = dealId((await params).id);
  const d = await getDeal(id);
  if (!d) notFound();
  // 다른 핫딜 4개 (전체를 불러오지 않게 개수 제한)
  const more = (await getDeals(6)).filter((x) => x.id !== d.id).slice(0, 4);

  return (
    <article className="mx-auto max-w-2xl">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">{d.source}</span>
        <span className="text-gray-400">{d.category}</span>
        <span className="text-gray-400">· {timeAgo(d.postedAt)}</span>
      </div>
      <h1 className="mt-2 text-xl font-bold leading-snug">{d.title}</h1>

      {/* 이미지가 있는 글만 큰 이미지 (없으면 빈 그림 대신 생략) */}
      {hasRealThumb(d.thumb) && (
        <div className="relative mt-4 aspect-video overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img referrerPolicy="no-referrer" src={d.thumb} alt={d.title} className="h-full w-full object-cover" />
        </div>
      )}

      {d.price && <div className="mt-4 text-2xl font-extrabold">{d.price}</div>}

      <div className="mt-4 flex items-center gap-2">
        <a
          href={d.url}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="flex-1 rounded-lg bg-blue-600 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700"
        >
          딜 보러가기 →
        </a>
        <BookmarkButton type="deal" id={d.id} title={d.title} image={d.thumb} href={`/deal/${d.id}`} price={d.price} />
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        외부 커뮤니티/판매처로 이동합니다. 일부 링크는 제휴 링크일 수 있습니다.
      </p>

      <div className="mt-8 flex flex-col items-center gap-2 border-t border-gray-100 pt-6 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">이 딜, 어땠나요?</p>
        <ReactionButtons targetType="deal" targetId={d.id} />
      </div>

      <Comments targetType="deal" targetId={d.id} />


      {more.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-bold">다른 핫딜</h2>
          <ul className="space-y-2">
            {more.map((m) => (
              <li key={m.id}>
                <Link href={`/deal/${m.id}`} className="text-sm text-gray-700 hover:text-blue-600 dark:text-gray-300">
                  · {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
