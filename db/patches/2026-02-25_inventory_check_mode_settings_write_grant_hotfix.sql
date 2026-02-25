-- 2026-02-25 hotfix: allow admin direct upsert fallback on inventory_check_mode_settings
-- Safe to run multiple times.

alter table if exists public.inventory_check_mode_settings
  enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'inventory_check_mode_settings'
      and c.relkind = 'r'
  ) then
    grant select, insert, update on public.inventory_check_mode_settings to authenticated;
  end if;
end $$;
