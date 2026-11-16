/**
 * 단위 가격 (참고용): 상품명에 적힌 용량·개수로 100g·100ml·1개당 가격을 계산.
 * 쿠팡 상품명은 보통 "상품명, 500ml, 24개" 처럼 옵션이 쉼표 뒤에 붙음.
 *  - 용량(g·kg·ml·L)이 있으면 → 용량 × 마지막 개수 로 100g·100ml 당
 *  - 용량 없이 개수만 2개 이상이면 → 1개(구·매·롤 등)당
 * 읽을 수 없으면 null (틀린 숫자를 보여 주느니 안 보여 줌).
 */
export type UnitPrice = { label: string; price: number };

const AMOUNT = /(\d+(?:\.\d+)?)\s*(kg|g|ml|l)(?![a-z가-힣])/gi;
const COUNT = /(\d+)\s*(개입|개|입|구|매|롤|팩|병|캔|봉|포|장|켤레)(?![가-힣])/g;

// 용량이 '담는 크기'인 물건 (컵 185ml, 텀블러 500ml 등) — 내용물 용량이 아니라서 100ml당 계산을 하면 안 됨
const CONTAINER = /컵|용기|텀블러|보틀|물병|밀폐|냄비|팬|가습기|통(?![조])|케이스|파우치|봉투|지퍼백/;

export function unitPrice(name: string, price: number): UnitPrice | null {
  if (!price || price <= 0) return null;
  const n = name.replace(/,/g, ' , ');
  const amounts = [...n.matchAll(AMOUNT)];
  const counts = [...n.matchAll(COUNT)];
  // 개수: 상품명에 나온 개수를 모두 곱함 (예: 30구 × 1개 = 30, 20개입 × 2팩 = 40)
  const count = counts.reduce((m, c) => m * Number(c[1]), 1);
  if (count <= 0 || count > 5000) return null;

  // 용량 기준: 개수가 함께 적혀 있어야 함 ("2L, 6개") — 용량만 있으면 크기 표시일 수 있어 계산 안 함
  if (amounts.length && counts.length && !CONTAINER.test(name)) {
    const [, v, u] = amounts[0];
    const unit = u.toLowerCase();
    const base = unit === 'kg' || unit === 'l' ? Number(v) * 1000 : Number(v);
    if (!base || base <= 0) return null;
    const per = (price / (base * count)) * 100;
    if (!isFinite(per) || per <= 0) return null;
    return { label: unit === 'ml' || unit === 'l' ? '100ml당' : '100g당', price: Math.round(per) };
  }
  // 개수 기준: 2개 이상일 때만, 가장 작은 단위(처음 나온 단위) 1개당
  if (counts.length && count >= 2) {
    const w = counts[0][2];
    return { label: `1${w === '개입' || w === '입' ? '개' : w}당`, price: Math.round(price / count) };
  }
  return null;
}

/** 옵션 이름에서 상품명 공통 부분을 빼고 옵션만 (예: "곰곰 대란, 30구, 2개" → "30구, 2개") */
export function optionLabel(full: string): string {
  const parts = full.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(', ') : full;
}
