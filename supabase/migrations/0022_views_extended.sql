-- =====================================================================
-- 0022_views_extended.sql — Views tahap 2 (semua security_invoker = on)
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_approval_inbox — gabungan dokumen menunggu persetujuan lintas modul
-- ---------------------------------------------------------------------
create view v_approval_inbox with (security_invoker = on) as
select company_id, 'purchase_request'::text as entity_type, id as entity_id,
       pr_no as doc_no, purpose as title, 'PROCUREMENT'::text as module_code,
       created_by as requested_by, request_date::timestamptz as requested_at,
       total_estimate as amount, status, '/procurement/purchase-requests' as route_path
  from purchase_requests where status = 'diajukan'
union all
select company_id, 'purchase_order', id,
       po_no, ('Purchase Order ' || po_no), 'PROCUREMENT',
       created_by, po_date::timestamptz,
       total, status, '/procurement/purchase-orders'
  from purchase_orders where status = 'diajukan'
union all
select company_id, 'vendor_invoice', id,
       inv_no, coalesce(vendor_invoice_no, 'Invoice Vendor ' || inv_no), 'PROCUREMENT',
       created_by, invoice_date::timestamptz,
       total, status, '/procurement/vendor-invoices'
  from vendor_invoices where status = 'diajukan'
union all
select company_id, 'progress_claim', id,
       claim_no, ('Progress Claim ' || claim_no), 'COMMERCE',
       created_by, created_at,
       claim_amount, status, '/commerce/progress-claims'
  from progress_claims where status = 'diajukan'
union all
select company_id, 'ar_invoice', id,
       inv_no, ('AR Invoice ' || inv_no), 'COMMERCE',
       created_by, invoice_date::timestamptz,
       total, status, '/commerce/ar-invoices'
  from ar_invoices where status = 'diajukan'
union all
select company_id, 'leave_request', id,
       ('CUTI-' || substr(id::text,1,8)), leave_type, 'HR',
       created_by, created_at,
       null::numeric, status, '/hr/leave-requests'
  from leave_requests where status = 'diajukan'
union all
select company_id, 'overtime_request', id,
       spl_no, ('Lembur ' || to_char(work_date,'YYYY-MM-DD')), 'HR',
       created_by, created_at,
       calculated_amount, status, '/hr/overtime-requests'
  from overtime_requests where status = 'diajukan'
union all
select company_id, 'business_trip', id,
       sppd_no, coalesce(destination, 'Perjalanan Dinas'), 'HR',
       created_by, created_at,
       total_advance, status, '/hr/business-trips'
  from business_trips where status = 'diajukan'
union all
select company_id, 'trip_expense', id,
       ('TE-' || substr(id::text,1,8)), coalesce(description, 'Biaya Perjalanan Dinas'), 'HR',
       created_by, created_at,
       amount, status, '/hr/trip-expenses'
  from trip_expenses where status = 'diajukan'
union all
select company_id, 'employee_advance', id,
       advance_no, coalesce(purpose, 'Kasbon'), 'HR',
       created_by, created_at,
       amount, status, '/finance/employee-advances'
  from employee_advances where status = 'diajukan'
union all
select company_id, 'material_request', id,
       mr_no, coalesce(purpose, 'Permintaan Material'), 'INVENTORY',
       created_by, request_date::timestamptz,
       null::numeric, status, '/inventory/material-requests'
  from material_requests where status = 'diajukan'
union all
select company_id, 'freelance_payout', id,
       payout_no, ('Payout Mitra ' || period_code), 'PAYROLL',
       created_by, created_at,
       net_amount, status, '/payroll/freelance-payouts'
  from freelance_payouts where status = 'diverifikasi'
union all
select company_id, 'rfs_record', id,
       rfs_no, coalesce(scope, 'Ready For Service'), 'DEPLOYMENT',
       created_by, created_at,
       null::numeric, status, '/deployment/rfs-records'
  from rfs_records where status = 'diajukan'
union all
select company_id, 'punch_list', id,
       punch_no, coalesce(description, 'Punch List'), 'DEPLOYMENT',
       created_by, created_at,
       null::numeric, status, '/deployment/punch-lists'
  from punch_lists where status = 'diperbaiki'
union all
select company_id, 'work_permit', id,
       permit_no, coalesce(permit_type, 'Izin Kerja'), 'OPERATIONS',
       created_by, created_at,
       null::numeric, status, '/operations/work-permits'
  from work_permits where status = 'diajukan';

-- ---------------------------------------------------------------------
-- v_dashboard_hse
-- ---------------------------------------------------------------------
create view v_dashboard_hse with (security_invoker = on) as
select company_id, 'incident_by_type_month'::text as metric,
       (incident_type || ':' || to_char(incident_date::timestamptz,'YYYY-MM')) as bucket,
       count(*) as cnt, sum(cost_estimate) as amount
  from hse_incidents
 group by company_id, incident_type, to_char(incident_date::timestamptz,'YYYY-MM')
union all
select company_id, 'lost_days_month',
       to_char(incident_date::timestamptz,'YYYY-MM'),
       count(*), sum(lost_days)::numeric
  from hse_incidents
 group by company_id, to_char(incident_date::timestamptz,'YYYY-MM')
union all
select company_id, 'inspection_by_result',
       coalesce(result, 'belum_dinilai'),
       count(*), avg(score)
  from hse_inspections
 group by company_id, result
union all
select company_id, 'permit_active',
       status,
       count(*), null::numeric
  from work_permits
 where status = 'aktif'
 group by company_id, status;

-- ---------------------------------------------------------------------
-- v_dashboard_freelance
-- ---------------------------------------------------------------------
create view v_dashboard_freelance with (security_invoker = on) as
select frc.company_id, 'mitra_aktif'::text as metric, 'total'::text as bucket,
       count(distinct coalesce(frc.employee_id, frc.vendor_id)) as cnt, null::numeric as amount
  from freelance_rate_cards frc
 where frc.is_active = true
 group by frc.company_id
union all
select company_id, 'gross_by_period', period_code, count(*), sum(gross_amount)
  from freelance_payouts
 group by company_id, period_code
union all
select company_id, 'tax_by_period', period_code, count(*), sum(tax_amount)
  from freelance_payouts
 group by company_id, period_code
union all
select company_id, 'net_by_period', period_code, count(*), sum(net_amount)
  from freelance_payouts
 group by company_id, period_code
union all
select fp.company_id, 'top_mitra',
       coalesce(e.full_name, v.name, 'Tanpa Nama'),
       count(*), sum(fp.net_amount)
  from freelance_payouts fp
  left join employees e on e.id = fp.employee_id
  left join vendors v on v.id = fp.vendor_id
 group by fp.company_id, coalesce(e.full_name, v.name, 'Tanpa Nama');

-- ---------------------------------------------------------------------
-- v_dashboard_crm
-- ---------------------------------------------------------------------
create view v_dashboard_crm with (security_invoker = on) as
select company_id, 'opportunity_by_stage'::text as metric, stage as bucket,
       count(*) as cnt, sum(estimated_value) as amount
  from opportunities
 group by company_id, stage
union all
select company_id, 'pipeline_weighted', 'total',
       count(*), sum(estimated_value * probability_percent / 100.0)
  from opportunities
 where stage not in ('menang','kalah','batal')
 group by company_id
union all
select company_id, 'win_rate', 'total',
       count(*) filter (where stage = 'menang'),
       round(
         100.0 * count(*) filter (where stage = 'menang')
         / nullif(count(*) filter (where stage in ('menang','kalah')), 0)
       , 2)
  from opportunities
 group by company_id;

-- ---------------------------------------------------------------------
-- v_tax_summary — rekap tax_records per periode & jenis pajak
-- ---------------------------------------------------------------------
create view v_tax_summary with (security_invoker = on) as
select company_id, tax_period, tax_type,
       count(*) as cnt,
       sum(dpp) as total_dpp,
       sum(tax_amount) as total_tax
  from tax_records
 group by company_id, tax_period, tax_type;

-- ---------------------------------------------------------------------
-- v_warranty_alert — proyek dengan garansi berakhir < 60 hari
-- ---------------------------------------------------------------------
create view v_warranty_alert with (security_invoker = on) as
select wp.company_id, wp.id as warranty_id, wp.project_id,
       p.project_code, p.project_name,
       wp.start_date, wp.end_date,
       (wp.end_date - current_date) as days_remaining,
       wp.warranty_months, wp.scope, wp.status
  from warranty_periods wp
  join projects p on p.id = wp.project_id
 where wp.status = 'aktif'
   and wp.end_date >= current_date
   and wp.end_date <= current_date + interval '60 days';
