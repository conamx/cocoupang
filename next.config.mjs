/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 예전 ?cat= 주소 → 정적 카테고리 페이지 (엣지 리다이렉트라 함수 실행 없음)
  async redirects() {
    return [
      {
        source: '/coupang',
        has: [{ type: 'query', key: 'cat', value: '(?<cat>[a-z0-9]+)' }],
        destination: '/coupang/category/:cat',
        permanent: true,
      },
    ];
  },
  images: {
    // 외부 이미지(쿠팡 CDN, 커뮤니티 썸네일, 자체 CDN) 허용 도메인.
    remotePatterns: [
      { protocol: 'https', hostname: '**.coupangcdn.com' },
      { protocol: 'https', hostname: '**.ppomppu.co.kr' },
      { protocol: 'https', hostname: 'cdn.shareinfo.co.kr' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
