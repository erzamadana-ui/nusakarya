-- =====================================================================
-- 0003_procurement_commerce_finance.sql
-- =====================================================================

-- =====================  PROCUREMENT  =====================

create table vendors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  vendor_type text check (vendor_type in ('material','jasa','subkon','sewa')),
  npwp text,
  pkp boolean default false,
  address text,
  city text,
  phone text,
  email text,
  pic_name text,
  bank_name text,
  bank_account text,
  bank_holder text,
  payment_term_days int default 30,
  rating numeric,
  status text not null default 'aktif' check (status in ('aktif','blacklist','nonaktif')),
  documents jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_vendors_company on vendors(company_id);
create trigger trg_vendors_updated_at before update on vendors
  for each row execute function set_updated_at();

create table vendor_scorecards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  period_code text not null,
  otd_score numeric,
  quality_score numeric,
  price_score numeric,
  compliance_score numeric,
  total_score numeric,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_vsc_company on vendor_scorecards(company_id);
create index idx_vsc_vendor on vendor_scorecards(vendor_id);
create trigger trg_vsc_updated_at before update on vendor_scorecards
  for each row execute function set_updated_at();

create table item_catalog (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text check (category in ('NTE','NON_NTE','ASSET','JASA')),
  uom text,
  last_price numeric,
  is_serial_tracked boolean default false,
  is_consignment boolean default false,
  principal text,
  min_stock numeric default 0,
  spec jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_itemcatalog_company on item_catalog(company_id);
create trigger trg_itemcatalog_updated_at before update on item_catalog
  for each row execute function set_updated_at();

create table purchase_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  pr_no text not null,
  request_date date not null default current_date,
  requester_id uuid references auth.users(id),
  branch_id uuid references branches(id),
  unit text,
  need_by_date date,
  purpose text,
  project_id uuid,
  total_estimate numeric default 0,
  status text not null default 'draft' check (status in ('draft','diajukan','disetujui','ditolak','sebagian_po','selesai','batal')),
  current_step int default 1,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, pr_no)
);
create index idx_pr_company on purchase_requests(company_id);
create index idx_pr_project on purchase_requests(project_id);
create trigger trg_pr_updated_at before update on purchase_requests
  for each row execute function set_updated_at();

create table pr_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  pr_id uuid not null references purchase_requests(id) on delete cascade,
  item_id uuid references item_catalog(id),
  description text,
  qty numeric not null default 0,
  uom text,
  estimate_price numeric default 0,
  amount numeric default 0,
  qty_po numeric default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_pritems_company on pr_items(company_id);
create index idx_pritems_pr on pr_items(pr_id);
create index idx_pritems_item on pr_items(item_id);
create trigger trg_pritems_updated_at before update on pr_items
  for each row execute function set_updated_at();

create table rfqs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  rfq_no text not null,
  pr_id uuid references purchase_requests(id),
  issue_date date,
  due_date date,
  status text default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, rfq_no)
);
create index idx_rfqs_company on rfqs(company_id);
create index idx_rfqs_pr on rfqs(pr_id);
create trigger trg_rfqs_updated_at before update on rfqs
  for each row execute function set_updated_at();

create table rfq_quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  rfq_id uuid not null references rfqs(id) on delete cascade,
  vendor_id uuid not null references vendors(id),
  quote_no text,
  quote_date date,
  total_amount numeric default 0,
  delivery_days int,
  payment_term text,
  is_selected boolean default false,
  note text,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_rfqquotes_company on rfq_quotes(company_id);
create index idx_rfqquotes_rfq on rfq_quotes(rfq_id);
create index idx_rfqquotes_vendor on rfq_quotes(vendor_id);
create trigger trg_rfqquotes_updated_at before update on rfq_quotes
  for each row execute function set_updated_at();

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  po_no text not null,
  po_date date not null default current_date,
  vendor_id uuid not null references vendors(id),
  pr_id uuid references purchase_requests(id),
  rfq_id uuid references rfqs(id),
  delivery_date date,
  warehouse_id uuid,
  subtotal numeric default 0,
  discount numeric default 0,
  ppn numeric default 0,
  total numeric default 0,
  currency text not null default 'IDR',
  payment_term_days int default 30,
  status text not null default 'draft' check (status in ('draft','diajukan','disetujui','dikirim','diterima_sebagian','diterima','ditutup','batal')),
  note text,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, po_no)
);
create index idx_po_company on purchase_orders(company_id);
create index idx_po_vendor on purchase_orders(vendor_id);
create index idx_po_pr on purchase_orders(pr_id);
create trigger trg_po_updated_at before update on purchase_orders
  for each row execute function set_updated_at();

create table po_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  po_id uuid not null references purchase_orders(id) on delete cascade,
  item_id uuid references item_catalog(id),
  description text,
  qty numeric not null default 0,
  uom text,
  price numeric default 0,
  discount numeric default 0,
  amount numeric default 0,
  qty_received numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_poitems_company on po_items(company_id);
create index idx_poitems_po on po_items(po_id);
create index idx_poitems_item on po_items(item_id);
create trigger trg_poitems_updated_at before update on po_items
  for each row execute function set_updated_at();

create table goods_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  gr_no text not null,
  gr_date date not null default current_date,
  po_id uuid not null references purchase_orders(id),
  warehouse_id uuid,
  received_by uuid references auth.users(id),
  status text not null default 'draft' check (status in ('draft','diterima','ditolak')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, gr_no)
);
create index idx_gr_company on goods_receipts(company_id);
create index idx_gr_po on goods_receipts(po_id);
create trigger trg_gr_updated_at before update on goods_receipts
  for each row execute function set_updated_at();

create table gr_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  gr_id uuid not null references goods_receipts(id) on delete cascade,
  po_item_id uuid not null references po_items(id),
  item_id uuid references item_catalog(id),
  qty_received numeric not null default 0,
  qty_rejected numeric default 0,
  reject_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_gritems_company on gr_items(company_id);
create index idx_gritems_gr on gr_items(gr_id);
create index idx_gritems_poitem on gr_items(po_item_id);
create trigger trg_gritems_updated_at before update on gr_items
  for each row execute function set_updated_at();

create table vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  inv_no text not null,
  vendor_invoice_no text,
  invoice_date date not null default current_date,
  due_date date,
  vendor_id uuid not null references vendors(id),
  po_id uuid references purchase_orders(id),
  gr_id uuid references goods_receipts(id),
  dpp numeric default 0,
  ppn numeric default 0,
  pph23 numeric default 0,
  total numeric default 0,
  paid_amount numeric default 0,
  match_status text default 'belum' check (match_status in ('belum','cocok','selisih')),
  match_note text,
  status text not null default 'draft' check (status in ('draft','diajukan','diverifikasi','disetujui','dibayar_sebagian','lunas','ditolak')),
  faktur_pajak_no text,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, inv_no)
);
create index idx_vinv_company on vendor_invoices(company_id);
create index idx_vinv_vendor on vendor_invoices(vendor_id);
create index idx_vinv_po on vendor_invoices(po_id);
create trigger trg_vinv_updated_at before update on vendor_invoices
  for each row execute function set_updated_at();

create table ap_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  payment_no text not null,
  payment_date date not null default current_date,
  vendor_id uuid not null references vendors(id),
  invoice_id uuid references vendor_invoices(id),
  amount numeric not null default 0,
  method text,
  bank_ref text,
  note text,
  status text default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, payment_no)
);
create index idx_appay_company on ap_payments(company_id);
create index idx_appay_vendor on ap_payments(vendor_id);
create index idx_appay_invoice on ap_payments(invoice_id);
create trigger trg_appay_updated_at before update on ap_payments
  for each row execute function set_updated_at();

-- =====================  COMMERCE  =====================

create table customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  customer_type text check (customer_type in ('principal','korporat','retail')),
  npwp text,
  address text,
  city text,
  phone text,
  email text,
  pic_name text,
  payment_term_days int default 30,
  status text default 'aktif',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_customers_company on customers(company_id);
create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();

create table contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contract_no text not null,
  contract_name text not null,
  customer_id uuid not null references customers(id),
  contract_type text check (contract_type in ('deployment','manage_service','maintenance','borongan','unit_price')),
  start_date date,
  end_date date,
  contract_value numeric default 0,
  retention_percent numeric default 5,
  sla_json jsonb,
  penalty_json jsonb,
  status text not null default 'draft' check (status in ('draft','aktif','selesai','putus','expired')),
  file_url text,
  pic_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, contract_no)
);
create index idx_contracts_company on contracts(company_id);
create index idx_contracts_customer on contracts(customer_id);
create trigger trg_contracts_updated_at before update on contracts
  for each row execute function set_updated_at();

create table contract_price_list (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  job_type_id uuid references job_types(id),
  item_code text,
  description text,
  uom text,
  unit_price numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_cpl_company on contract_price_list(company_id);
create index idx_cpl_contract on contract_price_list(contract_id);
create trigger trg_cpl_updated_at before update on contract_price_list
  for each row execute function set_updated_at();

create table spk (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  spk_no text not null,
  contract_id uuid not null references contracts(id),
  spk_date date not null default current_date,
  title text not null,
  scope text,
  location text,
  branch_id uuid references branches(id),
  start_date date,
  end_date date,
  spk_value numeric default 0,
  status text not null default 'draft' check (status in ('draft','aktif','selesai','batal')),
  file_url text,
  pic_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, spk_no)
);
create index idx_spk_company on spk(company_id);
create index idx_spk_contract on spk(contract_id);
create trigger trg_spk_updated_at before update on spk
  for each row execute function set_updated_at();

create table progress_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  claim_no text not null,
  spk_id uuid references spk(id),
  contract_id uuid not null references contracts(id),
  period_start date,
  period_end date,
  progress_percent numeric default 0,
  claim_amount numeric default 0,
  retention_amount numeric default 0,
  status text not null default 'draft' check (status in ('draft','diajukan','diverifikasi','disetujui','ditolak','ditagihkan')),
  ba_no text,
  ba_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, claim_no)
);
create index idx_pclaim_company on progress_claims(company_id);
create index idx_pclaim_spk on progress_claims(spk_id);
create index idx_pclaim_contract on progress_claims(contract_id);
create trigger trg_pclaim_updated_at before update on progress_claims
  for each row execute function set_updated_at();

create table progress_claim_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  claim_id uuid not null references progress_claims(id) on delete cascade,
  price_list_id uuid references contract_price_list(id),
  description text,
  uom text,
  qty numeric default 0,
  unit_price numeric default 0,
  amount numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_pclaimitems_company on progress_claim_items(company_id);
create index idx_pclaimitems_claim on progress_claim_items(claim_id);
create trigger trg_pclaimitems_updated_at before update on progress_claim_items
  for each row execute function set_updated_at();

create table bast (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  bast_no text not null,
  bast_date date not null default current_date,
  spk_id uuid references spk(id),
  project_id uuid,
  work_order_id uuid,
  customer_id uuid not null references customers(id),
  title text,
  scope text,
  signed_by_customer boolean default false,
  signer_name text,
  signer_position text,
  signature_url text,
  geotag_lat numeric,
  geotag_lng numeric,
  status text not null default 'draft' check (status in ('draft','diajukan','ditandatangani','ditolak')),
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, bast_no)
);
create index idx_bast_company on bast(company_id);
create index idx_bast_customer on bast(customer_id);
create index idx_bast_spk on bast(spk_id);
create trigger trg_bast_updated_at before update on bast
  for each row execute function set_updated_at();

create table ar_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  inv_no text not null,
  invoice_date date not null default current_date,
  due_date date,
  customer_id uuid not null references customers(id),
  contract_id uuid references contracts(id),
  spk_id uuid references spk(id),
  claim_id uuid references progress_claims(id),
  dpp numeric default 0,
  ppn numeric default 0,
  pph23 numeric default 0,
  total numeric default 0,
  paid_amount numeric default 0,
  status text not null default 'draft' check (status in ('draft','diajukan','terkirim','dibayar_sebagian','lunas','overdue','batal')),
  faktur_pajak_no text,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, inv_no)
);
create index idx_arinv_company on ar_invoices(company_id);
create index idx_arinv_customer on ar_invoices(customer_id);
create index idx_arinv_contract on ar_invoices(contract_id);
create trigger trg_arinv_updated_at before update on ar_invoices
  for each row execute function set_updated_at();

create table ar_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  payment_no text not null,
  payment_date date not null default current_date,
  customer_id uuid not null references customers(id),
  invoice_id uuid references ar_invoices(id),
  amount numeric not null default 0,
  method text,
  bank_ref text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, payment_no)
);
create index idx_arpay_company on ar_payments(company_id);
create index idx_arpay_customer on ar_payments(customer_id);
create index idx_arpay_invoice on ar_payments(invoice_id);
create trigger trg_arpay_updated_at before update on ar_payments
  for each row execute function set_updated_at();

create table sla_penalties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  period_code text not null,
  description text,
  breach_count int default 0,
  penalty_amount numeric default 0,
  status text default 'draft',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_slapen_company on sla_penalties(company_id);
create index idx_slapen_contract on sla_penalties(contract_id);
create trigger trg_slapen_updated_at before update on sla_penalties
  for each row execute function set_updated_at();

-- =====================  FINANCE  =====================

create table cost_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  cost_type text check (cost_type in ('material','upah','subkon','transport','overhead','lain')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_costcat_company on cost_categories(company_id);
create trigger trg_costcat_updated_at before update on cost_categories
  for each row execute function set_updated_at();

create table job_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid,
  spk_id uuid references spk(id),
  work_order_id uuid,
  cost_category_id uuid not null references cost_categories(id),
  cost_date date not null default current_date,
  description text,
  amount numeric not null default 0,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_jobcosts_company on job_costs(company_id);
create index idx_jobcosts_project on job_costs(project_id);
create index idx_jobcosts_spk on job_costs(spk_id);
create index idx_jobcosts_category on job_costs(cost_category_id);
create trigger trg_jobcosts_updated_at before update on job_costs
  for each row execute function set_updated_at();

create table budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period_code text not null,
  unit text,
  cost_category_id uuid references cost_categories(id),
  project_id uuid,
  budget_amount numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_budgets_company on budgets(company_id);
create index idx_budgets_category on budgets(cost_category_id);
create index idx_budgets_project on budgets(project_id);
create trigger trg_budgets_updated_at before update on budgets
  for each row execute function set_updated_at();

create table cash_flows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  flow_date date not null default current_date,
  direction text not null check (direction in ('in','out')),
  category text,
  description text,
  amount numeric not null default 0,
  ref_type text,
  ref_id uuid,
  bank_account text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_cashflows_company on cash_flows(company_id);
create index idx_cashflows_ref on cash_flows(ref_type, ref_id);
create trigger trg_cashflows_updated_at before update on cash_flows
  for each row execute function set_updated_at();

create table partner_payment_sla (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  vendor_id uuid references vendors(id),
  target_days int not null default 30,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_pps_company on partner_payment_sla(company_id);
create index idx_pps_vendor on partner_payment_sla(vendor_id);
create trigger trg_pps_updated_at before update on partner_payment_sla
  for each row execute function set_updated_at();
