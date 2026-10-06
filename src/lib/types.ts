export type PricePoint = {
  price: number;
  observedAt: string; // ISO date
};

export type Product = {
  id: string; // 쿠팡 productId
  name: string;
  image: string;
  categoryId: string;
  categoryLabel: string;
  option?: string;
  currentPrice: number;
  lowestPrice: number;
  highestPrice: number;
  vendorItemId?: string;
  updatedAt: string;
  history: PricePoint[];
};

export type Deal = {
  id: string;
  title: string;
  source: string; // 뽐뿌 / 펨코 / 루리웹 ...
  category: string;
  price?: string; // 원문 가격 표기 그대로
  thumb: string;
  url: string; // 원문/상품 링크
  postedAt: string;
  likeCount?: number;
};

export type Post = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  body: string;
};

export type DiscountBrand = {
  slug: string;
  name: string;
  group: 'travel' | 'shopping';
  blurb: string;
  url: string;
};
