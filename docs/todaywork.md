# todaywork.md — 2026-01-19 (Onnuri Inventory)

## 0) 목적과 운영 원칙

목적: Supabase SQL/RLS/RPC 최적화를 시작하기 전에, “코드 ↔ DB 계약(contract)”을 증거 기반으로 고정하고, 연동을 깨지 않는 범위에서 안전한 최적화(인덱스/함수 내부 로직)를 적용한다.

오늘의 범위(Allowed)

* 인덱스 추가
* 함수 내부 구현 최적화(시그니처/반환 동일 유지)
* 읽기 전용 view/RPC 추가(기존 동작/권한을 바꾸지 않는 범위)
* “이미 깨져 있는” 계약을 정상화하는 최소 복구(아래 Repair Gate 조건 충족 시)

오늘의 금지선(Do Not Break Contract)

* RPC 시그니처(파라미터 개수/타입) 변경 금지
* RPC 반환 shape(컬럼/타입) 변경 금지
* 컬럼 rename 금지(예: active ↔ is_active)
* RLS 정책의 “조회 범위/권한 방향” 변경 금지(archived 포함 여부 등)
* 클라이언트 쿼리를 무단으로 RPC로 대체 금지(오늘은 감사/근거/안전 최적화만)

진행 규칙

* Task A → B → (조건부 Repair) → C → D 순서 엄수
* 각 Task는 산출물 파일과 Acceptance Criteria를 충족해야 다음으로 진행
* 모든 변경은 작은 커밋으로 쪼개고, revert 가능한 상태를 유지

---

## 1) Git 셋업(안전장치) — 반드시 먼저

현재 상태(참고):

* 현재 브랜치: `codex/login-premium-ui`
* Untracked: `docs/chatgptreport.md`, `docs/todaywork.md`

### 1.1 작업 전용 브랜치 생성 (현재 브랜치에서 분기)

```powershell
git checkout -b codex/db-contract-audit-2026-01-19
```

### 1.2 시작 상태 기록(worklog)

아래 커맨드 결과를 `docs/worklog-2026-01-19.md`에 붙여 넣기:

```powershell
git status --short
git branch --show-current
git log -5 --oneline
```

### 1.3 todaywork/chatgptreport 문서 커밋(작업 기준점 고정)

```powershell
git add docs/todaywork.md docs/chatgptreport.md
git commit -m "docs: add todaywork runbook and project report"
git push -u origin codex/db-contract-audit-2026-01-19
```

Acceptance Criteria

* 전용 브랜치에서 작업 시작
* 시작 상태가 docs/worklog-2026-01-19.md에 기록됨
* todaywork + chatgptreport가 첫 커밋으로 고정됨

---

## 2) Task A — 코드 기준 App→DB 사용 실태 전수 조사

목표: 코드가 실제로 호출하는 `.rpc()` / `.from()` 목록을 전수 조사해 “변경 금지 계약”을 도출한다.

### 2.1 수행 절차

1. `.rpc(` 전수 추출
2. `.from(` 전수 추출(테이블명 포함)
3. `/products/archived` 데이터 취득 방식 확인(직접 select vs RPC)
4. inventory 직접 update가 코드에 존재하는지 확인(있다면 계약 위험)

### 2.2 PowerShell 명령(결과를 문서에 원문 붙여넣기)

RPC:

```powershell
Get-ChildItem -Recurse -Include *.ts,*.tsx |
  Select-String -Pattern "\.rpc\(" |
  Select-Object Path, LineNumber, Line
```

Table access:

```powershell
Get-ChildItem -Recurse -Include *.ts,*.tsx |
  Select-String -Pattern "\.from\(" |
  Select-Object Path, LineNumber, Line
```

Archived 관련:

```powershell
Get-ChildItem -Recurse -Include *.ts,*.tsx |
  Select-String -Pattern "archived|list_archived_products|active\s*=\s*false|eq\('active'" |
  Select-Object Path, LineNumber, Line
```

Inventory 직접 update 탐지(보수적으로):

```powershell
Get-ChildItem -Recurse -Include *.ts,*.tsx |
  Select-String -Pattern "from\('inventory'\)\.update|update\('inventory'|inventory_logs.*insert|inventory\.update" |
  Select-Object Path, LineNumber, Line
```

### 2.3 산출물

* `docs/db-usage-scan.md` (new)

`docs/db-usage-scan.md`에 포함할 표

(1) RPC Calls

| RPC name | Arguments shape | Call site (file:line) | Expected return (fields used) | Notes |
| -------- | --------------- | --------------------- | ----------------------------- | ----- |

(2) Table Access

| Table | Filters | Order/range/limit | Call site (file:line) | Notes |
| ----- | ------- | ----------------- | --------------------- | ----- |

또한 Raw Findings(명령 출력 원문)를 하단에 붙여넣기.

Acceptance Criteria

* `.rpc(` 결과 0건 누락 없이 포함
* `.from(` 결과 0건 누락 없이 포함
* `/products/archived` 데이터 취득 방식이 “증거(file:line)”와 함께 명시
* inventory 직접 update 존재 여부가 “있음/없음”으로 결론 내려짐(증거 포함)

---

## 3) Task B — 운영 DB 기준 Live State(정책/함수/인덱스) 추출

목표: 운영 DB에 “현재 적용된” RLS 정책/핵심 함수 정의/인덱스를 증거로 고정한다.
주의: 로컬 SQL 백업 파일이 있어도, 최종 기준은 “운영 DB” 출력이다.

### 3.1 Supabase SQL Editor에서 실행할 SQL

(1) RLS 정책 현황

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('products','inventory','inventory_logs','zones','users_profile','app_settings')
order by tablename, policyname;
```

(2) 핵심 함수 정의(가능한 범위에서 전체 definition 확보)

```sql
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_functiondef(p.oid) as def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in (
    'adjust_stock','is_active_user','is_admin',
    'admin_list_user_profiles','admin_set_user_active',
    'list_archived_products','update_product',
    'archive_product','restore_product','delete_product','delete_product_admin',
    'get_expiry_warning_days','set_expiry_warning_days'
  );
```

(3) 인덱스 현황

```sql
select tablename, indexname, indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('products','inventory','inventory_logs')
order by tablename, indexname;
```

### 3.2 산출물

* `docs/db-live-state.md` (new)

  * 위 3개 SQL의 출력 결과를 “원문 그대로” 섹션별로 붙여넣기

Acceptance Criteria

* RLS 정책 출력 포함(대상 테이블 전부)
* `adjust_stock`, `is_admin`, `is_active_user` 함수 정의 포함
* products/inventory/inventory_logs 인덱스 목록 포함

---

## 4) Task B-Repair Gate — (조건부) 계약 정상화 복구

원칙: 오늘은 최적화가 목적이므로 계약 변경은 금지.
단, 운영 DB가 “이미 깨져 있어 런타임 에러/보안 규칙 위반” 상태라면 복구는 허용한다.

### 4.1 Repair Gate 조건(하나라도 해당하면 복구 수행)

* admin RPC가 `users_profile.is_active` 같은 “존재하지 않는 컬럼”을 참조해 실행 시 에러가 나는 경우
* `adjust_stock`가 비활성 상품(active=false)을 차단해야 하는데 운영 DB 정의가 이를 차단하지 않는 경우(업무 규칙/보안 위반)
* 동일 함수가 상이한 버전으로 덮어씌워져 동작이 불안정한 경우(정의가 의도와 불일치)

### 4.2 복구 수행 규칙

* 반드시 패치 파일로만 수행: `db/patches/2026-01-19_repair_contract.sql`
* 멱등(idempotent)하게 작성
* 함수 시그니처/반환 shape는 유지(내부 로직/참조 컬럼만 정상화)
* 증거 기반: Task B 출력(함수 def/정책)을 근거로 무엇이 깨졌는지 명시

### 4.3 산출물(조건 충족 시에만)

* `db/patches/2026-01-19_repair_contract.sql` (new)
* `docs/repair-note-2026-01-19.md` (new): “무엇이 깨져 있었고, 어떤 증거로 복구했는지” 요약(10~20줄)

Acceptance Criteria

* Repair Gate 증거가 docs/repair-note에 포함(운영 DB 출력 기반)
* 패치가 멱등이며 계약(시그니처/반환)을 깨지 않음
* 적용 후 Task D 스모크 테스트 통과

---

## 5) Task C — 성능 근거(EXPLAIN) 확보 + 안전 최적화(인덱스 우선)

목표: 느린 쿼리를 근거로 확보하고, 연동을 깨지 않는 최적화(인덱스/함수 내부)를 적용한다.

### 5.1 EXPLAIN 대상 선정

* Task A에서 확인된 “가장 빈번한 목록 조회” 1~2개
* 검색(ILIKE 등)이 있으면 검색 쿼리 1개
* inventory_logs 조회가 있으면 로그 쿼리 1개

가능하면 Supabase SQL Editor에서 실제 SQL로 재현해 EXPLAIN 실행.

### 5.2 EXPLAIN 템플릿

```sql
explain (analyze, buffers)
select ...
```

### 5.3 산출물(근거 문서)

* `docs/explain-2026-01-19.md` (new)

  * 각 쿼리: SQL 원문 + EXPLAIN 출력 + 짧은 해석(3~8줄)

Acceptance Criteria

* 최소 2개 이상의 EXPLAIN 결과 포함
* 병목 원인이 문장으로 명확히 기술됨(Seq Scan, Sort, Filter, Join 등)

### 5.4 안전 최적화: 인덱스 패치

원칙

* 계약 영향 없음
* 멱등(Create index if not exists)
* Task A/B/C의 근거에 기반해 “실제 패턴”을 직접 커버

산출물

* `db/patches/2026-01-19_opt_indexes.sql` (new)

Acceptance Criteria

* 패치 멱등
* 실제 where/order/search 패턴을 커버
* (가능하면) EXPLAIN 비용 개선 근거를 docs/explain에 추가 기록

---

## 6) Task D — 스모크 테스트(연동 안정성 확인)

목표: 복구/최적화가 연동을 깨지 않았음을 확인한다.

체크리스트(필수)

1. 로그인/게이팅(users_profile) 정상
2. 제품 목록 로딩 정상
3. 제품 상세 진입 정상
4. 재고 조정(adjust_stock) 정상 + 로그 기록(가능하면 확인)
5. archived 목록 정상(현재 구현/정책 기준)
6. settings(유통기한 경고 일수) 조회/설정 정상

산출물

* `docs/smoke-test-2026-01-19.md` (new)

  * 각 항목 PASS/FAIL
  * FAIL이면 재현 절차/관련 로그/스크린샷(가능 시) 포함

Acceptance Criteria

* 전 항목 PASS 또는 FAIL의 경우 원인/대응이 문서에 명확히 기록됨

---

## 7) 커밋/PR 계획(작게, 단계적으로)

Commit 1 (docs)

* docs: add worklog (start state)
* docs: add db usage scan scaffold or complete
* docs: add db live state scaffold or complete

Commit 2 (docs)

* docs: add explain evidence
* docs: add smoke test report (or partial with notes)

Commit 3 (db)

* db: add safe index optimization patch
* (조건부) db: add contract repair patch

PR 설명에 포함할 것

* 오늘 고정된 contract 요약(무엇을 바꾸지 않았는가)
* 추가/변경된 인덱스 목록
* EXPLAIN 근거 요약
* 스모크 테스트 결과

---

## 8) 롤백 계획

1차 롤백: 문제 커밋 revert

* 인덱스 롤백이 필요하면 drop index를 별도 패치로 제공(인덱스명 명시)
* 함수 복구가 필요하면 Task B에서 확보한 “이전 정의”를 근거로 restore patch 작성

필요 시 산출물

* `db/patches/2026-01-19_rollback.sql`
* `docs/rollback-note-2026-01-19.md`

---

## 9) 완료 정의(Definition of Done)

아래 파일들이 존재하고 내용이 채워져 있으며, 스모크 테스트가 완료된다.

* docs/worklog-2026-01-19.md
* docs/db-usage-scan.md
* docs/db-live-state.md
* docs/explain-2026-01-19.md
* db/patches/2026-01-19_opt_indexes.sql
* (조건부) db/patches/2026-01-19_repair_contract.sql
* docs/smoke-test-2026-01-19.md
