import type { Metadata } from 'next';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <article className="prose-body mx-auto max-w-2xl text-[15px] text-gray-800 dark:text-gray-200">
      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      <p>
        {site.name}는 회원가입 없이 이용할 수 있으며, 서비스 개선을 위한 접속 통계(Google Analytics 등)를 수집할
        수 있습니다.
      </p>
      <h2>수집 항목</h2>
      <p>가격 알림 등 선택 기능 이용 시 이메일 등 최소한의 정보만 수집하며, 목적 달성 후 파기합니다.</p>
      <h2>제3자 제공 / 쿠키</h2>
      <p>
        광고·분석·제휴(쿠팡 파트너스 등) 목적의 쿠키가 사용될 수 있습니다. 브라우저 설정에서 쿠키를 거부할 수
        있습니다.
      </p>
    </article>
  );
}
