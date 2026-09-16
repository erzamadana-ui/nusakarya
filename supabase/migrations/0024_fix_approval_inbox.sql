-- =====================================================================
-- 0024_fix_approval_inbox.sql
-- Perbaikan v_approval_inbox:
--  1. route_path disamakan dengan apps/web-admin/src/lib/nav.ts
--  2. Status filter per sumber diverifikasi ulang terhadap CHECK
--     constraint tabel masing-masing (bukan tebakan):
--     - freelance_payouts TIDAK punya status 'diajukan' pada enumnya
--       (draft, dihitung, diverifikasi, disetujui, dibayar, ditolak) —
--       tahap "menunggu keputusan" yang benar adalah 'dihitung'
--       (sudah dihitung sistem, menunggu verifikasi/approval mitra).
--     - punch_lists TIDAK punya status 'diajukan' pada enumnya
--       (terbuka, diperbaiki, diverifikasi, ditolak, ditutup) —
--       tahap "menunggu keputusan" yang benar adalah 'terbuka'
--       (baru dilaporkan, menunggu keputusan penugasan perbaikan).
--     Sumber lain tetap memakai 'diajukan' sesuai CHECK constraint-nya.
-- =====================================================================

create or replace view v_approval_inbox with (security_invoker = on) as
select company_id, 'purchase_request'::text as entity_type, id as entity_id,
       pr_no as doc_no, purpose as title, 'PROCUREMENT'::text as module_code,
       created_by as requested_by, request_date::timestamptz as requested_at,
       total_estimate as amount, status, '/procurement/pr' as route_path
  from purchase_requests where status = 'diajukan'
union all
select company_id, 'purchase_order', id,
       po_no, ('Purchase Order ' || po_no), 'PROCUREMENT',
       created_by, po_date::timestamptz,
       total, status, '/procurement/po'
  from purchase_orders where status = 'diajukan'
union all
select company_id, 'vendor_invoice', id,
       inv_no, coalesce(vendor_invoice_no, 'Invoice Vendor ' || inv_no), 'PROCUREMENT',
       created_by, invoice_date::timestamptz,
       total, status, '/procurement/invoice-vendor'
  from vendor_invoices where status = 'diajukan'
union all
select company_id, 'progress_claim', id,
       claim_no, ('Progress Claim ' || claim_no), 'COMMERCE',
       created_by, created_at,
       claim_amount, status, '/commerce/klaim'
  from progress_claims where status = 'diajukan'
union all
select company_id, 'ar_invoice', id,
       inv_no, ('AR Invoice ' || inv_no), 'COMMERCE',
       created_by, invoice_date::timestamptz,
       total, status, '/commerce/invoice'
  from ar_invoices where status = 'diajukan'
union all
select company_id, 'leave_request', id,
       ('CUTI-' || substr(id::text,1,8)), leave_type, 'HR',
       created_by, created_at,
       null::numeric, status, '/hr/cuti'
  from leave_requests where status = 'diajukan'
union all
select company_id, 'overtime_request', id,
       spl_no, ('Lembur ' || to_char(work_date,'YYYY-MM-DD')), 'HR',
       created_by, created_at,
       calculated_amount, status, '/hr/lembur'
  from overtime_requests where status = 'diajukan'
union all
select company_id, 'business_trip', id,
       sppd_no, coalesce(destination, 'Perjalanan Dinas'), 'HR',
       created_by, created_at,
       total_advance, status, '/hr/perjalanan'
  from business_trips where status = 'diajukan'
union all
select company_id, 'trip_expense', id,
       ('TE-' || substr(id::text,1,8)), coalesce(description, 'Biaya Perjalanan Dinas'), 'HR',
       created_by, created_at,
       amount, status, '/hr/perjalanan'
  from trip_expenses where status = 'diajukan'
union all
select company_id, 'employee_advance', id,
       advance_no, coalesce(purpose, 'Kasbon'), 'HR',
       created_by, created_at,
       amount, status, '/hr/kasbon'
  from employee_advances where status = 'diajukan'
union all
select company_id, 'material_request', id,
       mr_no, coalesce(purpose, 'Permintaan Material'), 'INVENTORY',
       created_by, request_date::timestamptz,
       null::numeric, status, '/inventory/permintaan'
  from material_requests where status = 'diajukan'
union all
select company_id, 'freelance_payout', id,
       payout_no, ('Payout Mitra ' || period_code), 'PAYROLL',
       created_by, created_at,
       net_amount, status, '/hr/payroll-freelance'
  from freelance_payouts where status = 'dihitung'
union all
select company_id, 'rfs_record', id,
       rfs_no, coalesce(scope, 'Ready For Service'), 'DEPLOYMENT',
       created_by, created_at,
       null::numeric, status, '/deploy/rfs'
  from rfs_records where status = 'diajukan'
union all
select company_id, 'punch_list', id,
       punch_no, coalesce(description, 'Punch List'), 'DEPLOYMENT',
       created_by, created_at,
       null::numeric, status, '/deploy/punchlist'
  from punch_lists where status = 'terbuka'
union all
select company_id, 'work_permit', id,
       permit_no, coalesce(permit_type, 'Izin Kerja'), 'OPERATIONS',
       created_by, created_at,
       null::numeric, status, '/k3/izin-kerja'
  from work_permits where status = 'diajukan';
