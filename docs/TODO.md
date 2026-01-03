# TODO (Onnuri Inven)

원칙:
- 한 번에 한 페이지 또는 한 기능 슬라이스만 구현한다.
- 각 슬라이스는 로딩/에러/빈 상태까지 포함한다.
- 완료 시 수동 테스트 체크리스트를 남긴다.

---

## Phase 0: Foundation
- [ ] Next.js + Tailwind 기본 세팅 확인 (dev server OK)
- [ ] Supabase client 초기화 (env 사용)
- [ ] Global layout: background #F9F8F6
- [ ] UI primitives: TopBar, Button, Input, Card, Modal, Toast, Skeleton

## Phase 1: Auth
- [ ] /login 페이지 UI + 로그인 (Supabase Auth)
- [ ] route guard: 로그인 없으면 /login
- [ ] 프로필(active/role) 로딩 및 접근 제어

## Phase 2: Products List (Home)
- [ ] /products 페이지 라우팅 + TopBar
- [ ] ZoneFilter chips (냉동1/냉동2/냉장/상온)
- [ ] SearchInput: 토큰 AND + 구역 토큰 override
- [ ] Products list query + Card list
- [ ] URL query params로 상태 유지 (filter, q)
- [ ] EmptyState + Skeleton + ErrorState

## Phase 3: Product Detail (Core Write)
- [ ] /products/[id] 상세 조회
- [ ] 재고 표시 (큰 숫자)
- [ ] 입고/출고 버튼 + 모달(양수 입력)
- [ ] RPC adjust_stock 호출 + 성공/실패 토스트
- [ ] inventory_logs 최근 n개 표시
- [ ] 뒤로가기: 목록 상태 유지(URL)

## Phase 4: Create Product
- [ ] /products/new 등록 폼 (필수/선택 분리)
- [ ] 제품 생성 + inventory row 생성(stock=0)
- [ ] 초기 재고가 필요하면 adjust_stock(+n)로 처리
- [ ] 저장 후: 목록 이동 or 추가 등록

## Phase 5: Admin
- [ ] /admin 접근 제한(role=admin)
- [ ] 사용자 목록 + active 토글 + role 변경
- [ ] 로그 뷰(간단 필터)
