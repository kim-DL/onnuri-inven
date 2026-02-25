-- 2026-02-25 inventory check mode + run verification queries
-- Run this in Supabase SQL Editor AFTER applying:
--   db/patches/2026-02-25_inventory_check_mode_and_runs.sql

-- =========================================================
-- 1) Schema existence check
-- =========================================================
select
  to_regclass('public.inventory_check_mode_settings') as inventory_check_mode_settings_table,
  to_regclass('public.inventory_check_runs') as inventory_check_runs_table;

select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'inventory_logs' and column_name = 'check_run_id')
    or (table_name = 'products' and column_name = 'last_inventory_checked_at')
  )
order by table_name, column_name;

-- =========================================================
-- 2) Constraint / index check
-- =========================================================
select
  conname,
  conrelid::regclass as table_name
from pg_constraint
where conname in (
  'inventory_check_mode_settings_override_mode_check',
  'inventory_check_runs_mode_source_check',
  'inventory_check_runs_ended_reason_check',
  'inventory_logs_check_run_id_fkey'
)
order by conname;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_inventory_check_runs_single_open',
    'idx_inventory_check_runs_started_desc',
    'idx_inventory_check_runs_ended_reason_date',
    'idx_inventory_logs_check_run_product',
    'idx_products_last_inventory_checked_at'
  )
order by indexname;

-- =========================================================
-- 3) Policy / privilege check
-- =========================================================
select
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in ('inventory_check_mode_settings', 'inventory_check_runs')
order by tablename, policyname;

select
  table_name,
  has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') as auth_select_granted,
  has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT') as auth_insert_granted,
  has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE') as auth_update_granted
from (
  values
    ('inventory_check_mode_settings'),
    ('inventory_check_runs')
) as t(table_name);

with fn(sig) as (
  values
    ('public.get_inventory_check_context()'),
    ('public.set_inventory_check_mode_settings(text,smallint[])'),
    ('public.end_active_inventory_check_run()'),
    ('public.list_checked_products_for_active_run()'),
    ('public.mark_inventory_checked(uuid)'),
    ('public.adjust_stock(uuid,integer,text)')
)
select
  sig,
  has_function_privilege('authenticated', sig, 'EXECUTE') as auth_execute_granted
from fn;

-- =========================================================
-- 4) Helper lookup for test IDs
-- =========================================================
-- Pick one active admin and one active staff for smoke tests.
select
  user_id,
  display_name,
  role,
  active
from public.users_profile
where active = true
order by
  case role when 'admin' then 0 else 1 end,
  created_at;

-- Pick one active product for mark_inventory_checked smoke test.
select
  p.id,
  p.name,
  p.active,
  coalesce(i.stock, 0) as stock
from public.products p
left join public.inventory i on i.product_id = p.id
where p.active = true
order by p.updated_at desc nulls last, p.created_at desc
limit 20;

-- =========================================================
-- 5) Smoke test (ROLLBACK SAFE)
-- =========================================================
-- IMPORTANT:
-- 1) Replace the UUID placeholders below.
-- 2) This block writes data, then rolls back everything.

begin;

-- Replace these placeholders before running.
-- Example:
-- select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
-- select set_config('request.jwt.claim.role', 'authenticated', true);

-- [A] Simulate admin session.
select set_config('request.jwt.claim.sub', 'REPLACE_ADMIN_USER_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 1) Read current context.
select * from public.get_inventory_check_context();

-- 2) Save mode settings (AUTO / FORCE_ON / FORCE_OFF).
select *
from public.set_inventory_check_mode_settings(
  'FORCE_ON',
  array[5]::smallint[]
);

-- 3) Confirm active run exists.
select * from public.get_inventory_check_context();

-- [B] Simulate staff/admin session for check action.
-- You may keep admin UUID here, or switch to active staff UUID.
select set_config('request.jwt.claim.sub', 'REPLACE_STAFF_OR_ADMIN_USER_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 4) Confirm stock check action logs CHECK_OK without stock delta.
select *
from public.mark_inventory_checked('REPLACE_ACTIVE_PRODUCT_UUID'::uuid);

-- 5) Verify latest log row includes CHECK_OK and check_run_id.
select
  l.id,
  l.product_id,
  l.delta,
  l.before_stock,
  l.after_stock,
  l.note,
  l.check_run_id,
  l.created_by,
  l.created_at
from public.inventory_logs l
where l.product_id = 'REPLACE_ACTIVE_PRODUCT_UUID'::uuid
order by l.created_at desc
limit 5;

-- [C] Switch back to admin and end run.
select set_config('request.jwt.claim.sub', 'REPLACE_ADMIN_USER_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.end_active_inventory_check_run() as ended;

select
  r.id,
  r.started_at,
  r.ended_at,
  r.mode_source,
  r.ended_reason,
  r.created_by,
  r.ended_by
from public.inventory_check_runs r
order by r.started_at desc
limit 5;

rollback;

-- =========================================================
-- 6) Midnight safety guard quick check
-- =========================================================
-- Expect 0 rows AFTER calling get_inventory_check_context() at least once today.
select
  r.id,
  r.started_at,
  r.ended_at,
  (r.started_at at time zone 'Asia/Seoul')::date as started_kst_date
from public.inventory_check_runs r
where r.ended_at is null
  and (r.started_at at time zone 'Asia/Seoul')::date < (now() at time zone 'Asia/Seoul')::date;
