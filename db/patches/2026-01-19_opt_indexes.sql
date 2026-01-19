-- 2026-01-19 optional index optimizations (idempotent)
-- Covers frequent read patterns from /products list and archived list RPC.

-- Support active products listing ordered by name without full sort.
create index if not exists idx_products_active_name
  on public.products (active, name);

-- Speed archived list (active=false) ordered by archived_at/updated_at; matches list_archived_products RPC.
create index if not exists idx_products_archived_at_desc
  on public.products (archived_at desc nulls last, updated_at desc)
  where active = false;
