# 전역 페이지 전환 지연 진단 리포트

작성일: 2026-02-08  
대상: Next.js App Router + Supabase 기반 온누리 재고조사 앱

## 1) 관측 환경
- 모드: `dev` (`npm run dev`, 포트 3100)
- 브라우저: Chromium (Playwright headless)
- 디바이스: Desktop viewport
- 측정 범위: 인증 후 내부 화면 전환 (`/products`, `/settings`, `/dashboard`, `/products/archived`)
- 주의: `prod` 실측은 이번 작업 범위에서 미포함

## 2) 로거 결과 요약 (`delta_ms`)

측정 로거: `nav:start`(클릭 캡처) ~ `nav:commit`(`usePathname` 변경)  
대표 5건:

| from | to | delta_ms |
|---|---|---:|
| `/products` | `/settings` | 116.7 |
| `/settings` | `/products` | 28.6 |
| `/products` | `/dashboard` | 133.4 |
| `/dashboard` | `/products` | 40.7 |
| `/products` | `/products/archived` | 107.9 |

관찰:
- `products -> 다른 탭 화면` 전환이 주로 100~130ms
- `다른 화면 -> products` 복귀는 27~41ms로 상대적으로 짧음

## 3) 네트워크(RSC) 관측 요약

전환 중 `_rsc=` 요청 관측(동일 시나리오):

| path | status | ttfb_ms | total_ms |
|---|---:|---:|---:|
| `/products` | 200 | 13 | 20 |
| `/settings` | 200 | 5 | 21 |
| `/products` | 200 | 13 | 23 |
| `/dashboard` | 200 | 1 | 10 |
| `/products` | 200 | 19 | 30 |
| `/products/archived` | 200 | 1 | 14 |

해석:
- 본 측정에서는 `_rsc` TTFB/총시간이 대체로 짧음(대략 1~30ms)
- `delta_ms`(100ms대) 대비 네트워크 비중이 작아, 병목은 네트워크보다는 클라이언트 측(번들/렌더) 가능성이 큼

### DevTools 확인 가이드(작업 B)
- Network 탭에서 `_rsc=` 필터
- 전환 직후 `_rsc` 요청의 `TTFB`, `Duration` 확인
- 로거 `delta_ms`와 비교:
  - `delta_ms` ≈ `_rsc` Duration이면 분류 2 우세
  - `_rsc`가 짧은데 `delta_ms`가 크면 분류 3 우세

## 4) 링크/전환 구현 감사 (작업 C)

### A. `router.push` 전용 이동 지점
- 없음 (`router.push` 사용 지점 미발견)

### B. `router.replace` 기반 이동 지점 (prefetch 이점 제한)
- `app/products/new/page.tsx:744`  
  성공 화면의 `목록으로` 버튼이 `router.replace("/products")`
- `app/settings/SettingsClient.tsx:862`  
  저장 성공 후 `목록으로 돌아가기` 버튼이 `router.replace(backHref)`
- `app/products/[id]/ProductDetailClient.tsx:1760`  
  보관(비활성화) 완료 후 `router.replace(backHref)`

### C. `<Link>`지만 prefetch 이점이 약한 지점
- `app/products/ProductsClient.tsx:898`
- `app/products/ProductsClient.tsx:905`
- `app/products/ProductsClient.tsx:912`  
위 3개는 햄버거 메뉴 열림 상태에서만 렌더링되므로(조건부 렌더), 평상시 viewport prefetch 혜택이 약함.

## 5) 빌드 결과 및 무거운 라우트 후보 (작업 D)

`next build` 기본 출력(Next 16)에는 라우트별 First Load 표가 없어, `.next` 매니페스트/청크 크기로 보조 분석함.

### 공통(광범위 공유) 청크
- `static/chunks/470-3574a4af8b30b821.js`: **185.25KB**
- `static/chunks/500-b84d19d842172eba.js`: 8.51KB
- `static/chunks/app/layout-69a151d2d1c07be5.js`: 2.47KB

### 라우트 전용 app 청크
- `/products/[id]`: `static/chunks/app/products/[id]/page-*.js` **34.85KB**
- `/dashboard`: `static/chunks/app/dashboard/page-*.js` 22.74KB
- `/products`: `static/chunks/app/products/page-*.js` 16.90KB
- `/settings`: `static/chunks/app/settings/page-*.js` 16.65KB
- `/products/new`: `static/chunks/app/products/new/page-*.js` 15.57KB
- `/products/archived`: `static/chunks/app/products/archived/page-*.js` 13.26KB

### 추가 후보
- `static/chunks/408-a3b5b9b8f2a64393.js`: **50.51KB**  
  (`browser-image-compression`/이미지 처리 계열 코드 포함)

### 원인 후보 요약
- 공통 대형 청크(`470`) 비중이 큼
- 주요 화면이 대형 Client Component 단일 파일로 구성
  - `app/products/[id]/ProductDetailClient.tsx` 2360 lines
  - `app/products/ProductsClient.tsx` 1185 lines
  - `app/settings/SettingsClient.tsx` 1104 lines
- 결과적으로 전환 시 JS 처리/렌더 부담이 누적될 가능성 높음

## 6) 결론 (분류 1~4)

주원인 분류:
1. **분류 3 (네트워크는 끝났는데 화면이 늦음)** — 우세  
   근거: `_rsc` 요청은 짧은데 `delta_ms`가 상대적으로 큼.
2. **분류 2 (라우트 변경 후 새 화면 표시 대기)** — 보조  
   근거: `_rsc` 자체 지연은 작지만 존재하며, 전환 총시간 일부는 데이터/RSC 대기 포함.

비우세:
- 분류 1: 클릭→라우트 시작 지연을 시사할 증거 부족
- 분류 4: cold start 전용 지연은 이번 시나리오에서 확인되지 않음

## 7) 다음 액션(제안만, 이번 PR 미수정)

1. 공통 대형 클라이언트 청크(`470`) 분해  
   공통 의존(특히 Supabase auth/realtime/storage 경로) 로딩 범위를 화면별로 축소.
2. `/products/new`, `/products/[id]`의 무거운 이미지 처리 경로 지연 로드  
   실제 사진 조작 시점에만 동적 import.
3. 메뉴 기반 링크 prefetch 개선  
   메뉴 오픈 시 `router.prefetch` 호출 또는 링크 렌더 전략 조정.
4. 버튼형 `router.replace` 이동 중 정적 경로는 `<Link>` 전환 검토  
   prefetch/라우터 최적화 이점 활용.
