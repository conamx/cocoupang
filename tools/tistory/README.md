# 티스토리 자동 발행 매크로 (+ 쿠팡 상품 연동)

PC(윈도우)에서 실행하는 데스크톱 프로그램입니다. 사이트 빌드와는 무관합니다.

```bash
pip install requests beautifulsoup4 pillow numpy undetected-chromedriver selenium
python tistory_macro.py
```

## 쿠팡 상품 연동
⚙ 설정 → "셰어인포 사이트 · 쿠팡 상품 연동"
- 사이트 주소: 관리자 API 가 있는 배포 주소 (예: `https://cococoupa.netlify.app`)
- 사이트 관리자 비밀번호: Netlify 환경변수 `ADMIN_PASSWORD`
- 글에 넣을 사이트 링크 주소: 비우면 사이트 주소. 도메인 연결 후 바꾸면 이후 글부터 새 주소로

참고글 선택 화면 아래에서
- 키워드와 관련된 사이트 등록 상품을 체크 → 글에 상품 카드로 삽입
- 새 상품을 붙여넣으면(파트너스 HTML / `링크 ⇥ 상품명 ⇥ 가격 ⇥ 이미지주소`) 사이트에도 자동 등록

글 맨 위에는 쿠팡 파트너스 고지 문구가 자동으로 들어갑니다(필수).
