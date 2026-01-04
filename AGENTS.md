# AGENTS.md — Onnuri Inven (Project Guardrails)

## Read before coding
- `docs/SSOT.md` is the single source of truth (SSOT). If anything conflicts, SSOT wins.
- Follow `docs/TODO.md` for scope and order of work.

## Non-negotiable rules (do not break)
1) Stock changes
   - NEVER update `inventory.stock` directly.
   - All stock changes MUST go through RPC:
     `public.adjust_stock(p_product_id, p_delta, p_note)`.

2) No delete UX
   - Do NOT build any “delete” user flow.
   - Use archive instead: set `products.active=false` and require `archived_reason`.

3) List state persistence
   - List state MUST be persisted via URL query params only (e.g. `?zone=...&q=...`).
   - No localStorage-based state.

4) No scroll restoration
   - Do NOT implement scroll position restoration.

5) Products list: Zone vs Search (SSOT UX)
   - Zone chips are for browsing only (not for narrowing search).
   - Apply zone filtering ONLY when `q` is empty.
   - When `q` is non-empty, IGNORE zone filtering and search across ALL active products.
   - Add an "All" chip that clears the zone filter (remove `zone` from the URL).
   - Do NOT implement any “zone keyword override” by parsing zone tokens from `q`.

6) Search rules
   - Partial match over product `name` and `manufacturer`.
   - Multi-token AND (tokens split by comma/space).

7) Korean IME stability (required)
   - Do NOT update URL query params on every keystroke.
   - While composing Hangul (IME composition), never call `router.replace`.
   - Commit `q` to the URL on `compositionend` and/or via debounce (~300ms).

## UI rules
- Global background color is `#F9F8F6`.
- Mobile-first. Touch targets >= 44px.
- Minimal decoration. Avoid heavy animations.
- Loading: skeleton. Error: short user message + `console.error` details.

## Workflow rules
- Work in small slices (one page or one feature per task).
- Do not refactor unrelated files.
- After each slice: provide a short manual test checklist.
