-- 2026-02-11 atomic product creation + race-safe absolute stock adjust RPCs

create or replace function public.create_product_with_inventory(
  p_name text,
  p_zone_id uuid,
  p_manufacturer text default null,
  p_unit text default null,
  p_spec text default null,
  p_origin_country text default null,
  p_expiry_date date default null,
  p_initial_qty integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_id uuid;
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

  if p_initial_qty is null or p_initial_qty < 0 then
    raise exception 'initial_qty invalid';
  end if;

  insert into public.products (
    name,
    zone_id,
    manufacturer,
    unit,
    spec,
    origin_country,
    expiry_date,
    active
  )
  values (
    trim(p_name),
    p_zone_id,
    nullif(trim(coalesce(p_manufacturer, '')), ''),
    nullif(trim(coalesce(p_unit, '')), ''),
    nullif(trim(coalesce(p_spec, '')), ''),
    nullif(trim(coalesce(p_origin_country, '')), ''),
    p_expiry_date,
    true
  )
  returning id into v_product_id;

  insert into public.inventory (product_id, stock)
  values (v_product_id, 0);

  if p_initial_qty > 0 then
    perform public.adjust_stock(v_product_id, p_initial_qty, null);
  end if;

  return v_product_id;
end;
$$;

revoke all on function public.create_product_with_inventory(text, uuid, text, text, text, text, date, integer) from public;
grant execute on function public.create_product_with_inventory(text, uuid, text, text, text, text, date, integer) to authenticated;


create or replace function public.adjust_stock_to(
  p_product_id uuid,
  p_target_stock integer,
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
  v_delta integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_user() then
    raise exception 'inactive user';
  end if;

  if p_target_stock is null or p_target_stock < 0 then
    raise exception 'target stock invalid';
  end if;

  perform 1
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

  v_delta := p_target_stock - v_before;

  return query
  select *
  from public.adjust_stock(
    p_product_id,
    v_delta,
    coalesce(nullif(trim(coalesce(p_note, '')), ''), 'ADJUST')
  );
end;
$$;

revoke all on function public.adjust_stock_to(uuid, integer, text) from public;
grant execute on function public.adjust_stock_to(uuid, integer, text) to authenticated;
