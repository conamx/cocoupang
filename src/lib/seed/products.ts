import type { Product } from '@/lib/types';

// 가격 이력을 간단히 생성하는 헬퍼 (데모용).
function history(base: number, days: number, swings: number[]): Product['history'] {
  const out: Product['history'] = [];
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const price = Math.max(100, Math.round((base + (swings[i % swings.length] ?? 0)) / 10) * 10);
    out.push({ price, observedAt: d.toISOString() });
  }
  return out;
}

const raw: Omit<Product, 'currentPrice' | 'lowestPrice' | 'highestPrice'>[] = [
  {
    id: '7361511423',
    name: '롯데 자일리톨 오리지날 대용량 실속팩 리필 231g',
    image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=600&q=70',
    categoryId: '1012',
    categoryLabel: '식품',
    option: '231g, 1개',
    vendorItemId: '85000111222',
    updatedAt: new Date().toISOString(),
    history: history(7900, 14, [0, -120, -260, 60, -400, 120, -80]),
  },
  {
    id: '6925681373',
    name: '오볶집 갓 로스팅 구운아몬드 200g',
    image: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=600&q=70',
    categoryId: '1012',
    categoryLabel: '식품',
    option: '200g, 1봉',
    vendorItemId: '85000333444',
    updatedAt: new Date().toISOString(),
    history: history(8200, 14, [0, 200, -300, -300, 400, -100, 0]),
  },
  {
    id: '8645132821',
    name: '헤드앤숄더 가려운 두피케어 린스 1000ml',
    image: 'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=600&q=70',
    categoryId: '1010',
    categoryLabel: '뷰티',
    option: '1000ml, 2개',
    vendorItemId: '85000555666',
    updatedAt: new Date().toISOString(),
    history: history(13400, 14, [0, -300, -300, 600, -900, 300, 120]),
  },
  {
    id: '7441905087',
    name: '사조 전자레인지용 팝콘 카라멜맛 70g 8개',
    image: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=600&q=70',
    categoryId: '1012',
    categoryLabel: '식품',
    option: '70g, 8개',
    vendorItemId: '85000777888',
    updatedAt: new Date().toISOString(),
    history: history(10500, 14, [0, 0, -500, 500, -1000, 400, 200]),
  },
  {
    id: '9012233445',
    name: '삼성 2.5인치 외장 SSD T7 1TB',
    image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&q=70',
    categoryId: '1016',
    categoryLabel: '가전디지털',
    option: '1TB, 그레이',
    vendorItemId: '85000999000',
    updatedAt: new Date().toISOString(),
    history: history(128000, 14, [0, -3000, -2000, 5000, -9000, 2000, -1500]),
  },
  {
    id: '9100455667',
    name: '리큐 진한겔 실내건조 세탁세제 2.1L',
    image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600&q=70',
    categoryId: '1014',
    categoryLabel: '생활용품',
    option: '2.1L, 2개',
    vendorItemId: '85000112233',
    updatedAt: new Date().toISOString(),
    history: history(15800, 14, [0, 400, -600, -600, 800, -200, 0]),
  },
];

export const seedProducts: Product[] = raw.map((p, i) => {
  const prices = p.history.map((h) => h.price);
  return {
    ...p,
    source: i < 3 ? 'goldbox' : 'best', // 데모: 앞 3개를 오늘의 골드박스로
    rank: i + 1,
    isRocket: i % 2 === 0,
    currentPrice: prices[prices.length - 1],
    prevPrice: prices[prices.length - 2], // 전일가
    lowestPrice: Math.min(...prices),
    highestPrice: Math.max(...prices),
  };
});
