# Data Dictionary

## Tables (key columns)

### products
- id (uuid, pk)
- name (text, not null)
- zone_id (uuid, fk -> zones.id)
- manufacturer (text, nullable)
- unit (text, nullable)
- spec (text, nullable)
- origin_country (text, nullable)
- expiry_date (date, nullable)
- photo_url (text, nullable)
- active (bool, default true)
- archived_reason (text, nullable)

### zones
- id (uuid, pk)
- name (text: 냉동1/냉동2/냉장/상온)
- sort_order (int)
- active (bool)

### inventory
- product_id (uuid, pk, fk -> products.id)
- stock (int, not null)
- updated_at (timestamptz)
- updated_by (uuid)

### inventory_logs
- id (uuid, pk)
- product_id (uuid, fk -> products.id)
- zone_id (uuid, nullable)
- delta (int, not null)
- before_stock (int, not null)
- after_stock (int, not null)
- created_at (timestamptz, not null)
- created_by (uuid, nullable)
- note (text, nullable)

### users_profile
- user_id (uuid, pk, fk -> auth.users.id)
- role (text: admin | staff)
- active (bool, default true)
- display_name (text, nullable)

## Relationships
- products.zone_id -> zones.id
- inventory.product_id -> products.id
- inventory_logs.product_id -> products.id
- users_profile.user_id -> auth.users.id

## Invariants / guardrails
- Do not update `inventory.stock` directly in app code.
- Stock changes must go through RPC: `public.adjust_stock`.
- No delete UX; archive via `products.active=false` and `archived_reason`.
- List state is URL query params only (no localStorage).

## RPC: public.adjust_stock
```text
inputs: p_product_id uuid, p_delta int, p_note text (nullable)
```
- IN: `p_delta = +qty`
- OUT: `p_delta = -qty`
- Rejects negative stock (after_stock < 0)
- Logs every change in `inventory_logs`

## RLS note
- All reads/writes respect RLS policies.
- Never use service role key in client code.
