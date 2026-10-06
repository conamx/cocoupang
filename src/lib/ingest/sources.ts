import type { SourceAdapter } from './types';
import { createRssAdapter } from './rss-adapter';

/**
 * 수집 소스 레지스트리.
 *
 * 새 커뮤니티 추가 = 여기에 설정 한 줄.
 * 피드 URL은 각 사이트 정책에 따라 바뀔 수 있으니, enabled=false 인 소스는
 * 운영 전 실제 RSS 주소를 확인하고 켜세요. (이 컨테이너에선 외부 접근이 막혀 검증 불가)
 */
type Entry = { enabled: boolean; adapter: SourceAdapter };

const entries: Entry[] = [
  {
    enabled: true,
    adapter: createRssAdapter({
      name: '뽐뿌',
      feedUrl: 'https://www.ppomppu.co.kr/rss.php?id=ppomppu',
    }),
  },
  {
    // 에펨코리아 포인트/핫딜 게시판 RSS — 운영 전 주소 확인 후 enabled=true
    enabled: false,
    adapter: createRssAdapter({
      name: '펨코',
      feedUrl: 'https://www.fmkorea.com/rss',
    }),
  },
  {
    // 루리웹 핫딜 게시판 RSS — 운영 전 주소 확인 후 enabled=true
    enabled: false,
    adapter: createRssAdapter({
      name: '루리웹',
      feedUrl: 'https://bbs.ruliweb.com/market/board/1020/rss',
    }),
  },
];

export const sourceAdapters: SourceAdapter[] = entries.filter((e) => e.enabled).map((e) => e.adapter);
