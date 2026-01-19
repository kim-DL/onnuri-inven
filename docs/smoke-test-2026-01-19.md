# Smoke Test — 2026-01-19

Status: NOT RUN (needs human verification) — run by project maintainer/QA in staging (preferred) or production (minimal smoke) after DB patch is applied.

## Checklist

1) 로그인 게이트
- Status: NOT RUN (needs human verification)
- Steps: Open `/login`, sign in with a known active user.
- Expect: Redirect to `/products`; no error banners; profile gate passes.

2) 상품 목록 로딩
- Status: NOT RUN (needs human verification)
- Steps: Visit `/products`.
- Expect: Active products render; zone chips + All chip present; no console errors.

3) 상품 상세 진입
- Status: NOT RUN (needs human verification)
- Steps: Click a product card to open `/products/[id]`.
- Expect: Product info and stock visible; back link preserves query params.

4) 재고 조정 (adjust_stock RPC)
- Status: NOT RUN (needs human verification)
- Steps: On detail page, tap IN/OUT, enter quantity >0, confirm.
- Expect: Stock updates correctly; new log row appears; errors shown if invalid (e.g., negative stock).

5) 비활성 목록
- Status: NOT RUN (needs human verification)
- Steps: Go to `/products/archived`.
- Expect: Archived products list loads; restore/delete modals open; no unexpected errors.

6) 설정 (expiry_warning_days)
- Status: NOT RUN (needs human verification)
- Steps: Admin user opens `/settings`, adjusts expiry warning days, saves.
- Expect: Save succeeds for admin; non-admin blocked; value persists on reload.
