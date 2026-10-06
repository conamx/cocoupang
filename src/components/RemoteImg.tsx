'use client';

import { useState } from 'react';

/**
 * 외부(쿠팡·커뮤니티) 이미지 표시용.
 * - referrerPolicy=no-referrer: 다른 사이트에서 불러오면 막는(핫링크 차단) 이미지 서버 대응
 * - 로딩 실패 시 기본 이미지로 대체 (깨진 아이콘 대신)
 */
export function RemoteImg({
  src,
  alt,
  className,
  lazy = true,
}: {
  src: string;
  alt: string;
  className?: string;
  lazy?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={failed || !src ? '/placeholder.svg' : src}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
