-- =====================================================================
-- 0019_commerce_procurement_finance_extended.sql — Tahap 2:
-- Commerce (CRM), Procurement (kontrak & retur vendor), Finance (COA,
-- jurnal umum, pajak, kas kecil, kasbon, rekening & rekonsiliasi bank)
-- =====================================================================

-- =====================  COMMERCE  =====================

-- ---------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  opp_no text not null,
  title text not null,
  customer_id uuid not null references customers(id),
  opportunity_type text check (opportunity_type in ('tender','penunjukan_langsung','perpanjangan','upsell')),
  estimated_value numeric default 0,
  probability_percent numeric default 0,
  stage text not null default 'lead' check (stage in ('lead','kualifikasi','penawaran','negosiasi','menang','kalah','batal')),
  source text,
  submit_deadline date,
  decision_date date,
  owner_id uuid references employees(id),
  competitor_note text,
  lost_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, opp_no)
);
create index idx_opportunities_company on opportunities(company_id);
create index idx_opportunities_customer on opportunities(customer_id);
create index idx_opportunities_owner on opportunities(owner_id);
create trigger trg_opportunities_updated_at before update on opportunities
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- opportunity_activities
-- ---------------------------------------------------------------------
create table opportunity_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  activity_date date not null default current_date,
  activity_type text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_opportunity_activities_company on opportunity_activities(company_id);
create index idx_opportunity_activities_opportunity on opportunity_activities(opportunity_id);
create trigger trg_opportunity_activities_updated_at before update on opportunity_activities
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- customer_complaints
-- ---------------------------------------------------------------------
create table customer_complaints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  complaint_no text not null,
  customer_id uuid not null references customers(id),
  contract_id uuid references contracts(id),
  complaint_date date not null default current_date,
  channel text,
  category text,
  severity text check (severity in ('rendah','sedang','tinggi')),
  description text,
  root_cause_id uuid references root_causes(id),
  corrective_action text,
  resolved_at timestamptz,
  csat_score integer,
  status text not null default 'baru' check (status in ('baru','proses','selesai','eskalasi')),
  pic_id uuid references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, complaint_no)
);
create index idx_customer_complaints_company on customer_complaints(company_id);
create index idx_customer_complaints_customer on customer_complaints(customer_id);
create index idx_customer_complaints_contract on customer_complaints(contract_id);
create trigger trg_customer_complaints_updated_at before update on customer_complaints
  for each row execute function set_updated_at();

-- =====================  PROCUREMENT  =====================

-- ---------------------------------------------------------------------
-- vendor_contracts
-- ---------------------------------------------------------------------
create table vendor_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contract_no text not null,
  vendor_id uuid not null references vendors(id),
  contract_type text check (contract_type in ('rangka','blanket_po','sewa','jasa_berkala')),
  start_date date,
  end_date date,
  ceiling_value numeric default 0,
  used_value numeric default 0,
  payment_term_days integer,
  status text not null default 'aktif' check (status in ('draft','aktif','berakhir','dibatalkan')),
  file_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, contract_no)
);
create index idx_vendor_contracts_company on vendor_contracts(company_id);
create index idx_vendor_contracts_vendor on vendor_contracts(vendor_id);
create trigger trg_vendor_contracts_updated_at before update on vendor_contracts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- vendor_returns (RTV)
-- ---------------------------------------------------------------------
create table vendor_returns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  rtv_no text not null,
  rtv_date date not null default current_date,
  vendor_id uuid not null references vendors(id),
  gr_id uuid references goods_receipts(id),
  po_id uuid references purchase_orders(id),
  reason text,
  total_amount numeric default 0,
  status text not null default 'draft' check (status in ('draft','diajukan','disetujui','dikirim','selesai','ditolak')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, rtv_no)
);
create index idx_vendor_returns_company on vendor_returns(company_id);
create index idx_vendor_returns_vendor on vendor_returns(vendor_id);
create index idx_vendor_returns_gr on vendor_returns(gr_id);
create index idx_vendor_returns_po on vendor_returns(po_id);
create trigger trg_vendor_returns_updated_at before update on vendor_returns
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- vendor_return_items
-- ---------------------------------------------------------------------
create table vendor_return_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  rtv_id uuid not null references vendor_returns(id) on delete cascade,
  item_id uuid not null references item_catalog(id),
  qty numeric not null default 0,
  uom text,
  price numeric default 0,
  amount numeric default 0,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_vendor_return_items_company on vendor_return_items(company_id);
create index idx_vendor_return_items_rtv on vendor_return_items(rtv_id);
create index idx_vendor_return_items_item on vendor_return_items(item_id);
create trigger trg_vendor_return_items_updated_at before update on vendor_return_items
  for each row execute function set_updated_at();

-- =====================  FINANCE  =====================

-- ---------------------------------------------------------------------
-- chart_of_accounts
-- ---------------------------------------------------------------------
create table chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  account_code text not null,
  account_name text not null,
  account_type text not null check (account_type in ('aset','liabilitas','ekuitas','pendapatan','beban')),
  parent_code text,
  normal_balance text not null check (normal_balance in ('debit','kredit')),
  is_postable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, account_code)
);
create index idx_chart_of_accounts_company on chart_of_accounts(company_id);
create trigger trg_chart_of_accounts_updated_at before update on chart_of_accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  journal_no text not null,
  journal_date date not null default current_date,
  description text,
  source_type text,
  source_id uuid,
  total_debit numeric not null default 0,
  total_credit numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','diposting','dibatalkan')),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, journal_no)
);
create index idx_journal_entries_company on journal_entries(company_id);
create index idx_journal_entries_source on journal_entries(source_type, source_id);
create trigger trg_journal_entries_updated_at before update on journal_entries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- journal_lines
-- ---------------------------------------------------------------------
create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  journal_id uuid not null references journal_entries(id) on delete cascade,
  account_code text not null,
  description text,
  debit numeric not null default 0,
  credit numeric not null default 0,
  cost_center text,
  project_id uuid references projects(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_journal_lines_company on journal_lines(company_id);
create index idx_journal_lines_journal on journal_lines(journal_id);
create index idx_journal_lines_project on journal_lines(project_id);
create trigger trg_journal_lines_updated_at before update on journal_lines
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- tax_records
-- ---------------------------------------------------------------------
create table tax_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  record_no text not null,
  tax_period text not null,
  tax_type text not null check (tax_type in ('ppn_keluaran','ppn_masukan','pph21','pph23','pph4a2','pph_final')),
  ref_type text,
  ref_id uuid,
  counterparty_name text,
  counterparty_npwp text,
  dpp numeric default 0,
  tax_amount numeric default 0,
  faktur_no text,
  bukti_potong_no text,
  status text not null default 'draft' check (status in ('draft','dilaporkan','dikoreksi')),
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, record_no)
);
create index idx_tax_records_company on tax_records(company_id);
create index idx_tax_records_ref on tax_records(ref_type, ref_id);
create index idx_tax_records_period on tax_records(tax_period);
create trigger trg_tax_records_updated_at before update on tax_records
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- petty_cash
-- ---------------------------------------------------------------------
create table petty_cash (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  transaction_no text not null,
  transaction_date date not null default current_date,
  branch_id uuid references branches(id),
  direction text not null check (direction in ('in','out')),
  category text,
  description text,
  amount numeric not null default 0,
  balance_after numeric,
  receipt_url text,
  pic_id uuid references employees(id),
  status text not null default 'diajukan' check (status in ('diajukan','disetujui','ditolak')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, transaction_no)
);
create index idx_petty_cash_company on petty_cash(company_id);
create index idx_petty_cash_branch on petty_cash(branch_id);
create index idx_petty_cash_pic on petty_cash(pic_id);
create trigger trg_petty_cash_updated_at before update on petty_cash
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- employee_advances (kasbon)
-- ---------------------------------------------------------------------
create table employee_advances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  advance_no text not null,
  employee_id uuid not null references employees(id),
  request_date date not null default current_date,
  purpose text,
  amount numeric not null default 0,
  due_date date,
  settled_amount numeric not null default 0,
  status text not null default 'diajukan' check (status in ('diajukan','disetujui','dicairkan','sebagian_lunas','lunas','ditolak')),
  approved_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, advance_no)
);
create index idx_employee_advances_company on employee_advances(company_id);
create index idx_employee_advances_employee on employee_advances(employee_id);
create trigger trg_employee_advances_updated_at before update on employee_advances
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- bank_accounts
-- ---------------------------------------------------------------------
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  bank_name text not null,
  account_no text not null,
  account_holder text,
  currency text not null default 'IDR',
  opening_balance numeric default 0,
  current_balance numeric default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, bank_name, account_no)
);
create index idx_bank_accounts_company on bank_accounts(company_id);
create trigger trg_bank_accounts_updated_at before update on bank_accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- bank_reconciliations
-- ---------------------------------------------------------------------
create table bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  recon_no text not null,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  statement_balance numeric default 0,
  book_balance numeric default 0,
  difference numeric default 0,
  status text not null default 'draft' check (status in ('draft','selesai','disetujui')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, recon_no)
);
create index idx_bank_reconciliations_company on bank_reconciliations(company_id);
create index idx_bank_reconciliations_bank_account on bank_reconciliations(bank_account_id);
create trigger trg_bank_reconciliations_updated_at before update on bank_reconciliations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- bank_statement_lines
-- ---------------------------------------------------------------------
create table bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  recon_id uuid not null references bank_reconciliations(id) on delete cascade,
  transaction_date date,
  description text,
  debit numeric default 0,
  credit numeric default 0,
  matched_ref_type text,
  matched_ref_id uuid,
  is_matched boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_bank_statement_lines_company on bank_statement_lines(company_id);
create index idx_bank_statement_lines_recon on bank_statement_lines(recon_id);
create trigger trg_bank_statement_lines_updated_at before update on bank_statement_lines
  for each row execute function set_updated_at();
