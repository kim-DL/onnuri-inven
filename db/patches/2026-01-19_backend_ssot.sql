-- 2026-01-19 backend SSOT patch (idempotent)
-- Canonical RLS/RPC/indexes for onnuri-inven.
-- Archived list uses direct SELECT; products_select_active_user must allow active users to read inactive rows.

-- =========================================================
-- 0) Core tables (app_settings)
-- =========================================================
create table if not exists public.app_settings (
  key text primary key,
  value_int int,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.app_settings enable row level security;

-- =========================================================
-- 1) Helper functions (canonical)
-- =========================================================
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users_profile up
    where up.user_id = auth.uid()
      and up.active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users_profile up
    where up.user_id = auth.uid()
      and up.active = true
      and up.role = 'admin'
  );
$$;

-- =========================================================
-- 2) Enable RLS
-- =========================================================
alter table public.zones enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.users_profile enable row level security;

-- =========================================================
-- 3) Drop existing policies (converge to SSOT)
-- =========================================================
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'zones',
        'products',
        'inventory',
        'inventory_logs',
        'users_profile',
        'app_settings'
      )
  loop
    execute format('drop policy if exists %I on public.%I;', p.policyname, p.tablename);
  end loop;
end $$;

-- =========================================================
-- 4) RLS policies (canonical)
-- =========================================================
create policy app_settings_select_active
on public.app_settings
for select
to authenticated
using (public.is_active_user());

create policy zones_select_active
on public.zones
for select
to authenticated
using (public.is_active_user());

create policy zones_admin_write
on public.zones
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy products_select_active_user
on public.products
for select
to authenticated
using (public.is_active_user());

create policy products_insert_staff_admin
on public.products
for insert
to authenticated
with check (public.is_active_user());

create policy products_update_staff_admin
on public.products
for update
to authenticated
using (public.is_active_user())
with check (public.is_active_user());

create policy inventory_select_active
on public.inventory
for select
to authenticated
using (public.is_active_user());

create policy inventory_insert_active_stock_zero
on public.inventory
for insert
to authenticated
with check (public.is_active_user() and stock = 0);

create policy inventory_logs_select_active
on public.inventory_logs
for select
to authenticated
using (public.is_active_user());

create policy users_profile_select_self
on public.users_profile
for select
to authenticated
using (auth.uid() = user_id);

create policy users_profile_select_admin
on public.users_profile
for select
to authenticated
using (public.is_admin());

create policy users_profile_update_admin
on public.users_profile
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy users_profile_insert_admin
on public.users_profile
for insert
to authenticated
with check (public.is_admin());

-- =========================================================
-- 5) Table privileges (tighten grants)
-- =========================================================
revoke all on public.app_settings from anon, authenticated;
revoke all on public.zones from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.inventory from anon, authenticated;
revoke all on public.inventory_logs from anon, authenticated;
revoke all on public.users_profile from anon, authenticated;

grant select on public.app_settings to authenticated;
grant select on public.zones to authenticated;
grant select on public.products to authenticated;
grant select on public.inventory to authenticated;
grant select on public.inventory_logs to authenticated;
grant select on public.users_profile to authenticated;

grant insert, update on public.products to authenticated;
grant insert on public.inventory to authenticated;
grant insert, update on public.users_profile to authenticated;

-- =========================================================
-- 6) RPC functions (canonical)
-- =========================================================
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_delta integer,
  p_note text default null
)
returns table (
  product_id uuid,
  before_stock integer,
  after_stock integer,
  delta integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before integer;
  v_after integer;
  v_zone_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  select p.zone_id
    into v_zone_id
  from public.products as p
  where p.id = p_product_id
    and p.active = true;

  if not found then
    raise exception 'product not found or inactive (product_id=%)', p_product_id;
  end if;

  select i.stock
    into v_before
  from public.inventory as i
  where i.product_id = p_product_id
  for update;

  if not found then
    raise exception 'inventory row not found for product_id=%', p_product_id;
  end if;

  v_after := v_before + p_delta;

  if v_after < 0 then
    raise exception 'stock cannot go below zero (before=%, delta=%)', v_before, p_delta;
  end if;

  update public.inventory as i
  set stock = v_after,
      updated_at = now(),
      updated_by = auth.uid()
  where i.product_id = p_product_id;

  insert into public.inventory_logs (
    product_id, zone_id, delta,
    before_stock, after_stock,
    note, created_by
  )
  values (
    p_product_id, v_zone_id, p_delta,
    v_before, v_after,
    p_note, auth.uid()
  );

  return query
  select
    p_product_id as product_id,
    v_before      as before_stock,
    v_after       as after_stock,
    p_delta       as delta,
    now()         as created_at;
end;
$$;

revoke all on function public.adjust_stock(uuid, integer, text) from public;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;

create or replace function public.update_product(
  p_product_id uuid,
  p_name text,
  p_zone_id uuid,
  p_manufacturer text default null,
  p_unit text default null,
  p_spec text default null,
  p_origin_country text default null,
  p_expiry_date date default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;

  if p_zone_id is null then
    raise exception 'zone required';
  end if;

  update public.products
  set name = trim(p_name),
      zone_id = p_zone_id,
      manufacturer = nullif(trim(coalesce(p_manufacturer, '')), ''),
      unit = nullif(trim(coalesce(p_unit, '')), ''),
      spec = nullif(trim(coalesce(p_spec, '')), ''),
      origin_country = nullif(trim(coalesce(p_origin_country, '')), ''),
      expiry_date = p_expiry_date,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_product_id
    and active = true;

  if not found then
    raise exception 'product not found or inactive';
  end if;
end;
$$;

revoke all on function public.update_product(uuid, text, uuid, text, text, text, text, date) from public;
grant execute on function public.update_product(uuid, text, uuid, text, text, text, text, date) to authenticated;

create or replace function public.archive_product(
  p_product_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason required';
  end if;

  update public.products
  set active = false,
      archived_reason = trim(p_reason),
      archived_at = now(),
      archived_by = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_product_id
    and active = true;

  if not found then
    raise exception 'product not found or already archived';
  end if;
end;
$$;

revoke all on function public.archive_product(uuid, text) from public;
grant execute on function public.archive_product(uuid, text) to authenticated;

create or replace function public.restore_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  update public.products
  set active = true,
      archived_reason = null,
      archived_at = null,
      archived_by = null,
      updated_at = now(),
      updated_by = v_user_id
  where id = p_product_id
    and active = false;

  if not found then
    raise exception 'not archived';
  end if;
end;
$$;

revoke all on function public.restore_product(uuid) from public;
grant execute on function public.restore_product(uuid) to authenticated;

create or replace function public.delete_product(
  p_product_id uuid,
  p_confirm_name text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_name text;
  v_active boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select name, active
    into v_name, v_active
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'not found';
  end if;

  if v_active then
    raise exception 'not archived';
  end if;

  if trim(lower(coalesce(p_confirm_name, ''))) <> trim(lower(v_name)) then
    raise exception 'name mismatch';
  end if;

  delete from public.inventory_logs where product_id = p_product_id;
  delete from public.products where id = p_product_id and active = false;

  if not found then
    raise exception 'not archived';
  end if;
end;
$$;

revoke all on function public.delete_product(uuid, text) from public;
grant execute on function public.delete_product(uuid, text) to authenticated;

create or replace function public.delete_product_admin(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  delete from public.inventory_logs
  where product_id = p_product_id;

  delete from public.inventory
  where product_id = p_product_id;

  delete from public.products
  where id = p_product_id;

  if not found then
    raise exception 'product not found';
  end if;
end;
$$;

revoke all on function public.delete_product_admin(uuid) from public;
grant execute on function public.delete_product_admin(uuid) to authenticated;

create or replace function public.list_archived_products(p_limit integer default 200)
returns table (
  id uuid,
  name text,
  manufacturer text,
  zone_name text,
  stock integer,
  archived_at timestamptz,
  archived_reason text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.name,
    coalesce(nullif(trim(p.manufacturer), ''), '') as manufacturer,
    coalesce(z.name, '') as zone_name,
    coalesce(i.stock, 0) as stock,
    p.archived_at,
    p.archived_reason
  from public.products p
  left join public.zones z on z.id = p.zone_id
  left join public.inventory i on i.product_id = p.id
  where public.is_active_user()
    and p.active = false
  order by p.archived_at desc nulls last, p.updated_at desc
  limit greatest(p_limit, 1);
$$;

revoke all on function public.list_archived_products(integer) from public;
grant execute on function public.list_archived_products(integer) to authenticated;

create or replace function public.get_expiry_warning_days()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  select value_int into v_days
  from public.app_settings
  where key = 'expiry_warning_days';

  if v_days is null then
    return 100;
  end if;

  return v_days;
end;
$$;

revoke all on function public.get_expiry_warning_days() from public;
grant execute on function public.get_expiry_warning_days() to authenticated;

create or replace function public.set_expiry_warning_days(p_days integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'invalid days';
  end if;

  insert into public.app_settings(key, value_int, updated_at, updated_by)
  values ('expiry_warning_days', p_days, now(), v_user)
  on conflict (key)
  do update set
    value_int = excluded.value_int,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.set_expiry_warning_days(integer) from public;
grant execute on function public.set_expiry_warning_days(integer) to authenticated;

create or replace function public.admin_list_user_profiles()
returns table (
  user_id uuid,
  display_name text,
  role text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  select
    up.user_id,
    up.display_name,
    up.role,
    up.active as is_active,
    up.created_at
  from public.users_profile up
  order by up.created_at desc;
end;
$$;

revoke all on function public.admin_list_user_profiles() from public;
grant execute on function public.admin_list_user_profiles() to authenticated;

create or replace function public.admin_set_user_active(
  p_user_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_user_id = auth.uid() and p_is_active = false then
    raise exception 'cannot deactivate self';
  end if;

  update public.users_profile
  set active = p_is_active
  where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_set_user_active(uuid, boolean) from public;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;

create or replace function public.admin_set_user_display_name(
  p_user_id uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  update public.users_profile
  set display_name = nullif(trim(p_display_name), '')
  where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_set_user_display_name(uuid, text) from public;
grant execute on function public.admin_set_user_display_name(uuid, text) to authenticated;

create or replace function public.get_inventory_logs_for_product(
  p_product_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  product_id uuid,
  zone_id uuid,
  delta integer,
  before_stock integer,
  after_stock integer,
  note text,
  created_at timestamptz,
  created_by uuid,
  actor_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  return query
  select
    l.id,
    l.product_id,
    l.zone_id,
    l.delta,
    l.before_stock,
    l.after_stock,
    l.note,
    l.created_at,
    l.created_by,
    nullif(trim(up.display_name), '') as actor_name
  from public.inventory_logs l
  left join public.users_profile up
    on up.user_id = l.created_by
  where l.product_id = p_product_id
  order by l.created_at desc
  limit greatest(1, least(p_limit, 200));
end;
$$;

revoke all on function public.get_inventory_logs_for_product(uuid, integer) from public;
grant execute on function public.get_inventory_logs_for_product(uuid, integer) to authenticated;
revoke execute on function public.get_inventory_logs_for_product(uuid, integer) from anon;

-- =========================================================
-- 7) Constraints (archive reason required for inactive products)
-- =========================================================
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'products_archive_reason_required'
      and c.conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_archive_reason_required
      check (active = true or archived_reason is not null);
  end if;
end $$;

-- =========================================================
-- 8) Canonical indexes (partial indexes already applied via SQL Editor)
-- =========================================================
create index if not exists idx_products_active_name_partial
  on public.products (name)
  where active = true;

create index if not exists idx_products_active_zone_name_partial
  on public.products (zone_id, name)
  where active = true;

create index if not exists idx_products_inactive_name_partial
  on public.products (name)
  where active = false;
