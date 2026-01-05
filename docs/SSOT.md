# 온누리 재고조사 시스템 SSOT (Single Source of Truth)
버전: v1.3  
최종 업데이트: 2026-01-05 KST

이 문서는 **온누리 재고조사 시스템(onnuri-inven)**의 “현재 확정된 사실”만 모아둔 기준 문서입니다.  
새 기능을 논의하거나 구현을 진행할 때는 **SSOT를 먼저 갱신한 뒤** 작업합니다.

---

## 0. 프로젝트 원칙

### 0.1 목표
- 사내 전용 **모바일 현장 재고조사 웹앱**
- 동선 최적화: **검색/필터 → 목록 → 상세 → 입고/출고 → 목록 복귀**

### 0.2 최우선 가드레일
- **단순/견고/버그면적 최소화**
- 목록 상태는 **URL query 기반으로만 유지** (localStorage 금지)
- 재고 변경은 **RPC `adjust_stock`만** (직접 `inventory.stock` 업데이트 금지)
- “삭제” 대신 **비활성(Archived)** 중심 운영 (완전삭제는 예외적으로 admin만)

---

## 1. 현재 구현 완료 범위 (기능 스냅샷)

### 1.1 Phase2: 제품 목록 `/products`
- SSOT 규칙 준수한 목록 UX로 재구축 완료
  - **IME-safe 검색**(한글 조합 깨짐 방지)
  - `q`가 있으면 **zone 필터 무시**
  - **All(전체) chip** 제공
  - **AND 검색**(쉼표/공백 토큰)
  - 재고 표시, 카드 가독성 개선
  - 썸네일 슬롯 유지
  - 유통기한 배지 + 임박 기준 반영

### 1.2 Phase3: 제품 상세 `/products/[id]`
- 상세 페이지 구축 및 운영 액션 제공
  - 입고/출고: **RPC `adjust_stock`**
  - 비활성화: **RPC `archive_product`**, 사유 필수
  - 제품 정보 수정
  - 로그/재고 표시
  - UI 카드 레이아웃 개선
  - (예정) 사진 업로드/교체/삭제

### 1.3 Archived flow: `/products/archived`
- 비활성 목록 + 복구/삭제 흐름 구현
  - 복구: **RPC `restore_product`**
  - 완전삭제: **RPC `delete_product` (admin-only)**

### 1.4 제품 등록: `/products/new`
- 등록 페이지 구현
- 사진 URL 입력란 제거 (현 업무상 불필요)
- 사진 촬영/파일 선택 업로드 지원 (1장, `products.photo_url` 저장)

### 1.5 설정: `/settings`
- 임박 기준값 `expiry_warning_days` 관리
  - admin만 저장 가능
  - staff는 읽기 전용
  - DB: `app_settings` + RPC `get/set`
  - fallback=100

### 1.6 네비게이션
- `/products` 상단 헤더에 “설정” 진입 버튼 추가 완료 (PR #16 머지)

---

## 2. UX 규칙 (필수)

### 2.1 목록: Zone vs Search 우선순위
- `q`가 비어 있을 때만 zone 필터 적용
- `q`가 존재하면 zone 필터는 **무시**, 전체 active 제품에서 검색
- zone 키워드를 `q`에서 해석하는 예외 로직은 두지 않음

### 2.2 목록 상태 저장
- `zone`, `q`는 URL query params로만 유지
- localStorage 기반 저장 금지

### 2.3 IME(한글 입력) 안정성
- 매 키 입력마다 `router.replace`로 URL 갱신 금지
- 조합 중(`compositionstart` ~ `compositionend`) 네비게이션성 업데이트 금지
- 반영은 `compositionend` 또는 debounce(~300ms)

### 2.4 재고 조정 UX (상세)
- 버튼: **입고 / 출고**
- 버튼 탭 → **양수 정수 입력 모달**
- 내부 로직: 입고 `+qty`, 출고 `-qty`
- 0 미만 금지는 서버가 강제하며, 클라이언트는 짧은 오류 메시지

### 2.5 비활성(Archived) 정책
- 기본 운영은 비활성 중심
- 비활성 시 사유 필수
- 완전삭제는 **비활성 목록에서만**, **admin만**

### 2.6 의도적으로 제외한 항목
- 스크롤 위치 복원 ❌
- 상세에서 다음/이전 이동 ❌
- 바코드 시스템 ❌
- 속성 변경 이력 ❌ (재고 변화 로그만)

---

## 3. 백엔드(확정): Supabase

### 3.1 핵심 테이블
- `zones`
- `products`
- `inventory`
- `inventory_logs`
- `users_profile`
- `app_settings` (expiry_warning_days)

### 3.2 접근 원칙 (RLS + RPC)
- 읽기: authenticated + active user만
- 쓰기:
  - 재고 변경: `adjust_stock` RPC만
  - 설정 저장: admin-only RPC만 권장
  - 제품 비활성/복구/삭제: RLS+RPC로 통제

### 3.3 사진(Storage) 정책 (확정)
- 제품당 사진 1장(대표 썸네일)만 지원
- 모바일 전용 UX:
  - 사진 영역 탭 → 카메라 촬영(또는 파일 선택) → 저장(업로드) → 목록/상세에 즉시 반영
- 업로드 권한: staff + admin 모두
- Storage:
  - 버킷: `product-photos`
  - 읽기: public read 허용(리스크 수용)
  - 쓰기(업로드/교체/삭제): authenticated + active user만(RLS)
- DB:
  - 컬럼: `products.photo_url` 사용(기존 유지)
  - 저장값: **Storage object path를 우선 사용**
    - 예: `products/<product_id>/<uuid>.jpg`
  - 호환성:
    - 값이 `http`로 시작하면 “이미 URL”로 간주하고 그대로 렌더링 가능(레거시/예외 허용)
- 교체/삭제:
  - 교체: 신규 업로드 → `photo_url` 업데이트 → (best-effort) 이전 파일 삭제
  - 삭제: Storage 파일 삭제 + `photo_url = null`

---




### 5.2 사진(Storage) 구현 전제 조건(사전 점검)
- Supabase Storage 버킷 `product-photos` 생성(public)
- `storage.objects` RLS 정책 적용(업로드/삭제/수정은 active user만)
- `public.is_active_user()` 함수는 **SECURITY DEFINER**로 운영(권장)

### 5.3 다음 슬라이스 후보(1개만 선택)
- `/settings` UX 마감
- (우선순위 상향 가능) 사진 업로드(Storage)

---

## 6. 슬라이스 규칙(반드시 준수)
- “한 번에 한 슬라이스”
- 최소 파일 변경
- `npm run lint` 통과
- inventory 직접 업데이트 금지
- localStorage 금지

/settings: Admin-only User Management(목록/활성토글/이름변경)

“DB patches are tracked under db/patches and must be applied in Supabase SQL Editor”