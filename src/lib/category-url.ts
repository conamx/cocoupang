/** 카테고리 목록 한 쪽에 보여 줄 상품 수 */
export const PER_PAGE = 60;
/** 1쪽: /coupang/category/{id}, 2쪽부터: /coupang/category/{id}/{n} */
export const categoryPath = (id: string, page = 1) => (page > 1 ? `/coupang/category/${id}/${page}` : `/coupang/category/${id}`);
