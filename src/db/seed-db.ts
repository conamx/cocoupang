/**
 * 시드 데이터를 Postgres에 적재합니다.
 *   DATA_SOURCE=db DATABASE_URL=... npm run db:seed
 * (먼저 npm run db:generate && npm run db:migrate 로 테이블 생성)
 */
import { db, schema } from './client';
import { seedProducts } from '@/lib/seed/products';
import { seedDeals } from '@/lib/seed/deals';
import { seedPosts } from '@/lib/seed/posts';

async function main() {
  const d = db();

  for (const p of seedProducts) {
    await d
      .insert(schema.products)
      .values({
        id: p.id,
        name: p.name,
        image: p.image,
        categoryId: p.categoryId,
        categoryLabel: p.categoryLabel,
        option: p.option,
        vendorItemId: p.vendorItemId,
        affiliateUrl: p.affiliateUrl,
        isRocket: p.isRocket ?? false,
        source: p.source ?? 'manual',
        rank: p.rank,
        currentPrice: p.currentPrice,
        prevPrice: p.prevPrice,
        lowestPrice: p.lowestPrice,
        highestPrice: p.highestPrice,
        updatedAt: new Date(p.updatedAt),
      })
      .onConflictDoNothing();

    for (const h of p.history) {
      await d.insert(schema.priceHistory).values({
        productId: p.id,
        price: h.price,
        observedAt: new Date(h.observedAt),
      });
    }
  }

  for (const deal of seedDeals) {
    await d
      .insert(schema.deals)
      .values({
        id: deal.id,
        title: deal.title,
        source: deal.source,
        category: deal.category,
        price: deal.price,
        thumb: deal.thumb,
        url: deal.url,
        likeCount: deal.likeCount ?? 0,
        postedAt: new Date(deal.postedAt),
      })
      .onConflictDoNothing();
  }

  for (const post of seedPosts) {
    await d
      .insert(schema.posts)
      .values({
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        category: post.category,
        body: post.body,
        date: new Date(post.date),
      })
      .onConflictDoNothing();
  }

  console.log('✅ seed complete:', {
    products: seedProducts.length,
    deals: seedDeals.length,
    posts: seedPosts.length,
  });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
