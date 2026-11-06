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
    // 쿠팡 가격 갱신 → 홈·목록·사이트맵만 바로 새로 만듦.
    // 상품·품목 페이지는 수가 많아(수천~수만) 한꺼번에 비우면 첫 방문·검색 봇이 매번 서버를 기다리고
    // Netlify 사용량이 크게 늘어남 → 각 페이지의 revalidate 주기(12시간)마다
    // '저장된 페이지를 바로 보여주고 뒤에서 새로 만드는' 방식으로 갱신.
    revalidatePath('/');
    revalidatePath('/coupang');
    revalidatePath('/coupang/category');
    revalidatePath('/coupang/category/[cat]', 'page');
    revalidatePath('/coupang/category/[cat]/[page]', 'page');
    revalidatePath('/sitemap.xml');
  }
  return Response.json({ ok: true, scope: scope ?? 'all' });
}
