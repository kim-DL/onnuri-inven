# DB Live State — 2026-01-19

## Status

Unblocked: Live outputs were captured via Supabase SQL Editor on 2026-01-19. The earlier PostgREST metadata probing attempts were unsuccessful (kept below for traceability), but Task B requirements are now satisfied.

## Earlier attempts (resolved)

- Tried PostgREST access to `pg_policies` with service role credentials: `Invoke-RestMethod .../rest/v1/pg_policies?...` → 404.
- Tried PostgREST with `Accept-Profile=pg_catalog` to reach `pg_policies` → 406.
- Tried PostgREST path `pg_catalog.pg_policies` → 404.
- Tried PostgREST `pg_meta/tables` probe → PGRST125 invalid path.
- `psql --version` shows client not installed; even if present, DB password/connection info is not available.

## Acceptance checklist (Task B)

- [x] RLS policy query output captured for target tables.
[
  {
    "schemaname": "public",
    "tablename": "app_settings",
    "policyname": "app_settings_select_active",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "is_active_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "inventory",
    "policyname": "inventory_insert_active_stock_zero",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(is_active_user() AND (stock = 0))"
  },
  {
    "schemaname": "public",
    "tablename": "inventory",
    "policyname": "inventory_select_active",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "is_active_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "inventory_logs",
    "policyname": "inventory_logs_select_active",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "is_active_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "policyname": "products_insert_staff_admin",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "is_active_user()"
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "policyname": "products_select_active_user",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "is_active_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "policyname": "products_update_staff_admin",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "is_active_user()",
    "with_check": "is_active_user()"
  },
  {
    "schemaname": "public",
    "tablename": "users_profile",
    "policyname": "users_profile_insert_admin",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "users_profile",
    "policyname": "users_profile_select_admin",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "is_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "users_profile",
    "policyname": "users_profile_select_self",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "users_profile",
    "policyname": "users_profile_update_admin",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "zones",
    "policyname": "zones_admin_write",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "zones",
    "policyname": "zones_select_active",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "is_active_user()",
    "with_check": null
  }
]

- [x] Function definitions captured (`adjust_stock`, `is_admin`, `is_active_user`, etc.).
[
  {
    "proname": "adjust_stock",
    "args": "p_product_id uuid, p_delta integer, p_note text",
    "def": "CREATE OR REPLACE FUNCTION public.adjust_stock(p_product_id uuid, p_delta integer, p_note text DEFAULT NULL::text)\n RETURNS TABLE(product_id uuid, before_stock integer, after_stock integer, delta integer, created_at timestamp with time zone)\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\ndeclare\r\n  v_before integer;\r\n  v_after integer;\r\n  v_zone_id uuid;\r\nbegin\r\n  -- login check\r\n  if auth.uid() is null then\r\n    raise exception 'not authenticated';\r\n  end if;\r\n\r\n  -- active user check\r\n  if not public.is_active_user() then\r\n    raise exception 'inactive user';\r\n  end if;\r\n\r\n  -- product must exist and be active (server-side guard)\r\n  select p.zone_id\r\n    into v_zone_id\r\n  from public.products as p\r\n  where p.id = p_product_id\r\n    and p.active = true;\r\n\r\n  if not found then\r\n    raise exception 'product not found or inactive (product_id=%)', p_product_id;\r\n  end if;\r\n\r\n  -- lock inventory row and get current stock\r\n  select i.stock\r\n    into v_before\r\n  from public.inventory as i\r\n  where i.product_id = p_product_id\r\n  for update;\r\n\r\n  if not found then\r\n    raise exception 'inventory row not found for product_id=%', p_product_id;\r\n  end if;\r\n\r\n  v_after := v_before + p_delta;\r\n\r\n  if v_after < 0 then\r\n    raise exception 'stock cannot go below zero (before=%, delta=%)', v_before, p_delta;\r\n  end if;\r\n\r\n  -- update inventory\r\n  update public.inventory as i\r\n  set stock = v_after,\r\n      updated_at = now(),\r\n      updated_by = auth.uid()\r\n  where i.product_id = p_product_id;\r\n\r\n  -- insert log\r\n  insert into public.inventory_logs (\r\n    product_id, zone_id, delta,\r\n    before_stock, after_stock,\r\n    note, created_by\r\n  )\r\n  values (\r\n    p_product_id, v_zone_id, p_delta,\r\n    v_before, v_after,\r\n    p_note, auth.uid()\r\n  );\r\n\r\n  -- return row\r\n  return query\r\n  select\r\n    p_product_id as product_id,\r\n    v_before      as before_stock,\r\n    v_after       as after_stock,\r\n    p_delta       as delta,\r\n    now()         as created_at;\r\nend;\r\n$function$\n"
  },
  {
    "proname": "admin_list_user_profiles",
    "args": "",
    "def": "CREATE OR REPLACE FUNCTION public.admin_list_user_profiles()\n RETURNS TABLE(user_id uuid, display_name text, role text, is_active boolean, created_at timestamp with time zone)\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\nbegin\r\n  if auth.uid() is null then\r\n    raise exception 'not authenticated';\r\n  end if;\r\n\r\n  if not public.is_active_user() then\r\n    raise exception 'inactive user';\r\n  end if;\r\n\r\n  if not public.is_admin() then\r\n    raise exception 'admin only';\r\n  end if;\r\n\r\n  return query\r\n  select\r\n    up.user_id,\r\n    up.display_name,\r\n    up.role,\r\n    up.active as is_active,\r\n    up.created_at\r\n  from public.users_profile up\r\n  order by up.created_at desc;\r\nend;\r\n$function$\n"
  },
  {
    "proname": "admin_set_user_active",
    "args": "p_user_id uuid, p_is_active boolean",
    "def": "CREATE OR REPLACE FUNCTION public.admin_set_user_active(p_user_id uuid, p_is_active boolean)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\nbegin\r\n  if auth.uid() is null then\r\n    raise exception 'not authenticated';\r\n  end if;\r\n\r\n  if not public.is_active_user() then\r\n    raise exception 'inactive user';\r\n  end if;\r\n\r\n  if not public.is_admin() then\r\n    raise exception 'admin only';\r\n  end if;\r\n\r\n  if p_user_id = auth.uid() and p_is_active = false then\r\n    raise exception 'cannot deactivate self';\r\n  end if;\r\n\r\n  update public.users_profile\r\n  set active = p_is_active\r\n  where user_id = p_user_id;\r\nend;\r\n$function$\n"
  },
  {
    "proname": "archive_product",
    "args": "p_product_id uuid, p_reason text",
    "def": "CREATE OR REPLACE FUNCTION public.archive_product(p_product_id uuid, p_reason text)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\nbegin\r\n  if auth.uid() is null then\r\n    raise exception 'not authenticated';\r\n  end if;\r\n\r\n  if not public.is_active_user() then\r\n    raise exception 'inactive user';\r\n  end if;\r\n\r\n  if p_reason is null or length(trim(p_reason)) = 0 then\r\n    raise exception 'reason required';\r\n  end if;\r\n\r\n  update public.products\r\n  set active = false,\r\n      archived_reason = trim(p_reason),\r\n      archived_at = now(),\r\n      archived_by = auth.uid(),\r\n      updated_at = now(),\r\n      updated_by = auth.uid()\r\n  where id = p_product_id\r\n    and active = true;\r\n\r\n  if not found then\r\n    raise exception 'product not found or already archived';\r\n  end if;\r\nend;\r\n$function$\n"
  },
  {
    "proname": "delete_product",
    "args": "p_product_id uuid, p_confirm_name text",
    "def": "CREATE OR REPLACE FUNCTION public.delete_product(p_product_id uuid, p_confirm_name text)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\ndeclare\r\n  v_user_id uuid;\r\n  v_name text;\r\n  v_active boolean;\r\nbegin\r\n  v_user_id := auth.uid();\r\n  if v_user_id is null then\r\n    raise exception 'not authenticated';\r\n  end if;\r\n\r\n  if not public.is_admin() then\r\n    raise exception 'admin only';\r\n  end if;\r\n\r\n  select name, active\r\n    into v_name, v_active\r\n  from public.products\r\n  where id = p_product_id;\r\n\r\n  if not found then\r\n    raise exception 'not found';\r\n  end if;\r\n\r\n  if v_active then\r\n    raise exception 'not archived';\r\n  end if;\r\n\r\n  if trim(lower(coalesce(p_confirm_name, ''))) <> trim(lower(v_name)) then\r\n    raise exception 'name mismatch';\r\n  end if;\r\n\r\n  delete from public.inventory_logs where product_id = p_product_id;\r\n  delete from public.products where id = p_product_id and active = false;\r\n\r\n  if not found then\r\n    raise exception 'not archived';\r\n  end if;\r\nend;\r\n$function$\n"
  },
  {
    "proname": "delete_product_admin",
    "args": "p_product_id uuid",
    "def": "CREATE OR REPLACE FUNCTION public.delete_product_admin(p_product_id uuid)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\nbegin\r\n  if auth.uid() is null then\r\n    raise exception 'not authenticated';\r\n  end if;\r\n\r\n  if not public.is_admin() then\r\n    raise exception 'admin only';\r\n  end if;\r\n\r\n  -- logs 먼저\r\n  delete from public.inventory_logs\r\n  where product_id = p_product_id;\r\n\r\n  -- inventory 다음\r\n  delete from public.inventory\r\n  where product_id = p_product_id;\r\n\r\n  -- products 마지막\r\n  delete from public.products\r\n  where id = p_product_id;\r\n\r\n  if not found then\r\n    raise exception 'product not found';\r\n  end if;\r\nend;\r\n$function$\n"
  },
  {
    "proname": "get_expiry_warning_days",
    "args": "",
    "def": "CREATE OR REPLACE FUNCTION public.get_expiry_warning_days()\n RETURNS integer\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\ndeclare\r\n  v_days int;\r\nbegin\r\n  if auth.uid() is null then\r\n    raise exception 'not authenticated';\r\n  end if;\r\n\r\n  if not public.is_active_user() then\r\n    raise exception 'inactive user';\r\n  end if;\r\n\r\n  select value_int into v_days\r\n  from public.app_settings\r\n  where key = 'expiry_warning_days';\r\n\r\n  if v_days is null then\r\n    return 100;\r\n  end if;\r\n\r\n  return v_days;\r\nend;\r\n$function$\n"
  },
  {
    "proname": "is_active_user",
    "args": "",
    "def": "CREATE OR REPLACE FUNCTION public.is_active_user()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\n  select exists (\r\n    select 1\r\n    from public.users_profile up\r\n    where up.user_id = auth.uid()\r\n      and up.active = true\r\n  );\r\n$function$\n"
  },
  {
    "proname": "is_admin",
    "args": "",
    "def": "CREATE OR REPLACE FUNCTION public.is_admin()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\n  select exists (\r\n    select 1\r\n    from public.users_profile up\r\n    where up.user_id = auth.uid()\r\n      and up.active = true\r\n      and up.role = 'admin'\r\n  );\r\n$function$\n"
  },
  {
    "proname": "list_archived_products",
    "args": "p_limit integer",
    "def": "CREATE OR REPLACE FUNCTION public.list_archived_products(p_limit integer DEFAULT 200)\n RETURNS TABLE(id uuid, name text, manufacturer text, zone_name text, stock integer, archived_at timestamp with time zone, archived_reason text)\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\n  select\r\n    p.id,\r\n    p.name,\r\n    coalesce(nullif(trim(p.manufacturer), ''), '') as manufacturer,\r\n    coalesce(z.name, '') as zone_name,\r\n    coalesce(i.stock, 0) as stock,\r\n    p.archived_at,\r\n    p.archived_reason\r\n  from public.products p\r\n  left join public.zones z on z.id = p.zone_id\r\n  left join public.inventory i on i.product_id = p.id\r\n  where public.is_active_user()\r\n    and p.active = false\r\n  order by p.archived_at desc nulls last, p.updated_at desc\r\n  limit greatest(p_limit, 1);\r\n$function$\n"
  },
  {
    "proname": "restore_product",
    "args": "p_product_id uuid",
    "def": "CREATE OR REPLACE FUNCTION public.restore_product(p_product_id uuid)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\ndeclare\r\n  v_user_id uuid;\r\nbegin\r\n  v_user_id := auth.uid();\r\n  if v_user_id is null then\r\n    raise exception 'not authenticated';\r\n  end if;\r\n\r\n  if not public.is_active_user() then\r\n    raise exception 'inactive user';\r\n  end if;\r\n\r\n  update public.products\r\n  set active = true,\r\n      archived_reason = null,\r\n      archived_at = null,\r\n      archived_by = null,\r\n      updated_at = now(),\r\n      updated_by = v_user_id\r\n  where id = p_product_id\r\n    and active = false;\r\n\r\n  if not found then\r\n    raise exception 'not archived';\r\n  end if;\r\nend;\r\n$function$\n"
  },
  {
    "proname": "set_expiry_warning_days",
    "args": "p_days integer",
    "def": "CREATE OR REPLACE FUNCTION public.set_expiry_warning_days(p_days integer)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\ndeclare\r\n  v_user uuid;\r\nbegin\r\n  v_user := auth.uid();\r\n  if v_user is null then\r\n    raise exception 'not authenticated';\r\n  end if;\r\n\r\n  if not public.is_admin() then\r\n    raise exception 'admin only';\r\n  end if;\r\n\r\n  if p_days is null or p_days < 1 or p_days > 365 then\r\n    raise exception 'invalid days';\r\n  end if;\r\n\r\n  insert into public.app_settings(key, value_int, updated_at, updated_by)\r\n  values ('expiry_warning_days', p_days, now(), v_user)\r\n  on conflict (key)\r\n  do update set\r\n    value_int = excluded.value_int,\r\n    updated_at = excluded.updated_at,\r\n    updated_by = excluded.updated_by;\r\nend;\r\n$function$\n"
  },
  {
    "proname": "update_product",
    "args": "p_product_id uuid, p_name text, p_zone_id uuid, p_manufacturer text, p_unit text, p_spec text, p_origin_country text, p_expiry_date date",
    "def": "CREATE OR REPLACE FUNCTION public.update_product(p_product_id uuid, p_name text, p_zone_id uuid, p_manufacturer text DEFAULT NULL::text, p_unit text DEFAULT NULL::text, p_spec text DEFAULT NULL::text, p_origin_country text DEFAULT NULL::text, p_expiry_date date DEFAULT NULL::date)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'pg_temp'\nAS $function$\r\nbegin\r\n  if auth.uid() is null then\r\n    raise exception 'not authenticated';\r\n  end if;\r\n\r\n  if not public.is_active_user() then\r\n    raise exception 'inactive user';\r\n  end if;\r\n\r\n  if p_name is null or length(trim(p_name)) = 0 then\r\n    raise exception 'name required';\r\n  end if;\r\n\r\n  if p_zone_id is null then\r\n    raise exception 'zone required';\r\n  end if;\r\n\r\n  update public.products\r\n  set name = trim(p_name),\r\n      zone_id = p_zone_id,\r\n      manufacturer = nullif(trim(coalesce(p_manufacturer, '')), ''),\r\n      unit = nullif(trim(coalesce(p_unit, '')), ''),\r\n      spec = nullif(trim(coalesce(p_spec, '')), ''),\r\n      origin_country = nullif(trim(coalesce(p_origin_country, '')), ''),\r\n      expiry_date = p_expiry_date,\r\n      updated_at = now(),\r\n      updated_by = auth.uid()\r\n  where id = p_product_id\r\n    and active = true;\r\n\r\n  if not found then\r\n    raise exception 'product not found or inactive';\r\n  end if;\r\nend;\r\n$function$\n"
  }
]

- [x] Index list captured for products/inventory/inventory_logs.
[
  {
    "tablename": "inventory",
    "indexname": "inventory_pkey",
    "indexdef": "CREATE UNIQUE INDEX inventory_pkey ON public.inventory USING btree (product_id)"
  },
  {
    "tablename": "inventory_logs",
    "indexname": "idx_logs_product_created_at",
    "indexdef": "CREATE INDEX idx_logs_product_created_at ON public.inventory_logs USING btree (product_id, created_at DESC)"
  },
  {
    "tablename": "inventory_logs",
    "indexname": "idx_logs_zone_created_at",
    "indexdef": "CREATE INDEX idx_logs_zone_created_at ON public.inventory_logs USING btree (zone_id, created_at DESC)"
  },
  {
    "tablename": "inventory_logs",
    "indexname": "inventory_logs_pkey",
    "indexdef": "CREATE UNIQUE INDEX inventory_logs_pkey ON public.inventory_logs USING btree (id)"
  },
  {
    "tablename": "products",
    "indexname": "idx_products_zone_active",
    "indexdef": "CREATE INDEX idx_products_zone_active ON public.products USING btree (zone_id, active)"
  },
  {
    "tablename": "products",
    "indexname": "products_pkey",
    "indexdef": "CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id)"
  }
]

## Next step

Proceed to Task C (EXPLAIN evidence) per `docs/todaywork.md`.
