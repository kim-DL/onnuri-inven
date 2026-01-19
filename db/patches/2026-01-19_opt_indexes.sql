-- 2026-01-19 optional index optimizations (idempotent)
-- Covers frequent read patterns from /products list and archived list RPC.

create index if not exists idx_products_active_name_partial
  on public.products (name)
  where active = true;

-- Improve zone-filtered browsing ordered by name (client filters zone_id after fetch).
create index if not exists idx_products_active_zone_name_partial
  on public.products (zone_id, name)
  where active = true;

-- Speed archived list (active=false) ordered by name (matches ArchivedProductsClient products query).
create index if not exists idx_products_inactive_name_partial
  on public.products (name)
  where active = false;
