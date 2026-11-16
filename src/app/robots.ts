import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

// 검색 유입이 없는데 페이지를 대량으로 긁어 가는 봇 (AI 학습용·SEO 분석 도구) → 막아서 넷리파이 사용량(크레딧) 절약.
// 구글·네이버(Yeti)·빙·다음 같은 검색엔진은 그대로 허용.
const HEAVY_BOTS = [
  'GPTBot',
  'CCBot',
  'ClaudeBot',
  'anthropic-ai',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'Applebot-Extended',
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'PetalBot',
  'DataForSeoBot',
  'Barkrowler',
  'BLEXBot',
  'serpstatbot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/search', '/api/', '/admin'] },
      { userAgent: HEAVY_BOTS, disallow: '/' },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
