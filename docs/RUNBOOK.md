# Runbook

## Before you start
- SSOT: `docs/SSOT.md` is the single source of truth.
- Guardrails: `AGENTS.md` rules are non-negotiable.
- Stock changes: never write `inventory.stock` directly; use RPC `public.adjust_stock(...)`.
- No delete UX: archive only (`products.active=false` + `archived_reason`).
- List state: URL query params only (no localStorage, no scroll restoration).

## Standard workflow
- Branch: `codex/<slice-name>`
- Work in a single slice (one page or feature).
- Open PR and squash merge to `main`.

## Pre-PR checklist
- Lint: `npm run lint`
- Dev server: `npm run dev`
- Smoke test: see below

## Smoke test checklist
- `/login`
  - Unauthed user can log in
  - Blocked user sees blocked notice
- `/products` list
  - Zone chips: All / 냉동1 / 냉동2 / 냉장 / 상온
  - Zone applies only when `q` is empty
  - Search matches name/manufacturer, multi-token AND
  - IME: no URL updates during composition, commits on end/debounce
  - URL state preserved (`?zone=&q=` only)
  - Stock shows per item; list cards are 2 lines
  - Floating "+" navigates to `/products/new`
- `/products/[id]`
  - Loads product and stock
  - Back link preserves query params
  - Logs newest first or "이력 없음"
  - IN/OUT RPC adjusts stock and logs
- `/products/new`
  - Required: name + zone
  - Initial qty 0 keeps stock at 0
  - Initial qty > 0 uses RPC and logs created

## Troubleshooting quick map
- IME breaks Hangul: ensure no `router.replace` during composition and debounce (~300ms).
- RLS errors: verify active profile; no service role key in client.
- RPC failure: check `public.adjust_stock` permissions and params (`p_product_id`, `p_delta`).
- "재고 부족": server rejected negative stock; UI should show short error.
