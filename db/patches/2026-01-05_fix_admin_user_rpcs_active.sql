-- Patch: Fix admin user management RPCs to match users_profile column name
-- Issue: users_profile uses `active` (boolean), but RPCs referenced `is_active`
-- Date: 2026-01-05
-- Applies to: public.admin_list_user_profiles, public.admin_set_user_active

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
