'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

// 네이버 애널리틱스 — 발급 ID 는 환경변수(NEXT_PUBLIC_NAVER_WA)로 바꿀 수 있음
const WA = process.env.NEXT_PUBLIC_NAVER_WA || '12825def8303780';

type Wcs = { wcs_add?: Record<string, string>; wcs?: unknown; wcs_do?: () => void };

function track() {
  const w = window as unknown as Wcs;
  w.wcs_add = w.wcs_add || {};
  w.wcs_add.wa = WA;
  if (w.wcs && w.wcs_do) w.wcs_do();
}

/** 스크립트 로드 시 1회 + 사이트 안에서 페이지를 옮길 때마다 페이지뷰 전송 */
export function NaverAnalytics() {
  const pathname = usePathname();
  const search = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false; // 첫 페이지뷰는 스크립트 onLoad 에서 전송
      return;
    }
    track();
  }, [pathname, search]);

  if (!WA) return null;
  return <Script src="https://wcs.pstatic.net/wcslog.js" strategy="afterInteractive" onLoad={track} />;
}
