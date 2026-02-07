-- 2026-02-07 add products.memo column for product detail memo sheet

alter table public.products
  add column if not exists memo text;
