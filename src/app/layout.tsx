import type { Metadata, Viewport } from 'next';
import './globals.css';
import { site } from '@/lib/site';
import { ThemeScript } from '@/components/ThemeScript';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileTabBar } from '@/components/MobileTabBar';
import { Analytics } from '@/components/Analytics';
import { NaverAnalytics } from '@/components/NaverAnalytics';
import { Suspense } from 'react';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — 쿠팡 최저가·가격 변동 조회`,
    template: `%s - ${site.name}`,
  },
  description: site.description,
  // 대표 주소(canonical)는 페이지마다 따로 지정 — 여기 두면 하위 페이지가 전부 홈을 대표 주소로 물려받음
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: 'ko_KR',
    url: site.url,
    title: `${site.name} — 쿠팡 최저가·가격 변동 조회`,
    description: site.description,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: site.name }],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
  robots: { index: true, follow: true },
  // 구글 서치콘솔·네이버 서치어드바이저 소유확인 — 발급받은 코드를 아래에 넣거나 Netlify 환경변수로 설정
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: {
      'naver-site-verification': process.env.NAVER_SITE_VERIFICATION || '52473b37f785d8e1f23fe9031f494dbe13bdffe7',
    },
  },
};

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', name: site.name, url: site.url, description: site.description },
    {
      '@type': 'WebSite',
      name: site.name,
      url: site.url,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${site.url}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning className="h-full">
      <head>
        <ThemeScript />
        <Analytics />
        <link rel="alternate" type="application/rss+xml" title={site.name} href={`${site.url}/feed.xml`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      </head>
      <body className="flex min-h-full flex-col bg-gray-50 text-gray-900 dark:bg-black dark:text-gray-100">
        <SiteHeader />
        <main className="mx-auto w-full max-w-content flex-1 px-4 pb-24 pt-5 sm:pb-8">{children}</main>
        <SiteFooter />
        <div className="h-[calc(3.75rem+env(safe-area-inset-bottom))] sm:hidden" aria-hidden />
        <MobileTabBar />
        <Suspense fallback={null}>
          <NaverAnalytics />
        </Suspense>
      </body>
    </html>
  );
}
