import {
  pgTable,
  text,
  integer,
  timestamp,
  serial,
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
  currentPrice: integer('current_price').notNull(),
  lowestPrice: integer('lowest_price').notNull(),
  highestPrice: integer('highest_price').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byCategory: index('products_category_idx').on(t.categoryId),
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

// ─── 유저 상호작용 (Phase 4) ────────────────────────────────
export const reactions = pgTable('reactions', {
  targetType: text('target_type').notNull(), // 'deal' | 'product'
  targetId: text('target_id').notNull(),
  anonId: text('anon_id').notNull(),
  value: integer('value').notNull(), // 1 = 좋아요, -1 = 별로
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.targetType, t.targetId, t.anonId] }),
}));

export const priceAlerts = pgTable('price_alerts', {
  id: serial('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  targetPrice: integer('target_price').notNull(),
  channel: text('channel').notNull(), // 'email' | 'push'
  destination: text('destination').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
