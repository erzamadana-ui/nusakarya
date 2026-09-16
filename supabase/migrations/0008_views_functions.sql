-- =====================================================================
-- 0008_views_functions.sql — Dashboard views, analytics, triggers
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_dashboard_hr
-- ---------------------------------------------------------------------
create view v_dashboard_hr with (security_invoker = on) as
select
  e.company_id,
  e.unit,
  e.branch_id,
  b.name as branch_name,
  count(*) filter (where e.status = 'aktif') as headcount_aktif,
  count(*) filter (where e.contract_end is not null and e.contract_end between current_date and current_date + interval '60 days') as contracts_expiring_60d,
  count(*) filter (where ec.expiry_date is not null and ec.expiry_date < current_date) as certifications_expired,
  count(*) filter (where a.work_date = current_date and a.status = 'hadir') as hadir_hari_ini,
  count(*) filter (where a.work_date = current_date and a.status = 'terlambat') as terlambat_hari_ini,
  count(*) filter (where a.work_date = current_date and a.status = 'alpa') as alpa_hari_ini
from employees e
left join branches b on b.id = e.branch_id
left join employee_certifications ec on ec.employee_id = e.id
left join attendances a on a.employee_id = e.id and a.work_date = current_date
group by e.company_id, e.unit, e.branch_id, b.name;

-- ---------------------------------------------------------------------
-- v_dashboard_productivity
-- ---------------------------------------------------------------------
create view v_dashboard_productivity with (security_invoker = on) as
select
  pe.company_id,
  pe.employee_id,
  e.full_name as employee_name,
  to_char(pe.work_date, 'YYYY-MM') as period_code,
  sum(pe.points) as total_points,
  sum(pe.amount) as total_amount,
  coalesce(pt.target_points, 0) as target_points,
  case when coalesce(pt.target_points, 0) > 0
       then round(sum(pe.points) / pt.target_points * 100, 2)
       else null end as achievement_percent
from productivity_entries pe
join employees e on e.id = pe.employee_id
left join productivity_targets pt
  on pt.employee_id = pe.employee_id
  and pt.period_code = to_char(pe.work_date, 'YYYY-MM')
  and pt.company_id = pe.company_id
group by pe.company_id, pe.employee_id, e.full_name, to_char(pe.work_date, 'YYYY-MM'), pt.target_points;

-- ---------------------------------------------------------------------
-- v_dashboard_procurement
-- ---------------------------------------------------------------------
create view v_dashboard_procurement with (security_invoker = on) as
select
  company_id,
  'pr_status' as metric,
  status as bucket,
  count(*) as cnt,
  sum(total_estimate) as amount
from purchase_requests
group by company_id, status
union all
select
  company_id,
  'po_status' as metric,
  status as bucket,
  count(*) as cnt,
  sum(total) as amount
from purchase_orders
group by company_id, status
union all
select
  company_id,
  'po_this_month' as metric,
  to_char(po_date, 'YYYY-MM') as bucket,
  count(*) as cnt,
  sum(total) as amount
from purchase_orders
where date_trunc('month', po_date) = date_trunc('month', current_date)
group by company_id, to_char(po_date, 'YYYY-MM')
union all
select
  company_id,
  'vendor_invoice_aging' as metric,
  case
    when current_date - due_date <= 0 then '0-30'
    when current_date - due_date <= 30 then '0-30'
    when current_date - due_date <= 60 then '31-60'
    when current_date - due_date <= 90 then '61-90'
    else '>90'
  end as bucket,
  count(*) as cnt,
  sum(total - paid_amount) as amount
from vendor_invoices
where status not in ('lunas','ditolak')
group by company_id, 3;

-- ---------------------------------------------------------------------
-- v_dashboard_commerce
-- ---------------------------------------------------------------------
create view v_dashboard_commerce with (security_invoker = on) as
select
  company_id,
  'active_contract_value' as metric,
  status as bucket,
  count(*) as cnt,
  sum(contract_value) as amount
from contracts
group by company_id, status
union all
select
  company_id,
  'claim_status' as metric,
  status as bucket,
  count(*) as cnt,
  sum(claim_amount) as amount
from progress_claims
group by company_id, status
union all
select
  company_id,
  'ar_aging' as metric,
  case
    when current_date - due_date <= 30 then '0-30'
    when current_date - due_date <= 60 then '31-60'
    when current_date - due_date <= 90 then '61-90'
    else '>90'
  end as bucket,
  count(*) as cnt,
  sum(total - paid_amount) as amount
from ar_invoices
where status not in ('lunas','batal')
group by company_id, 3
union all
select
  company_id,
  'sla_penalty' as metric,
  period_code as bucket,
  count(*) as cnt,
  sum(penalty_amount) as amount
from sla_penalties
group by company_id, period_code;

-- ---------------------------------------------------------------------
-- v_dashboard_finance
-- ---------------------------------------------------------------------
create view v_dashboard_finance with (security_invoker = on) as
select
  company_id,
  'cashflow_monthly' as metric,
  to_char(flow_date, 'YYYY-MM') || ':' || direction as bucket,
  count(*) as cnt,
  sum(amount) as amount
from cash_flows
group by company_id, to_char(flow_date, 'YYYY-MM'), direction
union all
select
  company_id,
  'ap_aging' as metric,
  case
    when current_date - due_date <= 30 then '0-30'
    when current_date - due_date <= 60 then '31-60'
    when current_date - due_date <= 90 then '61-90'
    else '>90'
  end as bucket,
  count(*) as cnt,
  sum(total - paid_amount) as amount
from vendor_invoices
where status not in ('lunas','ditolak')
group by company_id, 3;

create view v_project_margin with (security_invoker = on) as
select
  p.company_id,
  p.id as project_id,
  p.project_code,
  p.project_name,
  p.contract_value,
  coalesce(jc.total_cost, 0) as total_cost,
  p.contract_value - coalesce(jc.total_cost, 0) as margin,
  case when p.contract_value > 0
       then round((p.contract_value - coalesce(jc.total_cost, 0)) / p.contract_value * 100, 2)
       else null end as margin_percent
from projects p
left join (
  select project_id, sum(amount) as total_cost
  from job_costs
  where project_id is not null
  group by project_id
) jc on jc.project_id = p.id;

-- ---------------------------------------------------------------------
-- v_dashboard_inventory
-- ---------------------------------------------------------------------
create view v_dashboard_inventory with (security_invoker = on) as
select
  sb.company_id,
  'stock_value_by_warehouse' as metric,
  w.name as bucket,
  count(*) as cnt,
  sum(sb.qty * coalesce(sb.avg_price, 0)) as amount
from stock_balances sb
join warehouses w on w.id = sb.warehouse_id
group by sb.company_id, w.name
union all
select
  ic.company_id,
  'below_min_stock' as metric,
  ic.name as bucket,
  1 as cnt,
  coalesce(sum(sb.qty), 0) as amount
from item_catalog ic
join stock_balances sb on sb.item_id = ic.id and sb.company_id = ic.company_id
group by ic.company_id, ic.id, ic.name, ic.min_stock
having coalesce(sum(sb.qty), 0) < ic.min_stock
union all
select
  company_id,
  'serial_nte_by_status' as metric,
  status as bucket,
  count(*) as cnt,
  0 as amount
from serials
group by company_id, status;

create view v_stock_opname_variance with (security_invoker = on) as
select
  so.company_id,
  so.id as opname_id,
  so.opname_no,
  so.opname_date,
  so.warehouse_id,
  sum(sol.variance) as total_variance_qty,
  sum(sol.variance_value) as total_variance_value
from stock_opnames so
join stock_opname_lines sol on sol.opname_id = so.id
group by so.company_id, so.id, so.opname_no, so.opname_date, so.warehouse_id
order by so.opname_date desc;

-- ---------------------------------------------------------------------
-- v_dashboard_operations
-- ---------------------------------------------------------------------
create view v_dashboard_operations with (security_invoker = on) as
select
  company_id,
  'ticket_status' as metric,
  status as bucket,
  count(*) as cnt,
  null::numeric as amount
from tickets
group by company_id, status
union all
select
  company_id,
  'ticket_severity' as metric,
  severity as bucket,
  count(*) as cnt,
  null::numeric as amount
from tickets
group by company_id, severity
union all
select
  company_id,
  'sla_compliance' as metric,
  sla_status as bucket,
  count(*) as cnt,
  null::numeric as amount
from tickets
where resolved_at is not null
group by company_id, sla_status
union all
select
  company_id,
  'mttr_minutes_avg' as metric,
  'overall' as bucket,
  count(*) as cnt,
  avg(ttr_minutes)::numeric as amount
from tickets
where ttr_minutes is not null
group by company_id
union all
select
  t.company_id,
  'root_cause_by_aspect' as metric,
  rc.aspect || ':' || rc.name as bucket,
  count(*) as cnt,
  null::numeric as amount
from tickets t
join root_causes rc on rc.id = t.root_cause_id
group by t.company_id, rc.aspect, rc.name;

-- ---------------------------------------------------------------------
-- v_dashboard_deployment
-- ---------------------------------------------------------------------
create view v_dashboard_deployment with (security_invoker = on) as
select
  company_id,
  'project_status' as metric,
  status as bucket,
  count(*) as cnt,
  sum(contract_value) as amount
from projects
group by company_id, status;

create view v_project_scurve with (security_invoker = on) as
select
  company_id,
  project_id,
  report_date,
  plan_percent,
  actual_percent,
  deviation
from progress_reports
order by project_id, report_date;

create view v_boq_plan_vs_actual with (security_invoker = on) as
select
  company_id,
  project_id,
  item_code,
  description,
  uom,
  sum(qty) filter (where boq_type = 'plan') as qty_plan,
  sum(amount) filter (where boq_type = 'plan') as amount_plan,
  sum(qty) filter (where boq_type = 'actual') as qty_actual,
  sum(amount) filter (where boq_type = 'actual') as amount_actual
from boq_items
group by company_id, project_id, item_code, description, uom;

-- ---------------------------------------------------------------------
-- v_executive_summary
-- ---------------------------------------------------------------------
create view v_executive_summary with (security_invoker = on) as
select
  c.id as company_id,
  c.name as company_name,
  coalesce(rev.revenue, 0) as revenue,
  coalesce(cogs.cogs, 0) as cogs,
  coalesce(rev.revenue, 0) - coalesce(cogs.cogs, 0) as margin,
  coalesce(hc.headcount, 0) as headcount,
  coalesce(prod.total_points, 0) as total_productivity_points,
  coalesce(sla.compliance_percent, 0) as sla_compliance_percent,
  coalesce(ap.ap_outstanding, 0) as ap_outstanding,
  coalesce(ar.ar_outstanding, 0) as ar_outstanding
from companies c
left join (
  select company_id, sum(total) as revenue
  from ar_invoices
  where status in ('lunas','terkirim','dibayar_sebagian')
  group by company_id
) rev on rev.company_id = c.id
left join (
  select company_id, sum(amount) as cogs
  from job_costs
  group by company_id
) cogs on cogs.company_id = c.id
left join (
  select company_id, count(*) as headcount
  from employees
  where status = 'aktif'
  group by company_id
) hc on hc.company_id = c.id
left join (
  select company_id, sum(points) as total_points
  from productivity_entries
  group by company_id
) prod on prod.company_id = c.id
left join (
  select company_id,
    round(100.0 * count(*) filter (where sla_status = 'met') / nullif(count(*), 0), 2) as compliance_percent
  from tickets
  where resolved_at is not null
  group by company_id
) sla on sla.company_id = c.id
left join (
  select company_id, sum(total - paid_amount) as ap_outstanding
  from vendor_invoices
  where status not in ('lunas','ditolak')
  group by company_id
) ap on ap.company_id = c.id
left join (
  select company_id, sum(total - paid_amount) as ar_outstanding
  from ar_invoices
  where status not in ('lunas','batal')
  group by company_id
) ar on ar.company_id = c.id;

-- ---------------------------------------------------------------------
-- fn_sla_recalc(p_ticket uuid)
-- accounts for pause/resume events in ticket_sla_events when computing
-- ttr_minutes and sla_status
-- ---------------------------------------------------------------------
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

  v_end := coalesce(v_ticket.resolved_at, now());

  -- walk sla events in order, accumulating paused duration between pause/resume pairs
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

  -- if still paused at time of calculation, add up to v_end
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

-- ---------------------------------------------------------------------
-- trigger: work_orders status -> 'done' auto-inserts productivity_entries
-- ---------------------------------------------------------------------
create or replace function fn_wo_done_productivity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_point_weight numeric;
  v_tariff numeric;
begin
  if new.status = 'done' and (old.status is distinct from 'done') and new.assigned_to is not null then
    if new.job_type_id is not null then
      select point_weight, tariff_amount into v_point_weight, v_tariff
      from job_types where id = new.job_type_id;
    else
      v_point_weight := 0;
      v_tariff := 0;
    end if;

    insert into productivity_entries (
      company_id, employee_id, work_date, job_type_id, work_order_id,
      qty, points, amount, status
    ) values (
      new.company_id, new.assigned_to, coalesce(new.finished_at::date, current_date), new.job_type_id, new.id,
      1, coalesce(v_point_weight, 0) * 1, coalesce(v_tariff, 0), 'draft'
    );

    update work_orders
      set points = coalesce(v_point_weight, 0), amount = coalesce(v_tariff, 0)
      where id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_wo_done_productivity
  after update of status on work_orders
  for each row execute function fn_wo_done_productivity();

-- ---------------------------------------------------------------------
-- trigger: stock_movements -> update stock_balances automatically
-- ---------------------------------------------------------------------
create or replace function fn_stock_movement_apply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- decrease from source warehouse (ISSUE, TRANSFER-out, SCRAP, INSTALL)
  if new.from_warehouse_id is not null then
    insert into stock_balances (company_id, warehouse_id, item_id, qty)
    values (new.company_id, new.from_warehouse_id, new.item_id, -new.qty)
    on conflict (company_id, warehouse_id, item_id)
    do update set qty = stock_balances.qty - new.qty, updated_at = now();
  end if;

  -- increase into destination warehouse (GR, TRANSFER-in, RETURN)
  if new.to_warehouse_id is not null then
    insert into stock_balances (company_id, warehouse_id, item_id, qty, avg_price)
    values (new.company_id, new.to_warehouse_id, new.item_id, new.qty, new.price)
    on conflict (company_id, warehouse_id, item_id)
    do update set qty = stock_balances.qty + new.qty, updated_at = now();
  end if;

  -- direct adjustment / opname against from_warehouse_id treated as absolute delta already in qty
  return new;
end;
$$;

create trigger trg_stock_movement_apply
  after insert on stock_movements
  for each row execute function fn_stock_movement_apply();

-- ---------------------------------------------------------------------
-- trigger: gr_items -> update po_items.qty_received & purchase_orders.status
-- ---------------------------------------------------------------------
create or replace function fn_gr_items_apply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_po_id uuid;
  v_total_qty numeric;
  v_received_qty numeric;
begin
  update po_items
    set qty_received = coalesce(qty_received, 0) + new.qty_received
    where id = new.po_item_id;

  select po_id into v_po_id from po_items where id = new.po_item_id;

  select sum(qty), sum(qty_received) into v_total_qty, v_received_qty
  from po_items where po_id = v_po_id;

  update purchase_orders
    set status = case
      when v_received_qty >= v_total_qty then 'diterima'
      when v_received_qty > 0 then 'diterima_sebagian'
      else status
    end
    where id = v_po_id;

  return new;
end;
$$;

create trigger trg_gr_items_apply
  after insert on gr_items
  for each row execute function fn_gr_items_apply();

-- ---------------------------------------------------------------------
-- generic audit trigger fn_audit() -> writes to audit_logs
-- ---------------------------------------------------------------------
create or replace function fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_company_id := new.company_id;
    v_before := null;
    v_after := to_jsonb(new);
    v_entity_id := new.id;
  elsif tg_op = 'UPDATE' then
    v_action := 'update';
    v_company_id := new.company_id;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_entity_id := new.id;
  elsif tg_op = 'DELETE' then
    v_action := 'delete';
    v_company_id := old.company_id;
    v_before := to_jsonb(old);
    v_after := null;
    v_entity_id := old.id;
  end if;

  insert into audit_logs (company_id, user_id, action, entity_type, entity_id, before, after)
  values (v_company_id, auth.uid(), v_action, tg_table_name, v_entity_id, v_before, v_after);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_audit_purchase_orders
  after insert or update or delete on purchase_orders
  for each row execute function fn_audit();

create trigger trg_audit_vendor_invoices
  after insert or update or delete on vendor_invoices
  for each row execute function fn_audit();

create trigger trg_audit_ar_invoices
  after insert or update or delete on ar_invoices
  for each row execute function fn_audit();

create trigger trg_audit_payroll_runs
  after insert or update or delete on payroll_runs
  for each row execute function fn_audit();

create trigger trg_audit_contracts
  after insert or update or delete on contracts
  for each row execute function fn_audit();

create trigger trg_audit_spk
  after insert or update or delete on spk
  for each row execute function fn_audit();

create trigger trg_audit_bast
  after insert or update or delete on bast
  for each row execute function fn_audit();
