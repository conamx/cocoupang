import type { Metadata, Viewport } from 'next';
import './globals.css';
import { site } from '@/lib/site';
import { ThemeScript } from '@/components/ThemeScript';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileTabBar } from '@/components/MobileTabBar';
import { Analytics } from '@/components/Analytics';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — 핫딜·쿠팡 최저가 모아보기`,
    template: `%s - ${site.name}`,
  },
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: 'ko_KR',
    url: site.url,
    title: `${site.name} — 핫딜·쿠팡 최저가 모아보기`,
    description: site.description,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  // 운영 시 서치콘솔/서치어드바이저에서 발급받은 값으로 교체하세요.
  verification: {
    google: '',
    other: { 'naver-site-verification': '' },
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      </head>
      <body className="flex min-h-full flex-col bg-gray-50 text-gray-900 dark:bg-black dark:text-gray-100">
        <SiteHeader />
        <main className="mx-auto w-full max-w-content flex-1 px-4 pb-24 pt-5 sm:pb-8">{children}</main>
        <SiteFooter />
        <div className="h-[calc(3.75rem+env(safe-area-inset-bottom))] sm:hidden" aria-hidden />
        <MobileTabBar />
      </body>
    </html>
  );
}
