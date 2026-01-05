# TODO.md — Onnuri Inven (Execution Plan)

This file is a prioritized, slice-based task list.
Source of truth: `docs/SSOT.md` and `AGENTS.md`.

Legend:
- [ ] not started
- [x] done
- (P0/P1/P2) priority

---

## 0) Current Status Snapshot

- [x] Login page (`/login`) implemented with Supabase auth + profile checks.
- [x] Root gating (`/`) redirects based on session/profile.
- [x] Products list page (`/products`) implemented (read-only) with zone chips and search (URL persistence).
- [x] Product detail page (`/products/[id]`) implemented (read-only) with back-to-list query preservation.
- [x] Products list IME stability + zone/search priority needs correction per SSOT.
- [x] "All" zone chip must exist and clear `zone` param.

---

## 1) P0 Hotfix: Products List UX per SSOT (must fix now)

### 1.1 Zone vs Search priority (SSOT)
- [ ] When `q` is empty: apply zone filter (`zone` param).
- [ ] When `q` is non-empty: ignore zone filter entirely; search across ALL active products.
- [ ] Ensure this is enforced in filtering logic (not just UI).
- [ ] Keep `zone` in the URL even when `q` is non-empty if desired, but do not apply it.

### 1.2 Add "All" chip
- [ ] Add an "All" chip before the zone chips.
- [ ] Clicking "All" removes `zone` from the URL (not `zone=all`).
- [ ] Visual state: "All" can be treated as selected when no `zone` param exists.

### 1.3 Korean IME stability (required)
- [ ] Ensure Hangul IME composition does not break in search input.
- [ ] Do NOT call `router.replace` while composing (`compositionstart` → `compositionend`).
- [ ] Debounce URL updates for `q` (~300ms) when not composing.
- [ ] Input should use a local draft state; URL should reflect committed value only.

### 1.4 Remove zone keyword override logic (if any exists)
- [ ] Do not parse zone keywords from `q`.
- [ ] Search input is for product/manufacturer tokens only.

### 1.5 Acceptance checks (manual)
- [ ] With zone "Chilled(냉장)" selected, search `돈까스` shows results from any zone.
- [ ] Clearing `q` immediately returns to zone browsing behavior.
- [ ] Hangul typing works without inserting spaces between syllables.
- [ ] Terminal logs do not spam GET on every keystroke (debounced).
- [ ] `npm run lint` passes.

---

## 2) P1 Phase 4: Stock Adjustment on Detail Page (RPC)

### 2.1 UI
- [ ] Add two buttons on `/products/[id]`: IN / OUT (Korean labels allowed).
- [ ] Tap button → modal input for positive integer only.
- [ ] Validate: integer > 0; show short Korean error on invalid input.

### 2.2 RPC call (write path)
- [ ] Call `supabase.rpc('adjust_stock', { p_product_id, p_delta, p_note })`
  - IN: `p_delta = +qty`
  - OUT: `p_delta = -qty`
- [ ] Never update `inventory.stock` directly.
- [ ] On success: refresh the displayed stock and append latest log entry (or refetch logs).
- [ ] On failure: show short message; `console.error` full details.

### 2.3 Notes
- [ ] Keep note optional for now unless SSOT later requires it.
- [ ] Ensure server-side negative stock rejection is handled gracefully.

### 2.4 Acceptance checks (manual)
- [ ] IN with qty increments stock.
- [ ] OUT with qty decrements stock; cannot go below zero (server error shown).
- [ ] Inventory log row is created and visible.
- [ ] `npm run lint` passes.

---

## 3) P1 Phase 5: Product Create Page (`/products/new`)

### 3.1 Required fields
- [ ] Required: name, zone, (initial stock input optional but stored via RPC).
- [ ] Optional: manufacturer, unit, spec, origin_country, expiry_date, photo_url.

### 3.2 Write pattern (must follow)
- [ ] Create product row first.
- [ ] Create inventory row with `stock = 0` (enforced).
- [ ] If initial stock is provided: call `adjust_stock(+n)` (do NOT write inventory directly).

### 3.3 UX
- [ ] After save: offer “Add another” or “Go to list”.
- [ ] Validate required fields; show short Korean errors.

---

## 4) P2 Phase 6: Admin / Settings Page

### 4.1 Account management (users_profile)
- [ ] Admin can list users.
- [ ] Admin can activate/deactivate users.
- [ ] Admin can set role: admin/staff.
- [ ] Prevent non-admin access.

### 4.2 Logs
- [ ] View inventory_logs with filters (date range, product, user).

---

## 5) Navigation / Menus (P1)

- [ ] Add a simple top-right menu (hamburger/ellipsis) on `/products`.
  - [ ] Excel download entry (stub if not ready).
  - [ ] Admin/settings entry (admin only).
  - [ ] Sign out.

- [ ] Add a floating “+” button on `/products` to go to `/products/new`.

---

## 6) Excel Download (P2)

- [ ] Default: export current list view (respect current `q`; ignore zone if q exists per SSOT).
- [ ] Optional: export all.
- [ ] Columns: name, manufacturer, expiry_date, stock, zone (+ origin_country if enabled).
- [ ] Implementation can be client-side CSV first; xlsx later if needed.

---

## 7) Quality Gates (always)

- [ ] `npm run lint` passes for every PR.
- [ ] No localStorage list-state persistence.
- [ ] No direct inventory stock updates.
- [ ] Manual smoke checklist attached to each PR.

---

## 8) Git Workflow (how we ship)

- Work on a slice branch: `codex/<slice-name>`
- Commit with a single purpose.
- Push and open PR.
- Squash merge to `main`.
