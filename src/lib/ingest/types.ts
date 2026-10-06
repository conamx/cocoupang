// 커뮤니티 핫딜 수집기 공통 타입.

export type RawDeal = {
  sourceId: string; // 어댑터가 부여하는 원문 고유 id (중복 제거 키의 일부)
  source: string; // 뽐뿌 / 펨코 / 루리웹
  title: string;
  url: string;
  category: string;
  price?: string;
  thumb?: string;
  postedAt: string; // ISO
};

export interface SourceAdapter {
  name: string;
  /** 외부 소스에서 최신 딜 목록을 가져와 RawDeal[] 로 정규화 */
  fetchDeals(): Promise<RawDeal[]>;
}
