---
name: onnuri-supabase-patterns
description: Use approved Supabase access patterns (auth, reads, RPC writes) for this app.
metadata:
  short-description: Supabase patterns
---

## Auth / Session
- Use Supabase Auth session. If unauthenticated, redirect to `/login`.
- Read `users_profile` to enforce `active` and `role`.

## Reads
- Use select queries (or views) defined in SSOT.
- Keep reads consistent across list/detail.

## Writes
- Stock changes: RPC only: `supabase.rpc('adjust_stock', { p_product_id, p_delta, p_note })`.
- Never update `inventory.stock` directly from client code.
- For new products: create product + create inventory row with `stock=0`, then optional `adjust_stock(+n)` if initial stock is needed.

## Error handling
- User-facing: short message
- Developer-facing: console.error with full context
