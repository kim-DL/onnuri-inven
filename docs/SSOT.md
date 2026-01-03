# 온누리 재고조사 시스템 SSOT (Single Source of Truth)
버전: v1.1 (Supabase/RLS+E2E 테스트 반영)  
최종 업데이트: 2026-01-03 22:57 KST

이 문서는 **온누리 재고조사 시스템**의 “현재 확정된 사실”만 모아둔 기준 문서입니다.  
새 대화창(패널)에서 작업을 이어갈 때, 이 문서가 **유일한 기준**이 됩니다.

---

## 0. 프로젝트 원칙

### 0.1 목표
- 사내 전용 **모바일 재고조사 웹앱** (현장 조사/수정이 빠르고 실수에 강한 도구)

### 0.2 우선순위
- 현장 효율 > 기능 욕심 > 보안(최소 요건은 지킴)

### 0.3 전략
- 가볍게, 버그 표면적 최소화
- “삭제” 대신 **비활성(Archived)** 중심 운영

### 0.4 운영 환경 가정
- 구역(냉동1/냉동2/냉장/상온) 단위로 담당자가 조사
- 동시 수정 확률은 낮음(충돌 방지 기본은 갖추되, 과도한 동시편집 기능은 제외)

---

## A. 데이터 / 분류 (확정)

### A-1 구역(Zone)
- 상단 필터 버튼: **전체 / 냉동1 / 냉동2 / 냉장 / 상온**
- UI에서는 “카테고리” 대신 **구역(zone)** 개념을 사용

### A-2 제품 기본 정보(필드)
- 필수: 제품명, 구역(zone), 수량
- 권장(가능하면 입력): 제조사
- 선택: 단위/규격, 유통기한, 사진, 원산지(학교급식 특성상 중요)

---

## B. 사용자 / 권한 (확정)

### B-1 역할
- 직원(Staff): 현장 실무 전권  
  - 제품 등록/수정/비활성/복구, 재고 조정, 엑셀 다운로드 가능
- 관리자(Admin): 운영자  
  - 계정 생성/비활성, 설정, 로그 확인
  - **완전 삭제는 관리자만**

### B-2 비활성(Archived) 정책
- “삭제” 대신 **비활성(archived)** 기본
- 비활성은 직원도 가능
- 비활성 시 **사유 입력 필수**
- 비활성 목록은 직원도 열람/관리 가능
- **완전 삭제는 비활성 목록에서만** + 관리자만

---

## C. 화면 / 흐름 (확정)

### C-1 화면 구성
- 로그인
- 제품목록(홈)
- 제품등록
- 제품상세
- 관리/설정(계정/기준값/로그)

### C-2 현장 핵심 동선
- 검색/필터 → 목록 → 제품 클릭 → 상세 → 입고/출고 → 목록 복귀
- 복귀 시 **필터 + 검색 상태 유지**, **스크롤 복원은 제외**

---

## D. 검색 설계 (확정)

### D-1 기본 검색
- 대상: 제품명 / 제조사 / 원산지(입력된 경우)
- 방식: 부분 포함 + 다중 키워드 AND 토큰
  - 예: “하림 돈까스” → “하림” AND “돈까스” 포함

### D-2 구역 + 키워드 복합 검색
- 예: “냉동2 돈까스”
- 토큰 중 구역명이 포함되면 **그 구역이 우선 적용**
- 버튼 필터 상태와 충돌 시 **검색이 필터를 덮어씀(override)**

### D-3 제조사 표기 흔들림 대응
- 포함 검색으로 누락 최소화
- (선택) 입력 UX: 제조사 자동완성(추천 목록) 고려

---

## E. 제품등록 (확정)
- 필수: 제품명 / 구역 / 수량
- 선택: 사진 / 유통기한 / 제조사 / 단위 / 규격 / 원산지
- 저장 후: “추가 등록하기” 또는 “목록으로 이동”

---

## F. 제품상세 (확정)

### F-1 재고 수량 조정 UX (확정)
- 상세에서 **입고 / 출고** 두 버튼 제공
- 버튼을 누르면 **숫자 입력(양수) 모달** 오픈
- 내부 로직:
  - 입고: `delta = +수량`
  - 출고: `delta = -수량`
- 안전장치:
  - 출고로 인해 0 미만 금지(서버에서 강제)

> 참고: “+1/-1 버튼으로 재고 변경”은 테스트용 UI에서만 존재할 수 있으나, 정식 UX는 위 방식으로 고정.

### F-2 사진
- 사진 영역 탭 → 카메라 촬영 → 자동 반영(가능하면)
- 저장: Storage + DB에는 URL

### F-3 이력
- **입고/출고 수량 변화만 기록**
- 이력에는 **날짜/시간(created_at, timestamptz)** 포함 (DB에서 자동 기록)
- 속성 변경(제품명/제조사 등) 이력은 현 단계 제외

### F-4 수정/비활성
- 직원도 가능
- 비활성 사유 필수

---

## G. 엑셀 다운로드 (확정)
- 위치: 햄버거/마이 메뉴
- 기본: 현재 필터/검색 결과 다운로드
- 옵션: 전체 다운로드(보조)
- 컬럼: 제품명/제조사/유통기한/수량/구역(+ 필요시 원산지)

---

## H. 의도적으로 제외한 항목 (확정)
- 스크롤 위치 복원 ❌
- 상세에서 다음/이전 이동 ❌
- 바코드 시스템 ❌
- 속성 변경 이력(수정 로그) ❌
- 과도한 권한 단계 분리 ❌ (Admin/Staff로 충분)

---

# I. 백엔드(확정): Supabase

## I-1 채택 구성
- DB/인증/정책: Supabase(Postgres + Auth + RLS)
- 자체 서버 운영은 대안이 아님
- 프로젝트: **onnuri inven** (Supabase Console에서 생성)

## I-2 Auth 운영 모델(확정)
- 로그인은 Supabase Auth 사용
- 관리자가 직원 계정을 만들어 부여하는 방식과 충돌 없음
- 테스트 계정(예시): `admin@onnuri.local`, `staff@onnuri.local`  
  - 실제 운영 계정/도메인은 내부 정책에 맞게 조정

## I-3 API 키(중요)
- 콘솔에 “anon key”라고 표시되지 않을 수 있음(UI 변화)
- 브라우저/클라이언트에서 사용하는 키는:
  - **Publishable key** (클라이언트용)
- 서버에서만 사용하는 키:
  - **Secret key** (절대 프론트에 노출 금지)

---

# J. DB 스키마(현재 구현 기준)

> 테이블: `zones / products / inventory / inventory_logs / users_profile`

### J-1 zones
- id (uuid, pk)
- name (text) — 예: 냉동1/냉동2/냉장/상온
- sort_order (int)
- active (bool)
- created_at (timestamptz)

### J-2 products
- id (uuid, pk)
- name (text, not null)
- zone_id (uuid, fk → zones.id)
- manufacturer (text, nullable)
- unit (text, nullable)
- spec (text, nullable)
- origin_country (text, nullable)
- expiry_date (date, nullable)
- photo_url (text, nullable)
- active (bool, default true)
- archived_reason (text, nullable)
- archived_at (timestamptz, nullable)
- archived_by (uuid, nullable)
- created_at, created_by (timestamptz/uuid)
- updated_at, updated_by (timestamptz/uuid)

### J-3 inventory
- product_id (uuid, pk, fk → products.id)
- stock (int, not null)
- updated_at (timestamptz)
- updated_by (uuid)

### J-4 inventory_logs
- id (uuid, pk)
- product_id (uuid, fk → products.id)
- zone_id (uuid, nullable)
- delta (int, not null)
- before_stock (int, not null)
- after_stock (int, not null)
- created_at (timestamptz, not null)
- created_by (uuid, nullable)
- note (text, nullable)

### J-5 users_profile
- user_id (uuid, pk, fk → auth.users.id)
- role (text: 'admin' | 'staff')
- active (bool, default true)
- display_name (text, nullable)
- created_at (timestamptz)

---

# K. 재고 조정 저장 규칙(서버 강제, 확정)

## K-1 RPC 함수: `public.adjust_stock(...)` (확정)
- 시그니처:
  - `p_product_id uuid`
  - `p_delta integer` (입고 + / 출고 -)
  - `p_note text default null`
- 동작:
  1) 로그인(auth.uid) 체크
  2) 활성 사용자(public.is_active_user) 체크
  3) inventory row를 `FOR UPDATE`로 잠금 후 before/after 계산
  4) after < 0 이면 에러
  5) inventory 업데이트 + inventory_logs insert
  6) before/after/delta/created_at 반환
- 구현 상태:
  - `SECURITY DEFINER`로 동작(권장), RLS와 충돌 없이 작동 확인
  - 과거 발생한 문제(수정 완료):
    - `"product_id" is ambiguous` → 쿼리에서 컬럼/파라미터를 명확히 분리(qualified)하여 해결

---

# L. 권한 정책(RLS) 방향(현재 적용 + 테스트 통과)

## L-1 목표
- 로그인 사용자만 데이터 접근
- inactive 사용자 차단
- admin/staff 역할에 따라 관리 권한 분리
- 재고 변경은 반드시 RPC 경유(서버에서 검증)

## L-2 현재 확인된 동작(테스트 통과)
- admin 로그인:
  - products/inventory 로드 가능
  - `adjust_stock` 가능
  - inventory_logs 기록 정상
- staff 로그인:
  - products/inventory 로드 가능(정상)
  - `adjust_stock` 가능(정상)
  - inventory_logs 기록 정상

## L-3 재귀/스택오버플로우 회피 원칙(중요)
- `users_profile` 테이블의 RLS가 **is_active_user 같은 함수 호출로 자기 자신을 다시 조회**하면
  - `stack depth limit exceeded` 같은 재귀 문제가 날 수 있음
- 원칙:
  - `users_profile`의 “자기 자신의 row 조회”는 **auth.uid()=user_id 직접 조건**으로 해결
  - is_active_user 내부 조회가 동작하도록 정책을 설계(재귀 유발 금지)

---

# M. 사진(Storage) 정책 (확정)
- Storage bucket 사용
- DB에는 `photo_url`만 저장
- 업로드/읽기 권한은 로그인 사용자 기준으로 시작(필요시 세분화)

---

# N. E2E(최종) 테스트 결과 (확정)

## N-1 Next.js 미니 테스트 앱으로 검증 완료
- 로그인/로그아웃 정상
- admin/staff 모두 products+inventory 로드 성공
- admin/staff 모두 `adjust_stock` RPC 성공
- inventory.stock 및 inventory_logs 기록 정상(시간 포함)

## N-2 테스트 페이지에서 발견/해결된 대표 이슈
- `"product_id" is ambiguous` → adjust_stock 내부 쿼리 정리로 해결
- `stack depth limit exceeded` → users_profile RLS/함수 관계를 재귀 없게 정리하여 해결

---

# O. 다음 단계(정식 앱 구현) 우선순위

1) **제품목록(홈)**  
   - 상단: 구역 필터 버튼
   - 검색바: 토큰 AND, 구역 토큰 override
   - 목록 클릭 → 상세 이동
2) **제품상세**  
   - 현재 재고 표시
   - 입고/출고 버튼 → 양수 입력 모달 → RPC 호출
   - 성공 시 재고/이력 갱신
3) **제품등록**  
4) **관리자(계정/비활성/로그/기준값)**

---

# P. 새 패널로 이어가기 위한 “핸드오프 키트”

## P-1 새 패널 시작 메시지 템플릿(복사/붙여넣기)
아래를 새 대화 첫 메시지로 넣으면 흐름이 거의 끊기지 않습니다.

```text
온누리 재고조사 시스템 이어서 진행.
아래 SSOT(v1.1)가 최신 기준이며 이것만 기준으로 답변해줘.
- Supabase 프로젝트: onnuri inven
- 테이블/함수/RLS 구성 완료, Next.js 미니앱으로 admin/staff 로드+RPC 테스트 통과
이제 정식 앱(목록/상세/등록/관리자) 구현로 넘어가려 함.
```

(그리고 이 SSOT 파일을 함께 업로드)

## P-2 새 패널에서 내가(사용자) 확인해줘야 하는 것들
흐름 유지에 꼭 필요한 “상태 변수”들입니다.

1) 프론트 저장소 상태
- Next.js 버전(App Router 사용 여부), 폴더 구조(app/, src/lib/)
- `supabaseClient.ts` 위치와 env 키 이름

2) Supabase 환경값(값 자체는 공유하지 말고 “존재 여부”만)
- `NEXT_PUBLIC_SUPABASE_URL` 설정됨?
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`(= Publishable key) 설정됨?

3) 정책 상태
- RLS가 켜져 있는지(각 테이블)
- staff가 읽기/쓰기 해야 하는 범위(현재는 통과 상태)

4) 운영 정책 미결정 항목(결정되면 SSOT 업데이트)
- 출고/비활성 시 note(사유) 필수 여부
- 사진(Storage) 권한(공유/제한)
- 엑셀 다운로드 범위(기본: 필터/검색 결과)

## P-3 “실수 방지 장치”
- 새 기능 논의가 생기면:
  1) SSOT에 반영(한 줄이라도)  
  2) 그 다음 코딩 진행
- DB/RLS/함수는 이미 통과한 상태이므로:
  - UI/UX 추가로 인해 정책이 깨지지 않도록, 변경 시 반드시 “미니 테스트 앱”으로 재검증

---

## 변경 규칙
- 이 문서(SSOT)만이 기준
- 결정이 바뀌면, **먼저 SSOT 업데이트 → 이후 구현**
- 데이터 일관성(K)과 권한 강제(L)는 어떤 기능보다 우선
# ssot v1.1