-- =====================================================================
-- 0007_rls.sql — Row Level Security for all business tables
-- =====================================================================

-- ---------------------------------------------------------------------
-- helper: resolve current user's employee_id (for self-scoped policies)
-- ---------------------------------------------------------------------
create or replace function auth_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from employees where user_id = auth.uid();
$$;

-- ---- branches (CORE) ----
alter table branches enable row level security;
create policy branches_select on branches for select
  using (company_id = auth_company_id() and can_read('CORE'));
create policy branches_insert on branches for insert
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy branches_update on branches for update
  using (company_id = auth_company_id() and can_write('CORE'))
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy branches_delete on branches for delete
  using (company_id = auth_company_id() and can_approve('CORE'));

-- ---- approvals (CORE) ----
alter table approvals enable row level security;
create policy approvals_select on approvals for select
  using (company_id = auth_company_id() and can_read('CORE'));
create policy approvals_insert on approvals for insert
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy approvals_update on approvals for update
  using (company_id = auth_company_id() and can_write('CORE'))
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy approvals_delete on approvals for delete
  using (company_id = auth_company_id() and can_approve('CORE'));

-- ---- attachments (CORE) ----
alter table attachments enable row level security;
create policy attachments_select on attachments for select
  using (company_id = auth_company_id() and can_read('CORE'));
create policy attachments_insert on attachments for insert
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy attachments_update on attachments for update
  using (company_id = auth_company_id() and can_write('CORE'))
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy attachments_delete on attachments for delete
  using (company_id = auth_company_id() and can_approve('CORE'));

-- ---- notifications (CORE) ----
alter table notifications enable row level security;
create policy notifications_select on notifications for select
  using (company_id = auth_company_id() and can_read('CORE'));
create policy notifications_insert on notifications for insert
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy notifications_update on notifications for update
  using (company_id = auth_company_id() and can_write('CORE'))
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy notifications_delete on notifications for delete
  using (company_id = auth_company_id() and can_approve('CORE'));

-- ---- role_module_access (CORE) ----
alter table role_module_access enable row level security;
create policy role_module_access_select on role_module_access for select
  using (company_id = auth_company_id() and can_read('CORE'));
create policy role_module_access_insert on role_module_access for insert
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy role_module_access_update on role_module_access for update
  using (company_id = auth_company_id() and can_write('CORE'))
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy role_module_access_delete on role_module_access for delete
  using (company_id = auth_company_id() and can_approve('CORE'));

-- ---- employees (HR) ----
alter table employees enable row level security;
create policy employees_select on employees for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy employees_insert on employees for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy employees_update on employees for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy employees_delete on employees for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- employee_certifications (HR) ----
alter table employee_certifications enable row level security;
create policy employee_certifications_select on employee_certifications for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy employee_certifications_insert on employee_certifications for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy employee_certifications_update on employee_certifications for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy employee_certifications_delete on employee_certifications for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- shifts (HR) ----
alter table shifts enable row level security;
create policy shifts_select on shifts for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy shifts_insert on shifts for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy shifts_update on shifts for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy shifts_delete on shifts for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- rosters (HR) ----
alter table rosters enable row level security;
create policy rosters_select on rosters for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy rosters_insert on rosters for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy rosters_update on rosters for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy rosters_delete on rosters for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- leave_requests (HR) ----
alter table leave_requests enable row level security;
create policy leave_requests_select on leave_requests for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy leave_requests_insert on leave_requests for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy leave_requests_update on leave_requests for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy leave_requests_delete on leave_requests for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- salary_components (PAYROLL) ----
alter table salary_components enable row level security;
create policy salary_components_select on salary_components for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
create policy salary_components_insert on salary_components for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy salary_components_update on salary_components for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy salary_components_delete on salary_components for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---- employee_salaries (PAYROLL) ----
alter table employee_salaries enable row level security;
create policy employee_salaries_select on employee_salaries for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
create policy employee_salaries_insert on employee_salaries for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy employee_salaries_update on employee_salaries for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy employee_salaries_delete on employee_salaries for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---- payroll_periods (PAYROLL) ----
alter table payroll_periods enable row level security;
create policy payroll_periods_select on payroll_periods for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
create policy payroll_periods_insert on payroll_periods for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy payroll_periods_update on payroll_periods for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy payroll_periods_delete on payroll_periods for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---- payroll_runs (PAYROLL) ----
alter table payroll_runs enable row level security;
create policy payroll_runs_select on payroll_runs for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
create policy payroll_runs_insert on payroll_runs for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy payroll_runs_update on payroll_runs for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy payroll_runs_delete on payroll_runs for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---- payroll_run_lines (PAYROLL) ----
alter table payroll_run_lines enable row level security;
create policy payroll_run_lines_select on payroll_run_lines for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
create policy payroll_run_lines_insert on payroll_run_lines for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy payroll_run_lines_update on payroll_run_lines for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy payroll_run_lines_delete on payroll_run_lines for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---- bpjs_config (PAYROLL) ----
alter table bpjs_config enable row level security;
create policy bpjs_config_select on bpjs_config for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
create policy bpjs_config_insert on bpjs_config for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy bpjs_config_update on bpjs_config for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy bpjs_config_delete on bpjs_config for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---- job_types (PRODUCTIVITY) ----
alter table job_types enable row level security;
create policy job_types_select on job_types for select
  using (company_id = auth_company_id() and can_read('PRODUCTIVITY'));
create policy job_types_insert on job_types for insert
  with check (company_id = auth_company_id() and can_write('PRODUCTIVITY'));
create policy job_types_update on job_types for update
  using (company_id = auth_company_id() and can_write('PRODUCTIVITY'))
  with check (company_id = auth_company_id() and can_write('PRODUCTIVITY'));
create policy job_types_delete on job_types for delete
  using (company_id = auth_company_id() and can_approve('PRODUCTIVITY'));

-- ---- productivity_targets (PRODUCTIVITY) ----
alter table productivity_targets enable row level security;
create policy productivity_targets_select on productivity_targets for select
  using (company_id = auth_company_id() and can_read('PRODUCTIVITY'));
create policy productivity_targets_insert on productivity_targets for insert
  with check (company_id = auth_company_id() and can_write('PRODUCTIVITY'));
create policy productivity_targets_update on productivity_targets for update
  using (company_id = auth_company_id() and can_write('PRODUCTIVITY'))
  with check (company_id = auth_company_id() and can_write('PRODUCTIVITY'));
create policy productivity_targets_delete on productivity_targets for delete
  using (company_id = auth_company_id() and can_approve('PRODUCTIVITY'));

-- ---- vendors (PROCUREMENT) ----
alter table vendors enable row level security;
create policy vendors_select on vendors for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy vendors_insert on vendors for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendors_update on vendors for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendors_delete on vendors for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- vendor_scorecards (PROCUREMENT) ----
alter table vendor_scorecards enable row level security;
create policy vendor_scorecards_select on vendor_scorecards for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy vendor_scorecards_insert on vendor_scorecards for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendor_scorecards_update on vendor_scorecards for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendor_scorecards_delete on vendor_scorecards for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- item_catalog (PROCUREMENT) ----
alter table item_catalog enable row level security;
create policy item_catalog_select on item_catalog for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy item_catalog_insert on item_catalog for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy item_catalog_update on item_catalog for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy item_catalog_delete on item_catalog for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- purchase_requests (PROCUREMENT) ----
alter table purchase_requests enable row level security;
create policy purchase_requests_select on purchase_requests for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy purchase_requests_insert on purchase_requests for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy purchase_requests_update on purchase_requests for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy purchase_requests_delete on purchase_requests for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- pr_items (PROCUREMENT) ----
alter table pr_items enable row level security;
create policy pr_items_select on pr_items for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy pr_items_insert on pr_items for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy pr_items_update on pr_items for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy pr_items_delete on pr_items for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- rfqs (PROCUREMENT) ----
alter table rfqs enable row level security;
create policy rfqs_select on rfqs for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy rfqs_insert on rfqs for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy rfqs_update on rfqs for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy rfqs_delete on rfqs for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- rfq_quotes (PROCUREMENT) ----
alter table rfq_quotes enable row level security;
create policy rfq_quotes_select on rfq_quotes for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy rfq_quotes_insert on rfq_quotes for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy rfq_quotes_update on rfq_quotes for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy rfq_quotes_delete on rfq_quotes for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- purchase_orders (PROCUREMENT) ----
alter table purchase_orders enable row level security;
create policy purchase_orders_select on purchase_orders for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy purchase_orders_insert on purchase_orders for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy purchase_orders_update on purchase_orders for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy purchase_orders_delete on purchase_orders for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- po_items (PROCUREMENT) ----
alter table po_items enable row level security;
create policy po_items_select on po_items for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy po_items_insert on po_items for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy po_items_update on po_items for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy po_items_delete on po_items for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- goods_receipts (PROCUREMENT) ----
alter table goods_receipts enable row level security;
create policy goods_receipts_select on goods_receipts for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy goods_receipts_insert on goods_receipts for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy goods_receipts_update on goods_receipts for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy goods_receipts_delete on goods_receipts for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- gr_items (PROCUREMENT) ----
alter table gr_items enable row level security;
create policy gr_items_select on gr_items for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy gr_items_insert on gr_items for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy gr_items_update on gr_items for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy gr_items_delete on gr_items for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- vendor_invoices (PROCUREMENT) ----
alter table vendor_invoices enable row level security;
create policy vendor_invoices_select on vendor_invoices for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy vendor_invoices_insert on vendor_invoices for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendor_invoices_update on vendor_invoices for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendor_invoices_delete on vendor_invoices for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- ap_payments (PROCUREMENT) ----
alter table ap_payments enable row level security;
create policy ap_payments_select on ap_payments for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy ap_payments_insert on ap_payments for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy ap_payments_update on ap_payments for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy ap_payments_delete on ap_payments for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- customers (COMMERCE) ----
alter table customers enable row level security;
create policy customers_select on customers for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy customers_insert on customers for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy customers_update on customers for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy customers_delete on customers for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- contracts (COMMERCE) ----
alter table contracts enable row level security;
create policy contracts_select on contracts for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy contracts_insert on contracts for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy contracts_update on contracts for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy contracts_delete on contracts for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- contract_price_list (COMMERCE) ----
alter table contract_price_list enable row level security;
create policy contract_price_list_select on contract_price_list for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy contract_price_list_insert on contract_price_list for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy contract_price_list_update on contract_price_list for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy contract_price_list_delete on contract_price_list for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- spk (COMMERCE) ----
alter table spk enable row level security;
create policy spk_select on spk for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy spk_insert on spk for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy spk_update on spk for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy spk_delete on spk for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- progress_claims (COMMERCE) ----
alter table progress_claims enable row level security;
create policy progress_claims_select on progress_claims for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy progress_claims_insert on progress_claims for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy progress_claims_update on progress_claims for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy progress_claims_delete on progress_claims for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- progress_claim_items (COMMERCE) ----
alter table progress_claim_items enable row level security;
create policy progress_claim_items_select on progress_claim_items for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy progress_claim_items_insert on progress_claim_items for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy progress_claim_items_update on progress_claim_items for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy progress_claim_items_delete on progress_claim_items for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- bast (COMMERCE) ----
alter table bast enable row level security;
create policy bast_select on bast for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy bast_insert on bast for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy bast_update on bast for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy bast_delete on bast for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- ar_invoices (COMMERCE) ----
alter table ar_invoices enable row level security;
create policy ar_invoices_select on ar_invoices for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy ar_invoices_insert on ar_invoices for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy ar_invoices_update on ar_invoices for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy ar_invoices_delete on ar_invoices for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- ar_payments (COMMERCE) ----
alter table ar_payments enable row level security;
create policy ar_payments_select on ar_payments for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy ar_payments_insert on ar_payments for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy ar_payments_update on ar_payments for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy ar_payments_delete on ar_payments for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- sla_penalties (COMMERCE) ----
alter table sla_penalties enable row level security;
create policy sla_penalties_select on sla_penalties for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy sla_penalties_insert on sla_penalties for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy sla_penalties_update on sla_penalties for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy sla_penalties_delete on sla_penalties for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- cost_categories (FINANCE) ----
alter table cost_categories enable row level security;
create policy cost_categories_select on cost_categories for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy cost_categories_insert on cost_categories for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy cost_categories_update on cost_categories for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy cost_categories_delete on cost_categories for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- job_costs (FINANCE) ----
alter table job_costs enable row level security;
create policy job_costs_select on job_costs for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy job_costs_insert on job_costs for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy job_costs_update on job_costs for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy job_costs_delete on job_costs for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- budgets (FINANCE) ----
alter table budgets enable row level security;
create policy budgets_select on budgets for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy budgets_insert on budgets for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy budgets_update on budgets for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy budgets_delete on budgets for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- cash_flows (FINANCE) ----
alter table cash_flows enable row level security;
create policy cash_flows_select on cash_flows for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy cash_flows_insert on cash_flows for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy cash_flows_update on cash_flows for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy cash_flows_delete on cash_flows for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- partner_payment_sla (FINANCE) ----
alter table partner_payment_sla enable row level security;
create policy partner_payment_sla_select on partner_payment_sla for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy partner_payment_sla_insert on partner_payment_sla for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy partner_payment_sla_update on partner_payment_sla for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy partner_payment_sla_delete on partner_payment_sla for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- warehouses (INVENTORY) ----
alter table warehouses enable row level security;
create policy warehouses_select on warehouses for select
  using (company_id = auth_company_id() and can_read('INVENTORY'));
create policy warehouses_insert on warehouses for insert
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy warehouses_update on warehouses for update
  using (company_id = auth_company_id() and can_write('INVENTORY'))
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy warehouses_delete on warehouses for delete
  using (company_id = auth_company_id() and can_approve('INVENTORY'));

-- ---- stock_balances (INVENTORY) ----
alter table stock_balances enable row level security;
create policy stock_balances_select on stock_balances for select
  using (company_id = auth_company_id() and can_read('INVENTORY'));
create policy stock_balances_insert on stock_balances for insert
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy stock_balances_update on stock_balances for update
  using (company_id = auth_company_id() and can_write('INVENTORY'))
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy stock_balances_delete on stock_balances for delete
  using (company_id = auth_company_id() and can_approve('INVENTORY'));

-- ---- stock_movements (INVENTORY) ----
alter table stock_movements enable row level security;
create policy stock_movements_select on stock_movements for select
  using (company_id = auth_company_id() and can_read('INVENTORY'));
create policy stock_movements_insert on stock_movements for insert
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy stock_movements_update on stock_movements for update
  using (company_id = auth_company_id() and can_write('INVENTORY'))
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy stock_movements_delete on stock_movements for delete
  using (company_id = auth_company_id() and can_approve('INVENTORY'));

-- ---- serials (INVENTORY) ----
alter table serials enable row level security;
create policy serials_select on serials for select
  using (company_id = auth_company_id() and can_read('INVENTORY'));
create policy serials_insert on serials for insert
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy serials_update on serials for update
  using (company_id = auth_company_id() and can_write('INVENTORY'))
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy serials_delete on serials for delete
  using (company_id = auth_company_id() and can_approve('INVENTORY'));

-- ---- serial_movements (INVENTORY) ----
alter table serial_movements enable row level security;
create policy serial_movements_select on serial_movements for select
  using (company_id = auth_company_id() and can_read('INVENTORY'));
create policy serial_movements_insert on serial_movements for insert
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy serial_movements_update on serial_movements for update
  using (company_id = auth_company_id() and can_write('INVENTORY'))
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy serial_movements_delete on serial_movements for delete
  using (company_id = auth_company_id() and can_approve('INVENTORY'));

-- ---- material_requests (INVENTORY) ----
alter table material_requests enable row level security;
create policy material_requests_select on material_requests for select
  using (company_id = auth_company_id() and can_read('INVENTORY'));
create policy material_requests_insert on material_requests for insert
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy material_requests_update on material_requests for update
  using (company_id = auth_company_id() and can_write('INVENTORY'))
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy material_requests_delete on material_requests for delete
  using (company_id = auth_company_id() and can_approve('INVENTORY'));

-- ---- material_request_items (INVENTORY) ----
alter table material_request_items enable row level security;
create policy material_request_items_select on material_request_items for select
  using (company_id = auth_company_id() and can_read('INVENTORY'));
create policy material_request_items_insert on material_request_items for insert
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy material_request_items_update on material_request_items for update
  using (company_id = auth_company_id() and can_write('INVENTORY'))
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy material_request_items_delete on material_request_items for delete
  using (company_id = auth_company_id() and can_approve('INVENTORY'));

-- ---- material_usages (INVENTORY) ----
alter table material_usages enable row level security;
create policy material_usages_select on material_usages for select
  using (company_id = auth_company_id() and can_read('INVENTORY'));
create policy material_usages_insert on material_usages for insert
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy material_usages_update on material_usages for update
  using (company_id = auth_company_id() and can_write('INVENTORY'))
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy material_usages_delete on material_usages for delete
  using (company_id = auth_company_id() and can_approve('INVENTORY'));

-- ---- stock_opnames (INVENTORY) ----
alter table stock_opnames enable row level security;
create policy stock_opnames_select on stock_opnames for select
  using (company_id = auth_company_id() and can_read('INVENTORY'));
create policy stock_opnames_insert on stock_opnames for insert
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy stock_opnames_update on stock_opnames for update
  using (company_id = auth_company_id() and can_write('INVENTORY'))
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy stock_opnames_delete on stock_opnames for delete
  using (company_id = auth_company_id() and can_approve('INVENTORY'));

-- ---- stock_opname_lines (INVENTORY) ----
alter table stock_opname_lines enable row level security;
create policy stock_opname_lines_select on stock_opname_lines for select
  using (company_id = auth_company_id() and can_read('INVENTORY'));
create policy stock_opname_lines_insert on stock_opname_lines for insert
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy stock_opname_lines_update on stock_opname_lines for update
  using (company_id = auth_company_id() and can_write('INVENTORY'))
  with check (company_id = auth_company_id() and can_write('INVENTORY'));
create policy stock_opname_lines_delete on stock_opname_lines for delete
  using (company_id = auth_company_id() and can_approve('INVENTORY'));

-- ---- assets (ASSET) ----
alter table assets enable row level security;
create policy assets_select on assets for select
  using (company_id = auth_company_id() and can_read('ASSET'));
create policy assets_insert on assets for insert
  with check (company_id = auth_company_id() and can_write('ASSET'));
create policy assets_update on assets for update
  using (company_id = auth_company_id() and can_write('ASSET'))
  with check (company_id = auth_company_id() and can_write('ASSET'));
create policy assets_delete on assets for delete
  using (company_id = auth_company_id() and can_approve('ASSET'));

-- ---- asset_assignments (ASSET) ----
alter table asset_assignments enable row level security;
create policy asset_assignments_select on asset_assignments for select
  using (company_id = auth_company_id() and can_read('ASSET'));
create policy asset_assignments_insert on asset_assignments for insert
  with check (company_id = auth_company_id() and can_write('ASSET'));
create policy asset_assignments_update on asset_assignments for update
  using (company_id = auth_company_id() and can_write('ASSET'))
  with check (company_id = auth_company_id() and can_write('ASSET'));
create policy asset_assignments_delete on asset_assignments for delete
  using (company_id = auth_company_id() and can_approve('ASSET'));

-- ---- asset_maintenances (ASSET) ----
alter table asset_maintenances enable row level security;
create policy asset_maintenances_select on asset_maintenances for select
  using (company_id = auth_company_id() and can_read('ASSET'));
create policy asset_maintenances_insert on asset_maintenances for insert
  with check (company_id = auth_company_id() and can_write('ASSET'));
create policy asset_maintenances_update on asset_maintenances for update
  using (company_id = auth_company_id() and can_write('ASSET'))
  with check (company_id = auth_company_id() and can_write('ASSET'));
create policy asset_maintenances_delete on asset_maintenances for delete
  using (company_id = auth_company_id() and can_approve('ASSET'));

-- ---- network_elements (OPERATIONS) ----
alter table network_elements enable row level security;
create policy network_elements_select on network_elements for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy network_elements_insert on network_elements for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy network_elements_update on network_elements for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy network_elements_delete on network_elements for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- root_causes (OPERATIONS) ----
alter table root_causes enable row level security;
create policy root_causes_select on root_causes for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy root_causes_insert on root_causes for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy root_causes_update on root_causes for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy root_causes_delete on root_causes for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- tickets (OPERATIONS) ----
alter table tickets enable row level security;
create policy tickets_select on tickets for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy tickets_insert on tickets for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy tickets_update on tickets for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy tickets_delete on tickets for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- ticket_sla_events (OPERATIONS) ----
alter table ticket_sla_events enable row level security;
create policy ticket_sla_events_select on ticket_sla_events for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy ticket_sla_events_insert on ticket_sla_events for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy ticket_sla_events_update on ticket_sla_events for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy ticket_sla_events_delete on ticket_sla_events for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- ticket_activities (OPERATIONS) ----
alter table ticket_activities enable row level security;
create policy ticket_activities_select on ticket_activities for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy ticket_activities_insert on ticket_activities for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy ticket_activities_update on ticket_activities for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy ticket_activities_delete on ticket_activities for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- wo_checklists (OPERATIONS) ----
alter table wo_checklists enable row level security;
create policy wo_checklists_select on wo_checklists for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy wo_checklists_insert on wo_checklists for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy wo_checklists_update on wo_checklists for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy wo_checklists_delete on wo_checklists for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- maintenance_plans (OPERATIONS) ----
alter table maintenance_plans enable row level security;
create policy maintenance_plans_select on maintenance_plans for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy maintenance_plans_insert on maintenance_plans for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy maintenance_plans_update on maintenance_plans for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy maintenance_plans_delete on maintenance_plans for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- maintenance_tasks (OPERATIONS) ----
alter table maintenance_tasks enable row level security;
create policy maintenance_tasks_select on maintenance_tasks for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy maintenance_tasks_insert on maintenance_tasks for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy maintenance_tasks_update on maintenance_tasks for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy maintenance_tasks_delete on maintenance_tasks for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- projects (DEPLOYMENT) ----
alter table projects enable row level security;
create policy projects_select on projects for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy projects_insert on projects for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy projects_update on projects for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy projects_delete on projects for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- surveys (DEPLOYMENT) ----
alter table surveys enable row level security;
create policy surveys_select on surveys for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy surveys_insert on surveys for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy surveys_update on surveys for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy surveys_delete on surveys for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- drm_sessions (DEPLOYMENT) ----
alter table drm_sessions enable row level security;
create policy drm_sessions_select on drm_sessions for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy drm_sessions_insert on drm_sessions for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy drm_sessions_update on drm_sessions for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy drm_sessions_delete on drm_sessions for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- boq_items (DEPLOYMENT) ----
alter table boq_items enable row level security;
create policy boq_items_select on boq_items for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy boq_items_insert on boq_items for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy boq_items_update on boq_items for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy boq_items_delete on boq_items for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- project_milestones (DEPLOYMENT) ----
alter table project_milestones enable row level security;
create policy project_milestones_select on project_milestones for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy project_milestones_insert on project_milestones for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy project_milestones_update on project_milestones for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy project_milestones_delete on project_milestones for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- progress_reports (DEPLOYMENT) ----
alter table progress_reports enable row level security;
create policy progress_reports_select on progress_reports for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy progress_reports_insert on progress_reports for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy progress_reports_update on progress_reports for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy progress_reports_delete on progress_reports for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- documents (DEPLOYMENT) ----
alter table documents enable row level security;
create policy documents_select on documents for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy documents_insert on documents for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy documents_update on documents for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy documents_delete on documents for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- qc_records (DEPLOYMENT) ----
alter table qc_records enable row level security;
create policy qc_records_select on qc_records for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy qc_records_insert on qc_records for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy qc_records_update on qc_records for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy qc_records_delete on qc_records for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- rfs_records (DEPLOYMENT) ----
alter table rfs_records enable row level security;
create policy rfs_records_select on rfs_records for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy rfs_records_insert on rfs_records for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy rfs_records_update on rfs_records for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy rfs_records_delete on rfs_records for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));


-- =====================================================================
-- SPECIAL-CASE TABLES
-- =====================================================================

-- ---- companies ----
alter table companies enable row level security;
create policy companies_select on companies for select
  using (id = auth_company_id());
create policy companies_update on companies for update
  using (id = auth_company_id() and is_super())
  with check (id = auth_company_id() and is_super());
-- no insert/delete policy for regular users: company provisioning happens via service role

-- ---- profiles ----
alter table profiles enable row level security;
create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or (company_id = auth_company_id() and auth_role() in ('manager_hr','super_admin'))
  );
create policy profiles_insert on profiles for insert
  with check (company_id = auth_company_id() and auth_role() in ('manager_hr','super_admin'));
create policy profiles_update on profiles for update
  using (
    id = auth.uid()
    or (company_id = auth_company_id() and auth_role() in ('manager_hr','super_admin'))
  )
  with check (
    id = auth.uid()
    or (company_id = auth_company_id() and auth_role() in ('manager_hr','super_admin'))
  );
create policy profiles_delete on profiles for delete
  using (company_id = auth_company_id() and is_super());

-- ---- modules (global reference table, no company_id) ----
alter table modules enable row level security;
create policy modules_select on modules for select
  using (auth.uid() is not null);
create policy modules_write on modules for insert
  with check (is_super());
create policy modules_update on modules for update
  using (is_super())
  with check (is_super());
create policy modules_delete on modules for delete
  using (is_super());

-- ---- doc_sequences (internal; only touched via next_doc_no() SECURITY DEFINER) ----
alter table doc_sequences enable row level security;
-- intentionally no policies: all access goes through the SECURITY DEFINER function,
-- which bypasses RLS as its owner. Direct table access is denied to all roles.

-- ---- audit_logs (append-only) ----
alter table audit_logs enable row level security;
create policy audit_logs_insert on audit_logs for insert
  with check (company_id = auth_company_id());
create policy audit_logs_select on audit_logs for select
  using (company_id = auth_company_id() and auth_role() in ('super_admin','direktur','komisaris'));
-- no update/delete policy: logs are immutable

-- ---- ter_rates (company_id nullable => global default rows allowed) ----
alter table ter_rates enable row level security;
create policy ter_rates_select on ter_rates for select
  using ((company_id = auth_company_id() or company_id is null) and can_read('PAYROLL'));
create policy ter_rates_insert on ter_rates for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy ter_rates_update on ter_rates for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy ter_rates_delete on ter_rates for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---------------------------------------------------------------------
-- attendances (HR) — general policy excludes teknisi; teknisi gets a
-- self-scoped policy limited to their own employee row
-- ---------------------------------------------------------------------
alter table attendances enable row level security;
create policy attendances_select on attendances for select
  using (company_id = auth_company_id() and can_read('HR') and auth_role() <> 'teknisi');
create policy attendances_insert on attendances for insert
  with check (company_id = auth_company_id() and can_write('HR') and auth_role() <> 'teknisi');
create policy attendances_update on attendances for update
  using (company_id = auth_company_id() and can_write('HR') and auth_role() <> 'teknisi')
  with check (company_id = auth_company_id() and can_write('HR') and auth_role() <> 'teknisi');
create policy attendances_delete on attendances for delete
  using (company_id = auth_company_id() and can_approve('HR'));

create policy attendances_teknisi_select on attendances for select
  using (auth_role() = 'teknisi' and company_id = auth_company_id() and employee_id = auth_employee_id());
create policy attendances_teknisi_insert on attendances for insert
  with check (auth_role() = 'teknisi' and company_id = auth_company_id() and employee_id = auth_employee_id());
create policy attendances_teknisi_update on attendances for update
  using (auth_role() = 'teknisi' and company_id = auth_company_id() and employee_id = auth_employee_id())
  with check (auth_role() = 'teknisi' and company_id = auth_company_id() and employee_id = auth_employee_id());

-- ---------------------------------------------------------------------
-- productivity_entries (PRODUCTIVITY) — same self-scoped pattern
-- ---------------------------------------------------------------------
alter table productivity_entries enable row level security;
create policy productivity_entries_select on productivity_entries for select
  using (company_id = auth_company_id() and can_read('PRODUCTIVITY') and auth_role() <> 'teknisi');
create policy productivity_entries_insert on productivity_entries for insert
  with check (company_id = auth_company_id() and can_write('PRODUCTIVITY') and auth_role() <> 'teknisi');
create policy productivity_entries_update on productivity_entries for update
  using (company_id = auth_company_id() and can_write('PRODUCTIVITY') and auth_role() <> 'teknisi')
  with check (company_id = auth_company_id() and can_write('PRODUCTIVITY') and auth_role() <> 'teknisi');
create policy productivity_entries_delete on productivity_entries for delete
  using (company_id = auth_company_id() and can_approve('PRODUCTIVITY'));

create policy productivity_entries_teknisi_select on productivity_entries for select
  using (auth_role() = 'teknisi' and company_id = auth_company_id() and employee_id = auth_employee_id());
create policy productivity_entries_teknisi_insert on productivity_entries for insert
  with check (auth_role() = 'teknisi' and company_id = auth_company_id() and employee_id = auth_employee_id());
create policy productivity_entries_teknisi_update on productivity_entries for update
  using (auth_role() = 'teknisi' and company_id = auth_company_id() and employee_id = auth_employee_id())
  with check (auth_role() = 'teknisi' and company_id = auth_company_id() and employee_id = auth_employee_id());

-- ---------------------------------------------------------------------
-- work_orders (OPERATIONS) — general UPDATE excludes teknisi; teknisi
-- may only UPDATE work orders assigned_to their own employee row.
-- SELECT/INSERT/DELETE follow the normal OPERATIONS module pattern.
-- ---------------------------------------------------------------------
alter table work_orders enable row level security;
create policy work_orders_select on work_orders for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy work_orders_insert on work_orders for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy work_orders_update on work_orders for update
  using (company_id = auth_company_id() and can_write('OPERATIONS') and auth_role() <> 'teknisi')
  with check (company_id = auth_company_id() and can_write('OPERATIONS') and auth_role() <> 'teknisi');
create policy work_orders_delete on work_orders for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

create policy work_orders_teknisi_update on work_orders for update
  using (auth_role() = 'teknisi' and company_id = auth_company_id() and assigned_to = auth_employee_id())
  with check (auth_role() = 'teknisi' and company_id = auth_company_id() and assigned_to = auth_employee_id());
