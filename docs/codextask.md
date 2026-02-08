# Codex Task — 전역 페이지 전환(탭→화면) 지연 진단만 수행

온누리 재고조사 웹앱(Next.js App Router + Supabase)에서 **페이지 전환이 전체적으로 멈칫**하는 체감 지연이 있습니다.  
이번 작업의 목표는 **수정이 아니라 “원인 진단(측정/분류/리포트)”만** 수행하는 것입니다.

---

## 0) 진단 목표(반드시 분류)

전환 지연이 아래 중 어디에 해당하는지 구분하세요.

1. **탭 → 라우트 변경 시작 자체가 늦음** (Link/prefetch 미작동, onClick push, 이벤트 지연 등)
2. **라우트 변경은 시작되는데, 새 화면 표시가 늦음** (서버 응답/RSC 페이로드 대기, 데이터 패치 대기)
3. **네트워크는 끝났는데, 화면이 늦음** (JS 번들/하이드레이션/렌더링 부담)
4. **초기 진입/오랜 idle 뒤 첫 전환만 유독 느림** (서버/함수 cold start 가능성)

---

## 1) 작업 A — “탭→라우트 커밋” 시간 측정 로거 추가 (DEV 전용)

App Router에는 pages router처럼 Router.events가 없으므로, **layout에 클라이언트 컴포넌트**를 하나 추가해 아래를 측정하세요.

### 요구사항

- 문서 전체 click capture로 내부 링크 클릭을 감지
  - `<a>` 또는 Next `<Link>`가 렌더링한 앵커 포함
  - 외부 링크/새 탭/수정키(CTRL/Meta) 클릭은 제외
- 내부 이동이면 `performance.mark('nav:start')` 기록
- `usePathname()` 변화 시 `performance.mark('nav:commit')` 기록
- 두 mark 차이를 계산해 콘솔 출력:
  - from, to, delta_ms, timestamp
- 출력은 `console.table` 권장

### 안전장치

- **production에 영향 없게** 환경변수로 켜기
  - 예: `NEXT_PUBLIC_DEBUG_NAV=1`일 때만 동작
- 로거는 전역 1회만 주입
  - `app/layout.tsx`에 포함되도록 구성

> 구현 예시:
>
> - `app/_components/NavLatencyLogger.tsx` (client)
> - `app/layout.tsx`에서 `<NavLatencyLogger />` 조건부 렌더

---

## 2) 작업 B — 전환 시 네트워크(RSC) 요청 관찰 포인트 정리

개발자가 Chrome DevTools → Network에서 확인할 때,

- 전환 순간 발생하는 요청(특히 `?_rsc=` 같은 RSC 요청)의 **TTFB / 총 시간**을 확인
- 작업 A의 `delta_ms`와 비교해 “네트워크가 병목인지” 판단할 수 있게

이 내용을 리포트에 **짧게 가이드**로 적어주세요.

---

## 3) 작업 C — 링크/전환 구현 방식 감사(Audit)

레포에서 화면 이동이 발생하는 주요 지점들을 찾아 아래를 점검하세요.

- 제품 카드 클릭이 `<Link href=...>` 기반인지, 아니면 `onClick router.push()`인지
- `<Link>`를 쓰더라도 `prefetch`가 꺼져 있거나, 링크가 뷰포트 관찰 대상이 아닌 구조인지
- 전역 네비게이션/버튼 이동도 동일하게 점검

산출물:

- “prefetch 혜택을 못 받는 지점 목록”
- “router.push로만 이동하는 지점 목록”

---

## 4) 작업 D — 빌드 산출물 기반 “무거운 라우트” 찾기

- `npm run build` 실행
- 출력되는 route size / first load JS 크기 확인
- 큰 페이지(예: `/products`, `/products/[id]`, `/settings` 등)를 기록
- 큰 페이지가 있다면 원인 후보를 짚기:
  - 큰 Client Component 덩어리
  - 과한 의존성/라이브러리
  - 불필요한 클라이언트 렌더링 범위 등

---

## 5) 산출물(필수) — 리포트 작성

`docs/perf-diagnosis.md` 파일을 새로 만들고 아래 내용을 정리하세요.

- 관측 환경: dev/prod(가능하면), Chrome, 모바일/데스크탑
- 로거 결과 요약: 대표 전환 5개(`delta_ms`)
- 네트워크 관측 요약: 전환 시 RSC 요청의 TTFB/총시간 패턴
- 링크 감사 결과: prefetch 안 되는 지점 목록
- 빌드 결과: 큰 라우트/번들 후보
- 결론: 0) 분류 1~4 중 주원인 1~2개 선택 + 근거
- 다음 액션(수정)은 **제안만** 하고 이번 PR에서는 실제 최적화 수정은 하지 말 것

---

## 6) 브랜치/커밋 규칙

- 브랜치: `codex/diag-nav-latency`
- 커밋 메시지 예:
  - `chore(perf): add nav latency logger`
  - `docs(perf): add navigation latency diagnosis report`

---

## 7) 내가(요청자) 확인할 방법

Codex가 로거를 넣으면:

1. `.env.local`에 `NEXT_PUBLIC_DEBUG_NAV=1` 추가
2. `npm run dev`
3. 몇 번 이동:
   - 제품목록 → 상세
   - 상세 → 목록
   - 설정 → 목록 등
4. DevTools Console에서 `console.table`로 찍힌 `delta_ms` 확인
   - `delta_ms`가 이미 크면 (분류 1/2) 쪽
   - `delta_ms`는 작고, Network의 RSC 요청이 크면 (분류 2) 네트워크/서버 쪽
   - Network는 끝났는데 화면 렌더가 늦으면 (분류 3) 번들/하이드레이션 쪽
