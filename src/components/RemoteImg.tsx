'use client';

import { useState } from 'react';
import { bannerCropStyle, coupangThumb } from '@/lib/image';

/**
 * 외부(쿠팡·커뮤니티) 이미지 표시용.
 * - 쿠팡 이미지는 크기에 맞는 썸네일을 씀 (원본보다 10배 가벼움) → 썸네일이 실패하면 원본 → 그래도 실패하면 기본 이미지
 * - referrerPolicy=no-referrer: 다른 사이트에서 불러오면 막는(핫링크 차단) 이미지 서버 대응
 * - 쿠팡 파트너스 배너 이미지는 로고·상품명을 빼고 상품 사진 부분만 보이게
 */
export function RemoteImg({
  src,
  alt,
  className,
  lazy = true,
  size = 320,
}: {
  src: string;
  alt: string;
  className?: string;
  lazy?: boolean;
  size?: 230 | 320 | 492;
}) {
  const thumb = coupangThumb(src, size);
  // 0: 썸네일, 1: 원본, 2: 기본 이미지
  const [step, setStep] = useState(!src ? 2 : thumb === src ? 1 : 0);
  const url = step === 0 ? thumb : step === 1 ? src : '/placeholder.svg';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setStep((s) => Math.min(2, s + 1))}
      className={className}
      style={step === 2 ? undefined : bannerCropStyle(src)}
    />
  );
}
