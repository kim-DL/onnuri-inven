# CODEX_RULES.md — Onnuri Inven (Execution Rules)

Purpose: This document exists to prevent implementation mistakes. It lists only rules that MUST be followed.
Source of truth: `docs/SSOT.md`. If SSOT conflicts with this file, SSOT wins.

---

## 1) Non-Negotiable Rules

### 1.1 Stock changes (RPC only)
- NEVER update `inventory.stock` directly.
- All stock changes MUST go through:
  `public.adjust_stock(p_product_id, p_delta, p_note)`.
- Stock must never go below zero. The server enforces this; the client must show a short user-facing message on failure.
- Do not “recalculate” current stock on the client beyond what the server returns / current reads provide.

### 1.2 No delete UX (archive only)
- Do NOT build any “delete” UX.
- Default operation is archive:
  - `products.active = false`
  - `archived_reason` is required
- “Hard delete” is out of scope (admin-only, archived list only).

### 1.3 State persistence & over-feature avoidance
- List state (zone + search) MUST be persisted with URL query params only.
- No localStorage-based state.
- Do NOT implement:
  - scroll position restoration
  - next/prev navigation on detail
  - barcode system
  - attribute-change history (only stock change logs are required)

---

## 2) UX Flow Rules

### 2.1 Core flow (must hold)
Search/Filter → List → Open Product → Detail → In/Out adjustment → Back to List

- Returning to the list MUST preserve:
  - zone selection (if any)
  - search query `q`
- Scroll restoration is explicitly excluded.

### 2.2 Stock adjustment UX (fixed)
- Detail page has two buttons: **IN** / **OUT**.
- Tap button → open a modal to input a positive integer.
- Internal logic:
  - IN: `delta = +qty`
  - OUT: `delta = -qty`
- Do not implement +/- stepper as the primary UX.

---

## 3) Products List: Zone vs Search (SSOT UX)

### 3.1 Zone chips are for browsing
Zone chips: **All / Frozen1 / Frozen2 / Chilled / Ambient** (Korean labels in UI as needed).

Rules:
- If `q` is empty:
  - Apply zone filtering using the selected chip / `zone` query param.
  - The “All” chip clears zone filtering by removing `zone` from the URL.
- If `q` is non-empty:
  - IGNORE zone filtering entirely.
  - Search runs across ALL active products, regardless of any selected zone.
- Do NOT implement any zone parsing from `q`.
  - No “zone keyword override”
  - Search input is for product/manufacturer tokens only

Implementation note (URL):
- It is OK if `zone` remains in the URL while `q` is non-empty (to restore browsing after clearing `q`),
  but the filtering must ignore zone whenever `q` is present.

---

## 4) Search Rules

### 4.1 Search fields
- Product `name`
- Product `manufacturer`

(If SSOT later expands searchable fields, update SSOT first, then update this file.)

### 4.2 Matching behavior
- Partial substring match.
- Multi-token AND match:
  - Tokens split by comma and/or whitespace.
  - Example: `harim tonkatsu` means `harim` AND `tonkatsu` must both match across the allowed fields.

---

## 5) Korean IME Stability (Required)

Problem to avoid:
- Calling `router.replace` (URL updates) on every keystroke causes rerenders that break Hangul composition.

Rules:
- Do NOT update `q` in the URL on every keystroke.
- Never call `router.replace` while IME is composing (`compositionstart` → `compositionend`).
- Commit `q` to URL via:
  - `compositionend` (immediate), and/or
  - debounce (~300ms) when not composing
- The input should be controlled by a local draft state, and the URL should reflect the committed value.

Acceptance signal:
- Typing Hangul in the search bar must work normally without requiring spaces between syllables.

---

## 6) Supabase Access Patterns

### 6.1 Keys & security
- Client uses only the publishable (anon) key.
- Secret key must never be exposed in the frontend.

### 6.2 Reads
- Reads are protected by RLS and require an authenticated, active user.
- List/detail pages read from:
  - `zones`
  - `products` (active only)
  - `inventory` (read-only)
- Inactive users must be blocked.

### 6.3 Writes
- Stock writes: RPC only (`adjust_stock`).
- Archive/unarchive:
  - Staff can archive with required reason (SSOT rules apply).
- Product create/update:
  - Only within SSOT-defined scope and required fields.

---

## 7) Working Style in This Repo

### 7.1 Scope control
- Implement one page or one feature slice at a time.
- Do not refactor unrelated files.
- If a new behavior is proposed:
  1) Update SSOT
  2) Then implement

### 7.2 Done definition for each slice
- Provide a short manual test checklist.
- Must pass:
  - `npm run lint`
  - and basic smoke run (`npm run dev`)
