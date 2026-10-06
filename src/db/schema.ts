import {
  pgTable,
  text,
  integer,
  timestamp,
  serial,
  boolean,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ─── 상품 (쿠팡 가격 추적) ──────────────────────────────────
export const products = pgTable('products', {
  id: text('id').primaryKey(), // 쿠팡 productId
  name: text('name').notNull(),
  image: text('image').notNull(),
  categoryId: text('category_id').notNull(),
  categoryLabel: text('category_label').notNull(),
  option: text('option'),
  vendorItemId: text('vendor_item_id'),
  // 파트너스 API가 돌려주는 수수료 추적 링크(link.coupang.com). 없으면 상품 URL로 대체.
  affiliateUrl: text('affiliate_url'),
  isRocket: boolean('is_rocket').default(false).notNull(),
  // 수집 경로: best(카테고리 베스트) | goldbox(오늘의 특가) | search(키워드) | manual
  source: text('source').default('manual').notNull(),
  rank: integer('rank'), // 수집 시점의 순위(작을수록 인기)
  currentPrice: integer('current_price').notNull(),
  prevPrice: integer('prev_price'), // 직전 관측가 — 가격 하락률 계산용
  lowestPrice: integer('lowest_price').notNull(),
  highestPrice: integer('highest_price').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byCategory: index('products_category_idx').on(t.categoryId),
  bySource: index('products_source_idx').on(t.source, t.updatedAt),
}));

// ─── 가격 이력 ──────────────────────────────────────────────
export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  price: integer('price').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
}, (t) => ({
  byProduct: index('price_history_product_idx').on(t.productId, t.observedAt),
}));

// ─── 커뮤니티 핫딜 ──────────────────────────────────────────
export const deals = pgTable('deals', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  source: text('source').notNull(), // 뽐뿌 / 펨코 / 루리웹
  category: text('category').notNull(),
  price: text('price'),
  thumb: text('thumb').notNull(),
  url: text('url').notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull(),
}, (t) => ({
  byPosted: index('deals_posted_idx').on(t.postedAt),
}));

// ─── 정보 콘텐츠(블로그) ────────────────────────────────────
export const posts = pgTable('posts', {
  slug: text('slug').primaryKey(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  category: text('category').notNull(),
  body: text('body').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
});

// ─── 유저 상호작용 ────────────────────────────────
export const reactions = pgTable('reactions', {
  targetType: text('target_type').notNull(), // 'deal' | 'product'
  targetId: text('target_id').notNull(),
  anonId: text('anon_id').notNull(),
  value: integer('value').notNull(), // 1 = 좋아요, -1 = 별로
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.targetType, t.targetId, t.anonId] }),
}));

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  targetType: text('target_type').notNull(), // 'deal' | 'product'
  targetId: text('target_id').notNull(),
  nickname: text('nickname'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byTarget: index('comments_target_idx').on(t.targetType, t.targetId, t.createdAt),
}));
