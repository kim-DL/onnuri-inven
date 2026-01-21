-- 2026-01-21 dashboard recent activity RPC

create or replace function public.list_recent_inventory_activity(
  p_limit integer default 20,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid,
  product_id uuid,
  product_name text,
  delta integer,
  note text,
  created_at timestamptz,
  created_by uuid,
  actor_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  v_limit := greatest(1, least(p_limit, 200));

  return query
  select
    l.id,
    l.product_id,
    p.name as product_name,
    l.delta,
    l.note,
    l.created_at,
    l.created_by,
    nullif(trim(up.display_name), '') as actor_name
  from public.inventory_logs l
  join public.products p on p.id = l.product_id
  left join public.users_profile up on up.user_id = l.created_by
  where (p_from is null or l.created_at >= p_from)
    and (p_to is null or l.created_at <= p_to)
  order by l.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.list_recent_inventory_activity(integer, timestamptz, timestamptz) from public;
grant execute on function public.list_recent_inventory_activity(integer, timestamptz, timestamptz) to authenticated;
