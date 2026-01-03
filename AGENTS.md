# AGENTS.md — Onnuri Inven (Project Guardrails)

## Read before coding
- docs/SSOT.md is the single source of truth.
- Follow docs/TODO.md for scope and order of work.

## Non-negotiable rules (do not break)
1) NEVER update inventory.stock directly. Stock changes MUST go through RPC:
   public.adjust_stock(p_product_id, p_delta, p_note).
2) No delete UX. Use archive: products.active=false + archived_reason (required).
3) List state persistence MUST use URL query params only. No localStorage-based state.
4) Do NOT implement scroll position restoration.
5) Search rules:
   - partial match over name/manufacturer/origin_country
   - multi-token AND
   - if query includes a zone token (냉동1/냉동2/냉장/상온), it overrides zone filter buttons.

## UI rules
- Global background color is #F9F8F6.
- Mobile-first. Touch targets >= 44px.
- Minimal decoration. No heavy animations.
- Loading: skeleton. Error: short user message + console.error details.

## Workflow rules
- Work in small slices (one page or one feature per task).
- Do not refactor unrelated files.
- After each slice: provide a short manual test checklist.
