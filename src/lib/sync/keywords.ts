/**
 * 검색 노출을 노리는 키워드 목록 (쿠팡 검색 API로 매일 상품 수집).
 *
 * "OOO 최저가" 로 많이 검색되는 생필품·반복구매 상품 위주로 넣으세요.
 * 검색 API는 시간당 호출 제한이 있어서, 하루에 COUPANG_SEARCH_PER_RUN 개(기본 10)씩
 * 순서대로 돌아가며 수집합니다. 키워드가 30개면 3일에 한 바퀴.
 *
 * categoryId 는 src/lib/site.ts 의 coupangCategories 중 하나.
 */
export const searchKeywords: { keyword: string; categoryId: string }[] = [
  { keyword: '생수 2L', categoryId: '1012' },
  { keyword: '햇반', categoryId: '1012' },
  { keyword: '컵라면', categoryId: '1012' },
  { keyword: '닭가슴살', categoryId: '1012' },
  { keyword: '커피믹스', categoryId: '1012' },
  { keyword: '캡슐커피', categoryId: '1012' },
  { keyword: '두루마리 휴지', categoryId: '1014' },
  { keyword: '물티슈', categoryId: '1014' },
  { keyword: '세탁세제', categoryId: '1014' },
  { keyword: '섬유유연제', categoryId: '1014' },
  { keyword: '주방세제', categoryId: '1013' },
  { keyword: '샴푸', categoryId: '1010' },
  { keyword: '치약', categoryId: '1014' },
  { keyword: '기저귀', categoryId: '1011' },
  { keyword: '분유', categoryId: '1011' },
  { keyword: '유산균', categoryId: '1024' },
  { keyword: '종합비타민', categoryId: '1024' },
  { keyword: '오메가3', categoryId: '1024' },
  { keyword: '단백질 쉐이크', categoryId: '1024' },
  { keyword: '강아지 사료', categoryId: '1029' },
  { keyword: '고양이 모래', categoryId: '1029' },
  { keyword: '고양이 사료', categoryId: '1029' },
  { keyword: '무선 이어폰', categoryId: '1016' },
  { keyword: '로봇청소기', categoryId: '1016' },
  { keyword: '에어프라이어', categoryId: '1016' },
  { keyword: '건전지', categoryId: '1016' },
  { keyword: '선크림', categoryId: '1010' },
  { keyword: '마스크팩', categoryId: '1010' },
  { keyword: '차량용 방향제', categoryId: '1018' },
  { keyword: 'A4 용지', categoryId: '1021' },
];
