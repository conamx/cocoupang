import { cookies } from 'next/headers';

// 비회원 식별용 익명 id (쿠키). 좋아요/알림 중복 방지에 사용.
export async function getAnonId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get('anon_id')?.value;
  if (existing) return existing;
  const id = crypto.randomUUID();
  try {
    jar.set('anon_id', id, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  } catch {
    // 읽기 전용 컨텍스트(RSC 렌더 중)에서는 설정 불가 — 그 경우 임시 id 반환
  }
  return id;
}
