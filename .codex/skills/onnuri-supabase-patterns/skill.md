# Skill: onnuri-supabase-patterns

This skill defines safe Supabase usage patterns for Onnuri Inven.

Single Source of Truth:
- `docs/SSOT.md` defines schema, RLS expectations, and the adjust_stock RPC contract.

## Client keys and security
- Client uses only:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable)
- Never use or expose the secret key in frontend code.

## Auth + profile gating (required)
Before showing any protected page:
1) Read current session/user from Supabase Auth.
2) Read `users_profile` row for the user.
3) Enforce:
   - if no session: redirect to `/login`
   - if users_profile missing: sign out and redirect to `/login?notice=profile-missing`
   - if users_profile.active=false: show blocked UI with a sign-out button

## Reads (common patterns)
- Zones:
  - read active zones, ordered by `sort_order` if available
- Products:
  - read active products only (`active=true`)
- Inventory:
  - read-only, join by product_id as needed
- Inventory logs:
  - read-only, show recent entries on detail page

Prefer a single read pass per page:
- fetch zones once
- fetch active products once
- filter in-memory (unless SSOT later requires server-side filtering)

## Writes (strict rules)
### Stock changes
- RPC only:
  `supabase.rpc('adjust_stock', { p_product_id, p_delta, p_note })`
- Never update inventory rows directly from client.

### Product creation
- Create product row first.
- Create inventory row with `stock=0`.
- If initial stock is needed, call `adjust_stock(+n)` after inventory row exists.

### Archive (no delete)
- Archive by updating the product:
  - `active=false`
  - `archived_reason` required
- Do not create delete flows.

## Error handling
- User-facing: short Korean message.
- Developer-facing: `console.error` with details.
- Prefer deterministic states: loading / error / empty / content.
