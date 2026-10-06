/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
