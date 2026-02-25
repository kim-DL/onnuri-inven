-- 2026-02-25 hotfix: resolve ambiguous mode_source in get_inventory_check_context()
-- Symptom:
--   column reference "mode_source" is ambiguous (SQLSTATE 42702)

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
