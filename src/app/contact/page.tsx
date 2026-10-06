import type { Metadata } from 'next';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: '문의하기',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <article className="prose-body mx-auto max-w-2xl text-[15px] text-gray-800 dark:text-gray-200">
      <h1 className="text-2xl font-bold">문의하기</h1>
      <p>제휴·광고·오류 제보 등 문의는 아래 이메일로 보내주세요.</p>
      <p className="mt-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        이메일:{' '}
        <a href="mailto:contact@shareinfo.co.kr" className="font-semibold text-blue-600 hover:underline">
          contact@shareinfo.co.kr
        </a>
      </p>
      <h2>딜/가격 정보 정정 요청</h2>
      <p>
        {site.name}는 공개된 정보를 모아 제공합니다. 잘못된 가격·품절·주소 변경 등은 해당 상품 링크와 함께
        제보해 주시면 빠르게 반영하겠습니다.
      </p>
    </article>
  );
}
