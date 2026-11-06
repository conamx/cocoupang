/**
 * IndexNow — 새로 생기거나 바뀐 페이지 주소를 네이버·빙에 바로 알림 (무료).
 * 네이버 서치어드바이저가 지원하는 방식. 키 파일: public/30eb43f6ff74a90b4f5fa76cc8ff7ea3.txt (사이트에 올라가 있어야 인정됨)
 */
export const INDEXNOW_KEY = '30eb43f6ff74a90b4f5fa76cc8ff7ea3';

const ENDPOINTS = ['https://searchadvisor.naver.com/indexnow', 'https://api.indexnow.org/indexnow'];

export async function submitIndexNow(paths: string[]): Promise<string> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site || paths.length === 0) return 'skip';
  const host = new URL(site).host;
  // 한글 주소는 인코딩해서 전송, 한 번에 최대 10,000개
  const urlList = [...new Set(paths)].slice(0, 10_000).map((p) => encodeURI(`${site}${p}`));
  const body = JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${site}/${INDEXNOW_KEY}.txt`, urlList });
  const out: string[] = [];
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body });
      out.push(`${new URL(url).host} ${res.status}`);
    } catch (e) {
      out.push(`${new URL(url).host} 실패 ${(e as Error).message}`);
    }
  }
  return `${urlList.length}개 → ${out.join(', ')}`;
}
