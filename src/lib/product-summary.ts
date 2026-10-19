import type { Product } from '@/lib/types';
import { won } from '@/lib/format';

/**
 * 상품 페이지용 설명글·FAQ 자동 생성 (가격 기록 기반, 외부 API 없음).
 * 상품마다 숫자·날짜가 달라 페이지별로 다른 본문이 만들어집니다 — 검색엔진의 '빈 페이지' 판정 방지용.
 */

const kDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

// 받침에 따라 은/는 (상품명이 영문·숫자로 끝나면 '은(는)')
function eunNeun(word: string): string {
  const c = word.trim().slice(-1);
  const code = c.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '은(는)';
  return code % 28 ? '은' : '는';
}

const pct = (a: number, b: number) => Math.round(((a - b) / b) * 1000) / 10;

export type Faq = { q: string; a: string };

export function productSummary(p: Product): { paragraphs: string[]; faq: Faq[]; meta: string } {
  const hist = [...p.history].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const n = hist.length;
  const first = hist[0];
  const lowPoint = hist.reduce<(typeof hist)[number] | undefined>((m, h) => (!m || h.price < m.price ? h : m), undefined);
  const avg = n ? Math.round(hist.reduce((s, h) => s + h.price, 0) / n / 10) * 10 : p.currentPrice;
  const atLowest = p.currentPrice <= p.lowestPrice;
  const overLow = p.currentPrice - p.lowestPrice;
  const vsAvg = n >= 2 ? pct(p.currentPrice, avg) : 0;

  const paragraphs: string[] = [];
  paragraphs.push(
    `${p.name}${eunNeun(p.name)} 쿠팡 ${p.categoryLabel} 카테고리 상품으로, ${kDate(p.updatedAt)} 확인한 가격은 ${won(p.currentPrice)}입니다.` +
      (p.isRocket ? ' 로켓배송 상품이라 주문 다음 날 받아볼 수 있어요.' : ''),
  );

  if (n >= 2 && first) {
    paragraphs.push(
      `셰어인포는 ${kDate(first.observedAt)}부터 이 상품의 가격을 ${n}회 기록했습니다. ` +
        `이 기간 최저가는 ${won(p.lowestPrice)}${lowPoint ? `(${kDate(lowPoint.observedAt)})` : ''}, ` +
        `최고가는 ${won(p.highestPrice)}, 평균 가격은 약 ${won(avg)}이에요.`,
    );
    paragraphs.push(
      atLowest
        ? `지금 가격은 기록된 가격 중 가장 낮은 역대 최저가입니다. 평소보다 저렴할 때라 필요하다면 지금 구매하는 걸 추천해요.`
        : `지금 가격은 역대 최저가보다 ${won(overLow)} 높고, 평균 가격보다 ${Math.abs(vsAvg)}% ${vsAvg > 0 ? '비싼' : vsAvg < 0 ? '싼' : '비슷한'} 수준이에요. ` +
            (vsAvg > 0 ? '급하지 않다면 가격이 내려갈 때까지 기다려 보는 것도 방법입니다.' : '평소 가격과 비교하면 나쁘지 않은 가격이에요.'),
    );
  } else {
    paragraphs.push(
      `이 상품은 최근 가격 추적을 시작해 아직 기록이 많지 않아요. 가격이 확인될 때마다 아래 그래프와 이력에 쌓이며, 기록이 쌓이면 지금 가격이 싼지 비싼지 비교해 드립니다.`,
    );
  }
  paragraphs.push(
    `쿠팡 가격은 할인 쿠폰·재고·판매자에 따라 수시로 바뀌므로, 구매 전 쿠팡 상품 페이지에서 최종 가격을 꼭 확인하세요.`,
  );

  const faq: Faq[] = [
    {
      q: `${p.name} 지금 사도 될까요?`,
      a:
        n < 2
          ? `아직 가격 기록이 적어 비교가 어려워요. 현재 가격은 ${won(p.currentPrice)}이며, 앞으로 쌓이는 가격 추이를 참고해 주세요.`
          : atLowest
            ? `네. 현재 ${won(p.currentPrice)}으로 셰어인포가 기록한 역대 최저가예요.`
            : `현재 ${won(p.currentPrice)}으로 역대 최저가(${won(p.lowestPrice)})보다 ${won(overLow)} 높아요. ${vsAvg > 0 ? '가격 하락을 기다려 보는 것을 추천해요.' : '평균보다는 저렴한 편이에요.'}`,
    },
    {
      q: `${p.name} 역대 최저가는 얼마인가요?`,
      a: `셰어인포 기록 기준 역대 최저가는 ${won(p.lowestPrice)}${lowPoint && n >= 2 ? `(${kDate(lowPoint.observedAt)})` : ''}이고, 최고가는 ${won(p.highestPrice)}입니다.`,
    },
    {
      q: '가격은 얼마나 자주 업데이트되나요?',
      a: '쿠팡 가격을 확인할 때마다 기록하며, 같은 날 여러 번 확인해도 하루 한 건으로 남깁니다. 기록은 그래프와 가격 이력에 바로 반영돼요.',
    },
  ];

  const meta =
    `${p.name} 쿠팡 현재가 ${won(p.currentPrice)}, 역대 최저가 ${won(p.lowestPrice)}.` +
    (n >= 2 ? ` ${n}회 가격 기록으로 본 가격 변동 추이와 구매 타이밍을 확인하세요.` : ' 가격 변동 추이를 확인하세요.');

  return { paragraphs, faq, meta };
}
