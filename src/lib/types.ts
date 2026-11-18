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
  description?: string; // 상품 소개
  currentPrice: number;
  lowestPrice: number;
  highestPrice: number;
  vendorItemId?: string;
  affiliateUrl?: string;
  isRocket?: boolean;
  source?: 'best' | 'goldbox' | 'search' | 'manual';
  rank?: number;
  prevPrice?: number;
  updatedAt: string;
  history: PricePoint[];
  searchTerms?: string[]; // 이 상품이 수집된 쿠팡 검색어들 (상세 페이지에서만 채움)
  // ↓ 상세 페이지에서만 채움 (수집 작업이 쌓는 표에서 읽음, 표가 없으면 비어 있음)
  ended?: boolean; // 판매종료 의심: 재확인에서 사흘 연속 못 찾음
  successors?: Successor[]; // 판매종료일 때 '지금 판매 중인 같은 상품' 후보
  optionChange?: { from: string; to: string; at: string }; // 최근 옵션 갈아타기
  options?: ProductOption[]; // 최근 7일 안에 본 다른 옵션 가격
};

export type Successor = {
  id: string;
  name: string;
  price: number;
  image?: string;
  affiliateUrl?: string;
  isRocket?: boolean;
  onSite: boolean; // 우리 사이트에도 있는 상품이면 상품 페이지로 연결
};

export type ProductOption = {
  name: string;
  price: number;
  seenAt: string;
  current: boolean; // 지금 이 페이지가 기록하는 옵션
  url?: string; // 그 옵션으로 바로 가는 파트너스 링크 (없으면 상품 대표 링크)
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
