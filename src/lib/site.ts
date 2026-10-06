export const site = {
  name: '셰어인포',
  nameEn: 'ShareInfo',
  // 운영 도메인. 환경변수로 덮어쓸 수 있습니다.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shareinfo.co.kr',
  description:
    '뽐뿌·펨코 등 국내 커뮤니티 핫딜과 쿠팡 최저가·가격 변동 추이를 한곳에서 모아보는 정보 서비스.',
  // 쿠팡 파트너스 필수 고지 문구 (법적 의무)
  partnersDisclosure:
    '셰어인포는 쿠팡 파트너스 활동의 일환으로 이에 따른 일정액의 수수료를 제공받으며, 그 외 일부 링크도 제휴 링크로 구매 시 수수료를 받을 수 있습니다 (구매 가격에는 영향이 없습니다).',
  nav: [
    { href: '/', label: '홈' },
    { href: '/coupang', label: '특가·최저가' },
    { href: '/deal', label: '핫딜모음' },
    { href: '/travel', label: '할인코드' },
    { href: '/blog', label: '정보' },
  ],
} as const;

// 쿠팡 카테고리 — id 는 파트너스 API 베스트 카테고리 번호와 동일 (딜바고 구조 참고)
// 카테고리를 늘릴수록 매일 수집되는 상품(=검색 노출용 페이지)이 늘어납니다.
export const coupangCategories: { id: string; label: string }[] = [
  { id: '1012', label: '식품' },
  { id: '1013', label: '주방용품' },
  { id: '1014', label: '생활용품' },
  { id: '1010', label: '뷰티' },
  { id: '1011', label: '출산/유아동' },
  { id: '1016', label: '가전디지털' },
  { id: '1015', label: '홈인테리어' },
  { id: '1017', label: '스포츠/레저' },
  { id: '1024', label: '헬스/건강식품' },
  { id: '1029', label: '반려동물용품' },
  { id: '1018', label: '자동차용품' },
  { id: '1020', label: '완구/취미' },
  { id: '1021', label: '문구/오피스' },
  { id: '1001', label: '여성패션' },
  { id: '1002', label: '남성패션' },
];

// 카테고리 매칭이 안 되는 상품(골드박스·검색 결과 일부)이 들어가는 곳
export const etcCategory = { id: 'etc', label: '기타' };
