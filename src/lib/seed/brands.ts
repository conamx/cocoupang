import type { DiscountBrand } from '@/lib/types';

export const seedBrands: DiscountBrand[] = [
  { slug: 'agoda', name: '아고다', group: 'travel', blurb: '호텔·숙소 예약 할인코드', url: 'https://www.agoda.com' },
  { slug: 'klook', name: '클룩', group: 'travel', blurb: '투어·액티비티·입장권 할인', url: 'https://www.klook.com' },
  { slug: 'trip-com', name: '트립닷컴', group: 'travel', blurb: '항공·호텔 통합 예약 할인', url: 'https://www.trip.com' },
  { slug: 'myrealtrip', name: '마이리얼트립', group: 'travel', blurb: '현지 투어·패키지 할인', url: 'https://www.myrealtrip.com' },
  { slug: 'aliexpress', name: '알리익스프레스', group: 'shopping', blurb: '해외직구 쿠폰·코드', url: 'https://www.aliexpress.com' },
  { slug: 'coupang', name: '쿠팡', group: 'shopping', blurb: '로켓배송·와우 혜택', url: 'https://www.coupang.com' },
];
