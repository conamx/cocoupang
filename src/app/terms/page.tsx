import type { Metadata } from 'next';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: '이용약관',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <article className="prose-body mx-auto max-w-2xl text-[15px] text-gray-800 dark:text-gray-200">
      <h1 className="text-2xl font-bold">이용약관</h1>
      <p>
        {site.name}(이하 &quot;서비스&quot;)는 국내 커뮤니티에 공유된 핫딜 정보와 공개된 상품 가격 정보를 모아
        제공합니다. 서비스는 상품의 판매 당사자가 아니며, 거래·배송·환불 등은 해당 판매처 정책을 따릅니다.
      </p>
      <h2>제휴 링크</h2>
      <p>{site.partnersDisclosure}</p>
      <h2>정보의 정확성</h2>
      <p>
        가격·재고·프로모션 정보는 수집 시점 기준이며 실시간과 다를 수 있습니다. 최종 가격은 반드시 판매처에서
        확인하시기 바랍니다.
      </p>
    </article>
  );
}
