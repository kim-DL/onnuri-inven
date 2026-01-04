# PRD — Onnuri Inventory Count Web App (Onnuri Inven)

Version: v1.0 (aligned with SSOT v1.1+ decisions)  
Owner: Internal operations  
Platform: Mobile-first web app (Next.js + Supabase)

This PRD defines the product behavior and acceptance criteria.
Single source of truth for “facts”: `docs/SSOT.md`.

---

## 1) Problem Statement

On-site staff need a fast, low-friction way to:
- find products quickly,
- adjust stock with minimal mistakes,
- avoid confusing workflows (especially under time pressure).

The app must prioritize speed and reliability over feature richness.

---

## 2) Goals

- Mobile-first inventory counting workflow: List → Detail → Adjust (IN/OUT) → Back to list
- Strong guardrails:
  - no negative stock
  - no direct inventory updates from client
  - archive instead of delete
- Preserve operator context:
  - list filter/search preserved on back navigation
- Simple, consistent UI with minimal bug surface.

---

## 3) Non-Goals (Explicitly Out of Scope)

- Scroll position restoration on list
- Next/prev product navigation on detail
- Barcode workflow
- Full attribute change audit logs (only stock adjustments logged)
- Complex permission tiers beyond admin/staff

---

## 4) Users and Permissions

### 4.1 Roles
- Staff:
  - Full on-site operations: create/edit/archive products, adjust stock, export.
- Admin:
  - Everything staff can do, plus account management and system settings.
  - Hard delete only in admin context (and only for archived items, if enabled later).

### 4.2 Active User Requirement
- Only authenticated users with `users_profile.active=true` may access the app.
- Inactive users are blocked and can only sign out.

---

## 5) Core UX Rules (SSOT Critical)

### 5.1 Zone chips are browsing, not search narrowing
Zone chips: All / Frozen1 / Frozen2 / Chilled / Ambient (Korean labels shown in UI)

Rules:
- If `q` is empty: apply zone filter.
- If `q` is non-empty: ignore zone filter entirely; search across ALL active products.
- "All" clears the zone filter by removing `zone` from the URL.
- Do not parse zone keywords from `q` (no override logic).

### 5.2 List state persistence
- Persist list state via URL query params only:
  - `/products?zone=냉동1&q=돈까스`
- No localStorage-based persistence.
- Back navigation from detail must restore these params.

### 5.3 Korean IME stability (required)
- Do not update URL on every keystroke.
- Never call `router.replace` while IME is composing (compositionstart → compositionend).
- Commit `q` to URL on compositionend and/or via debounce (~300ms).

---

## 6) Pages and Requirements

## 6.1 Login (`/login`)
### Requirements
- Email/password login via Supabase Auth.
- After login:
  - If users_profile missing: sign out and redirect to `/login?notice=profile-missing`.
  - If users_profile.active=false: show blocked message and sign out option.
  - Else redirect to `/products`.

### Acceptance
- Invalid credentials: short Korean error message.
- Valid active user: lands on `/products`.

---

## 6.2 Products List (`/products`)
### Data
- Read zones (active), products (active), inventory (read-only).
- Display:
  - product name
  - manufacturer (fallback if empty)
  - zone label
  - current stock

### Interaction
- Zone chips:
  - All / Frozen1 / Frozen2 / Chilled / Ambient
  - Apply only when `q` is empty
- Search:
  - tokens split by comma/space
  - AND matching across name + manufacturer (and SSOT-approved extra fields if later expanded)
- Tap a product → go to `/products/[id]` with current query params preserved.

### UI states
- Loading: skeleton
- Empty: clear message
- Error: short message + `console.error` details

### Acceptance
- With any zone selected, searching returns results across all zones when `q` exists.
- Clearing `q` returns to zone browsing behavior.
- Hangul input works normally without forcing spaces.
- URL reflects committed state, not every keystroke.
- Lint passes.

---

## 6.3 Product Detail (`/products/[id]`)
### Data
- Read product, zone, inventory, and stock logs (read-only until stock adjust is added).

### Interaction
- Back link returns to `/products` preserving original query params.
- Show stock and recent stock adjustment logs.

### Acceptance
- Unauthed: redirect to `/login`.
- Profile missing: sign out + redirect to `/login?notice=profile-missing`.
- Inactive: blocked UI with sign out.
- Not found/inactive product: clear message + back link.

---

## 6.4 Stock Adjustment (Detail page action)
### UX
- Two buttons: IN / OUT
- Tap → modal input of positive integer only

### Backend rule
- Must call RPC `public.adjust_stock(p_product_id, p_delta, p_note)`
- Must never update inventory stock directly
- Server prevents negative stock

### Acceptance
- IN increases stock; OUT decreases; cannot go below zero.
- Log entries created and visible.

---

## 6.5 Product Create (`/products/new`)
### UX
- Required: name, zone
- Optional: manufacturer, unit, spec, origin_country, expiry_date, photo
- Save → offer add another or go back to list

### Data writes
- Create product
- Create inventory row with stock=0
- If initial stock is specified: call `adjust_stock(+n)` (RPC only)

### Acceptance
- Product appears in list.
- Stock is correct and logs reflect adjustments.

---

## 6.6 Admin / Settings (`/admin` or `/settings`)
### Admin-only
- Manage users_profile (active/role)
- View logs
- Optional settings (future)

---

## 7) Analytics and Observability (Minimal)

- Log client errors with `console.error` (local dev) and add a future hook for real logging.
- Keep UX error messages short and Korean.

---

## 8) Security Requirements

- Use Supabase publishable key on client only.
- RLS must enforce access:
  - authenticated + active user can read
  - writes restricted; stock write via RPC only
- Never expose secret key in the client.

---

## 9) Performance Requirements (Practical)

- Mobile-first layout, fast perceived load:
  - skeleton while fetching
- Avoid unnecessary router updates:
  - debounce search URL updates
  - no keystroke-level navigation spam

---

## 10) Release Strategy

- Implement as slices (one page/feature per PR).
- Each PR must include:
  - manual test checklist
  - `npm run lint` pass
- Squash merge to main.

---

## 11) Acceptance Criteria Summary (Must Pass)

- Auth gating works for all pages.
- Products list:
  - zone browsing works when q empty
  - search is global when q exists
  - All chip exists and clears zone
  - Hangul IME works without forced spaces
- Stock changes: RPC only; no direct inventory updates.
- Archive is used instead of delete.
