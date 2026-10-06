import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

// 수집 스크립트가 끝난 뒤 호출 → 바뀐 페이지만 다시 만들도록 캐시 무효화.
// 페이지들은 평소엔 긴 ISR 주기로 캐시되어 Netlify 함수 실행(크레딧)을 최소화합니다.
// 인증: Authorization: Bearer ${CRON_SECRET}
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const scope = req.nextUrl.searchParams.get('scope');
  if (scope === 'deals') {
    revalidatePath('/');
    revalidatePath('/deal/[id]', 'page');
  } else {
    // 쿠팡 가격 갱신 → 상품·카테고리·홈·사이트맵 전부
    revalidatePath('/', 'layout');
  }
  return Response.json({ ok: true, scope: scope ?? 'all' });
}
