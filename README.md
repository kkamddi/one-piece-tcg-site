# One Piece TCG Card Archive

원피스 TCG 카드 도감 웹사이트.

## 포함 기능
- 좌측 시리즈 목록 사이드바
- 우측 카드 목록
- 등급별 그룹핑
- 카드 상세 모달
- 카드명/번호 검색
- 내부 API(`/api/cards`) 기반 데이터 조회
- 카드 시세는 현재 `준비 중` 표시

## 데이터 구조
- `src/data/cards.json`: 프론트엔드/내부 API 공용 카드 데이터
- `src/data/series.json`: 시리즈 메타 정보
- `src/api/cards.js`: 프론트엔드 API 클라이언트
- `api/cards/*`: Vercel 서버리스 API
- `scripts/syncOfficialCards.js`: 공식 사이트 동기화 스캐폴드

## API 예시
- `GET /api/cards`
- `GET /api/cards?series=OP12`
- `GET /api/cards?series=OP12&rarity=SEC`
- `GET /api/cards/search?q=OP12-118`
- `GET /api/cards/OP12-118`

## 개발
```bash
npm install
npm run dev
```

## 빌드
```bash
npm run build
```

## 공식 카드 동기화 스캐폴드
```bash
npm run sync:cards
```

주의:
- 공식 사이트 이용약관/robots 정책 확인 필요
- 요청 간 delay 필요
- 이미지 직접 저장보다 URL 참조 우선
- 상세 모달에 공식 출처 링크 표시

## 배포
- GitHub 저장소: `kkamddi/one-piece-tcg-site`
- Vercel에서 별도 신규 프로젝트로 연결해서 기존 배포와 분리 가능

## 커뮤니티 공용 저장 (Supabase)
- Vercel 환경변수
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_COMMUNITY_TABLE` (선택, 기본값 `community_posts`)
- 테이블 생성 SQL: `docs/community-supabase.sql`
- 환경변수가 없으면 로컬/개발용 파일 저장(`data/community-posts.json`) fallback 사용
