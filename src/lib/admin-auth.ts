import crypto from 'node:crypto';

// 관리자 인증: 요청 헤더 x-admin-key 가 환경변수 ADMIN_PASSWORD 와 같아야 함.
export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  const given = req.headers.get('x-admin-key') ?? '';
  if (!expected || !given) return false;
  const a = crypto.createHash('sha256').update(expected).digest();
  const b = crypto.createHash('sha256').update(given).digest();
  return crypto.timingSafeEqual(a, b);
}
