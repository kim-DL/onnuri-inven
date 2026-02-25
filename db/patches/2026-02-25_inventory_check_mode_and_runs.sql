-- 2026-02-25 inventory check mode + check run + audit trail hardening
-- Adds run-based inventory checking context and check action logging.

-- =========================================================
-- 0) Schema changes
-- =========================================================
create table if not exists public.inventory_check_mode_settings (
  id boolean primary key default true,
  override_mode text not null default 'AUTO',
  auto_days smallint[] not null default array[5]::smallint[],
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (id = true)
);

create table if not exists public.inventory_check_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  mode_source text not null,
  created_by uuid,
  ended_by uuid,
  ended_reason text
);

alter table public.inventory_logs
  add column if not exists check_run_id uuid;

alter table public.products
  add column if not exists last_inventory_checked_at timestamptz;

-- =========================================================
-- 1) Constraints / indexes
-- =========================================================
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_check_mode_settings_override_mode_check'
      and conrelid = 'public.inventory_check_mode_settings'::regclass
  ) then
    alter table public.inventory_check_mode_settings
      add constraint inventory_check_mode_settings_override_mode_check
      check (override_mode in ('AUTO', 'FORCE_ON', 'FORCE_OFF'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_check_runs_mode_source_check'
      and conrelid = 'public.inventory_check_runs'::regclass
  ) then
    alter table public.inventory_check_runs
      add constraint inventory_check_runs_mode_source_check
      check (mode_source in ('AUTO', 'FORCE_ON'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_check_runs_ended_reason_check'
      and conrelid = 'public.inventory_check_runs'::regclass
  ) then
    alter table public.inventory_check_runs
      add constraint inventory_check_runs_ended_reason_check
      check (
        ended_reason is null
        or ended_reason in ('AUTO_MIDNIGHT', 'ADMIN_STOP', 'MODE_OFF')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_logs_check_run_id_fkey'
      and conrelid = 'public.inventory_logs'::regclass
  ) then
    alter table public.inventory_logs
      add constraint inventory_logs_check_run_id_fkey
      foreign key (check_run_id)
      references public.inventory_check_runs(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists idx_inventory_check_runs_single_open
  on public.inventory_check_runs ((1))
  where ended_at is null;

create index if not exists idx_inventory_check_runs_started_desc
  on public.inventory_check_runs (started_at desc);

create index if not exists idx_inventory_check_runs_ended_reason_date
  on public.inventory_check_runs (ended_reason, ended_at desc);

create index if not exists idx_inventory_logs_check_run_product
  on public.inventory_logs (check_run_id, product_id, created_at desc);

create index if not exists idx_products_last_inventory_checked_at
  on public.products (last_inventory_checked_at desc nulls last);

-- =========================================================
-- 2) RLS / grants
-- =========================================================
alter table public.inventory_check_mode_settings enable row level security;
alter table public.inventory_check_runs enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('inventory_check_mode_settings', 'inventory_check_runs')
  loop
    execute format('drop policy if exists %I on public.%I;', p.policyname, p.tablename);
  end loop;
end $$;

create policy inventory_check_mode_settings_select_active
on public.inventory_check_mode_settings
for select
to authenticated
using (public.is_active_user());

create policy inventory_check_mode_settings_admin_write
on public.inventory_check_mode_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy inventory_check_runs_select_active
on public.inventory_check_runs
for select
to authenticated
using (public.is_active_user());

revoke all on public.inventory_check_mode_settings from anon, authenticated;
revoke all on public.inventory_check_runs from anon, authenticated;

grant select on public.inventory_check_mode_settings to authenticated;
grant select on public.inventory_check_runs to authenticated;
grant insert, update on public.inventory_check_mode_settings to authenticated;

-- =========================================================
-- 3) RPCs
-- =========================================================
create or replace function public.get_inventory_check_context()
returns table (
  mode_enabled boolean,
  mode_source text,
  active_run_id uuid,
  active_run_started_at timestamptz,
  override_mode text,
  auto_days smallint[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_now timestamptz;
  v_override text;
  v_days smallint[];
  v_kst_date date;
  v_kst_dow integer;
  v_policy_enabled boolean;
  v_active_run_id uuid;
  v_active_run_started_at timestamptz;
  v_active_run_source text;
  v_stopped_today boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  v_now := now();
  v_kst_date := (v_now at time zone 'Asia/Seoul')::date;

  insert into public.inventory_check_mode_settings (
    id,
    override_mode,
    auto_days,
    updated_at,
    updated_by
  )
  values (true, 'AUTO', array[5]::smallint[], v_now, v_user_id)
  on conflict (id) do nothing;

  -- Safety valve: close stale open runs at KST day rollover.
  update public.inventory_check_runs
  set ended_at = v_now,
      ended_by = null,
      ended_reason = 'AUTO_MIDNIGHT'
  where ended_at is null
    and (started_at at time zone 'Asia/Seoul')::date < v_kst_date;

  select s.override_mode, s.auto_days
    into v_override, v_days
  from public.inventory_check_mode_settings s
  where s.id = true;

  v_override := coalesce(v_override, 'AUTO');

  select coalesce(array_agg(distinct d order by d), array[]::smallint[])
    into v_days
  from unnest(coalesce(v_days, array[]::smallint[])) as d
  where d between 0 and 6;

  if v_override = 'FORCE_ON' then
    v_policy_enabled := true;
  elsif v_override = 'FORCE_OFF' then
    v_policy_enabled := false;
  else
    v_kst_dow := extract(dow from (v_now at time zone 'Asia/Seoul'))::integer;
    v_policy_enabled := v_kst_dow = any(v_days);
  end if;

  select r.id, r.started_at, r.mode_source
    into v_active_run_id, v_active_run_started_at, v_active_run_source
  from public.inventory_check_runs r
  where r.ended_at is null
  order by r.started_at desc
  limit 1;

  if not v_policy_enabled and v_active_run_id is not null then
    update public.inventory_check_runs
    set ended_at = v_now,
        ended_by = null,
        ended_reason = 'MODE_OFF'
    where id = v_active_run_id
      and ended_at is null;

    v_active_run_id := null;
    v_active_run_started_at := null;
    v_active_run_source := null;
  end if;

  if v_policy_enabled and v_active_run_id is null then
    if v_override = 'AUTO' then
      select exists (
        select 1
        from public.inventory_check_runs r
        where r.ended_reason = 'ADMIN_STOP'
          and (coalesce(r.ended_at, r.started_at) at time zone 'Asia/Seoul')::date = v_kst_date
        order by coalesce(r.ended_at, r.started_at) desc
        limit 1
      )
        into v_stopped_today;
    else
      v_stopped_today := false;
    end if;

    if not coalesce(v_stopped_today, false) then
      insert into public.inventory_check_runs as r (
        started_at,
        mode_source,
        created_by
      )
      values (
        v_now,
        case when v_override = 'FORCE_ON' then 'FORCE_ON' else 'AUTO' end,
        v_user_id
      )
      returning r.id, r.started_at, r.mode_source
      into v_active_run_id, v_active_run_started_at, v_active_run_source;
    end if;
  end if;

  mode_enabled := v_active_run_id is not null;
  mode_source := case
    when v_active_run_id is not null then v_active_run_source
    when v_override = 'FORCE_OFF' then 'FORCE_OFF'
    else null
  end;
  active_run_id := v_active_run_id;
  active_run_started_at := v_active_run_started_at;
  override_mode := v_override;
  auto_days := v_days;
  return next;
end;
$$;

revoke all on function public.get_inventory_check_context() from public;
grant execute on function public.get_inventory_check_context() to authenticated;

create or replace function public.set_inventory_check_mode_settings(
  p_override_mode text,
  p_auto_days smallint[]
)
returns table (
  mode_enabled boolean,
  mode_source text,
  active_run_id uuid,
  active_run_started_at timestamptz,
  override_mode text,
  auto_days smallint[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_override text;
  v_days smallint[];
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  v_override := upper(trim(coalesce(p_override_mode, '')));
  if v_override not in ('AUTO', 'FORCE_ON', 'FORCE_OFF') then
    raise exception 'invalid override mode';
  end if;

  select coalesce(array_agg(distinct d order by d), array[]::smallint[])
    into v_days
  from unnest(coalesce(p_auto_days, array[]::smallint[])) as d
  where d between 0 and 6;

  insert into public.inventory_check_mode_settings (
    id,
    override_mode,
    auto_days,
    updated_at,
    updated_by
  )
  values (true, v_override, v_days, now(), v_user_id)
  on conflict (id)
  do update set
    override_mode = excluded.override_mode,
    auto_days = excluded.auto_days,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  return query
  select *
  from public.get_inventory_check_context();
end;
$$;

revoke all on function public.set_inventory_check_mode_settings(text, smallint[]) from public;
grant execute on function public.set_inventory_check_mode_settings(text, smallint[]) to authenticated;

create or replace function public.end_active_inventory_check_run()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_rows integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  update public.inventory_check_runs
  set ended_at = now(),
      ended_by = v_user_id,
      ended_reason = 'ADMIN_STOP'
  where ended_at is null;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.end_active_inventory_check_run() from public;
grant execute on function public.end_active_inventory_check_run() to authenticated;

create or replace function public.list_checked_products_for_active_run()
returns table (product_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  select *
    into v_context
  from public.get_inventory_check_context();

  if v_context.active_run_id is null then
    return;
  end if;

  return query
  select distinct l.product_id
  from public.inventory_logs l
  join public.products p
    on p.id = l.product_id
  where l.check_run_id = v_context.active_run_id
    and p.active = true;
end;
$$;

revoke all on function public.list_checked_products_for_active_run() from public;
grant execute on function public.list_checked_products_for_active_run() to authenticated;

create or replace function public.mark_inventory_checked(
  p_product_id uuid
)
returns table (
  product_id uuid,
  before_stock integer,
  after_stock integer,
  delta integer,
  created_at timestamptz,
  check_run_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_zone_id uuid;
  v_stock integer;
  v_context record;
  v_now timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  select *
    into v_context
  from public.get_inventory_check_context();

  if v_context.active_run_id is null then
    raise exception 'check mode inactive';
  end if;

  select p.zone_id
    into v_zone_id
  from public.products p
  where p.id = p_product_id
    and p.active = true;

  if not found then
    raise exception 'product not found or inactive (product_id=%)', p_product_id;
  end if;

  select i.stock
    into v_stock
  from public.inventory i
  where i.product_id = p_product_id
  for update;

  if not found then
    raise exception 'inventory row not found for product_id=%', p_product_id;
  end if;

  v_now := now();

  insert into public.inventory_logs (
    product_id,
    zone_id,
    delta,
    before_stock,
    after_stock,
    note,
    created_by,
    check_run_id
  )
  values (
    p_product_id,
    v_zone_id,
    0,
    v_stock,
    v_stock,
    'CHECK_OK',
    auth.uid(),
    v_context.active_run_id
  );

  update public.products
  set last_inventory_checked_at = v_now
  where id = p_product_id;

  return query
  select
    p_product_id,
    v_stock,
    v_stock,
    0,
    v_now,
    v_context.active_run_id;
end;
$$;

revoke all on function public.mark_inventory_checked(uuid) from public;
grant execute on function public.mark_inventory_checked(uuid) to authenticated;

-- Re-define adjust_stock to write check_run_id + last_inventory_checked_at.
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
  v_now timestamptz;
  v_context record;
  v_check_run_id uuid;
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

  select *
    into v_context
  from public.get_inventory_check_context();

  v_check_run_id := v_context.active_run_id;
  v_now := now();

  update public.inventory as i
  set stock = v_after,
      updated_at = v_now,
      updated_by = auth.uid()
  where i.product_id = p_product_id;

  insert into public.inventory_logs (
    product_id,
    zone_id,
    delta,
    before_stock,
    after_stock,
    note,
    created_by,
    check_run_id
  )
  values (
    p_product_id,
    v_zone_id,
    p_delta,
    v_before,
    v_after,
    p_note,
    auth.uid(),
    v_check_run_id
  );

  update public.products
  set last_inventory_checked_at = v_now
  where id = p_product_id;

  return query
  select
    p_product_id as product_id,
    v_before as before_stock,
    v_after as after_stock,
    p_delta as delta,
    v_now as created_at;
end;
$$;

revoke all on function public.adjust_stock(uuid, integer, text) from public;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;
