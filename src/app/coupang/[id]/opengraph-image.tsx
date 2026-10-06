import { ImageResponse } from 'next/og';
import { getProduct } from '@/lib/data';
import { won } from '@/lib/format';
import { site } from '@/lib/site';

export const alt = '상품 최저가';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProduct(id);
  const title = p?.name ?? site.name;
  const low = p ? won(p.lowestPrice) : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0b1220',
          color: '#fff',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 34, fontWeight: 800 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#2563eb' }} />
          share<span style={{ color: '#60a5fa' }}>info</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.2, maxWidth: 1000 }}>{title}</div>
          {low && (
            <div style={{ fontSize: 40, color: '#34d399', fontWeight: 700 }}>역대 최저가 {low}</div>
          )}
        </div>
        <div style={{ fontSize: 28, color: '#94a3b8' }}>가격 변동 추이 · 최저가 확인</div>
      </div>
    ),
    size,
  );
}
