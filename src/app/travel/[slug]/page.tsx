import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';

// 할인코드 페이지는 실제 코드·제휴가 생길 때까지 닫아 둠 → 예전 주소는 홈으로
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function BrandPage() {
  permanentRedirect('/');
}
