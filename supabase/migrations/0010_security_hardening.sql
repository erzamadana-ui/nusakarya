-- =====================================================================
-- 0010_security_hardening.sql — fixes from get_advisors(security)
-- =====================================================================

-- 1) set_updated_at() and fn_derive_ter_category() lacked a pinned
--    search_path (function_search_path_mutable warning).
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function fn_derive_ter_category()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.ter_category := case
    when new.ptkp_status in ('TK/0','TK/1','TK/2','K/0') then 'A'
    when new.ptkp_status in ('TK/3','K/1','K/2') then 'B'
    when new.ptkp_status in ('K/3') then 'C'
    else new.ter_category
  end;
  return new;
end;
$$;

-- 2) next_doc_no() and fn_sla_recalc() are SECURITY DEFINER, take an
--    argument and are exposed as RPC to anon/authenticated. Add explicit
--    tenant-ownership checks so a caller cannot mint doc numbers for, or
--    recalc SLA on, a company/ticket that is not their own.
create or replace function next_doc_no(p_company uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year int := extract(year from now())::int;
  v_last int;
  v_no text;
begin
  if not is_super() and p_company is distinct from auth_company_id() then
    raise exception 'not authorized for this company';
  end if;

  insert into doc_sequences (company_id, prefix, year, last_no)
  values (p_company, p_prefix, v_year, 1)
  on conflict (company_id, prefix, year)
  do update set last_no = doc_sequences.last_no + 1
  returning last_no into v_last;

  v_no := p_prefix || '/' || v_year::text || '/' || lpad(v_last::text, 5, '0');
  return v_no;
end;
$$;

create or replace function fn_sla_recalc(p_ticket uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket tickets%rowtype;
  v_paused_minutes numeric := 0;
  v_end timestamptz;
  v_ttr numeric;
  v_status text;
  v_pause_at timestamptz;
  ev record;
begin
  select * into v_ticket from tickets where id = p_ticket;
  if not found then
    return;
  end if;

  if not is_super() and v_ticket.company_id is distinct from auth_company_id() then
    raise exception 'not authorized for this ticket';
  end if;

  v_end := coalesce(v_ticket.resolved_at, now());

  v_pause_at := null;
  for ev in
    select event_type, event_at
    from ticket_sla_events
    where ticket_id = p_ticket
    order by event_at asc
  loop
    if ev.event_type = 'pause' then
      v_pause_at := ev.event_at;
    elsif ev.event_type = 'resume' and v_pause_at is not null then
      v_paused_minutes := v_paused_minutes + extract(epoch from (ev.event_at - v_pause_at)) / 60.0;
      v_pause_at := null;
    end if;
  end loop;

  if v_pause_at is not null then
    v_paused_minutes := v_paused_minutes + extract(epoch from (v_end - v_pause_at)) / 60.0;
  end if;

  v_ttr := extract(epoch from (v_end - v_ticket.reported_at)) / 60.0 - v_paused_minutes;
  if v_ttr < 0 then
    v_ttr := 0;
  end if;

  if v_ticket.resolved_at is not null then
    if v_ticket.sla_minutes is not null and v_ttr <= v_ticket.sla_minutes then
      v_status := 'met';
    else
      v_status := 'breach';
    end if;
  else
    if v_ticket.sla_due_at is not null and now() > v_ticket.sla_due_at then
      v_status := 'breach';
    elsif v_ticket.sla_due_at is not null and now() > v_ticket.sla_due_at - interval '30 minutes' then
      v_status := 'warning';
    else
      v_status := 'on_track';
    end if;
  end if;

  update tickets
    set ttr_minutes = round(v_ttr)::int,
        sla_status = v_status
    where id = p_ticket;
end;
$$;

-- 3) trigger-only functions should never be reachable via a direct RPC
--    call. Postgres already blocks calling a "returns trigger" function
--    outside trigger context, but tighten grants for defense in depth.
revoke execute on function fn_audit() from public, anon, authenticated;
revoke execute on function fn_gr_items_apply() from public, anon, authenticated;
revoke execute on function fn_stock_movement_apply() from public, anon, authenticated;
revoke execute on function fn_wo_done_productivity() from public, anon, authenticated;

-- 4) anonymous (unauthenticated) callers have no profile row, so these
--    helper/business functions are useless to them; close that surface.
--    authenticated keeps EXECUTE since RLS policies invoke them as the
--    querying user.
revoke execute on function next_doc_no(uuid, text) from anon;
revoke execute on function fn_sla_recalc(uuid) from anon;
revoke execute on function auth_company_id() from anon;
revoke execute on function auth_role() from anon;
revoke execute on function auth_employee_id() from anon;
revoke execute on function is_super() from anon;
revoke execute on function can_read(text) from anon;
revoke execute on function can_write(text) from anon;
revoke execute on function can_approve(text) from anon;
