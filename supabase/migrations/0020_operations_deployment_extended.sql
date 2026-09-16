-- =====================================================================
-- 0020_operations_deployment_extended.sql — Tahap 2:
-- Operations (NMS/alarm, eskalasi, SLA, knowledge base), Deployment
-- (perizinan, punch list, garansi, subkon), dan referensi master
-- =====================================================================

-- =====================  OPERATIONS  =====================

-- ---------------------------------------------------------------------
-- nms_alarms
-- ---------------------------------------------------------------------
create table nms_alarms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  alarm_id_ext text,
  received_at timestamptz not null default now(),
  severity text check (severity in ('critical','major','minor','warning')),
  source_system text,
  network_element_id uuid references network_elements(id),
  element_ref text,
  alarm_type text,
  description text,
  cleared_at timestamptz,
  ticket_id uuid references tickets(id),
  status text not null default 'baru' check (status in ('baru','diakui','tiket_dibuat','clear','diabaikan')),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_nms_alarms_company on nms_alarms(company_id);
create index idx_nms_alarms_network_element on nms_alarms(network_element_id);
create index idx_nms_alarms_ticket on nms_alarms(ticket_id);
create trigger trg_nms_alarms_updated_at before update on nms_alarms
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- escalation_matrix
-- ---------------------------------------------------------------------
create table escalation_matrix (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  level integer not null,
  branch_id uuid references branches(id),
  severity text,
  elapsed_minutes integer,
  role_to_notify text,
  contact_name text,
  contact_phone text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_escalation_matrix_company on escalation_matrix(company_id);
create index idx_escalation_matrix_branch on escalation_matrix(branch_id);
create trigger trg_escalation_matrix_updated_at before update on escalation_matrix
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- sla_reports
-- ---------------------------------------------------------------------
create table sla_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  report_no text not null,
  customer_id uuid not null references customers(id),
  contract_id uuid references contracts(id),
  period_code text not null,
  total_tickets integer default 0,
  met_count integer default 0,
  breach_count integer default 0,
  compliance_percent numeric default 0,
  mttr_minutes numeric default 0,
  penalty_amount numeric default 0,
  status text not null default 'draft' check (status in ('draft','diajukan','disetujui','terkirim')),
  file_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, report_no)
);
create index idx_sla_reports_company on sla_reports(company_id);
create index idx_sla_reports_customer on sla_reports(customer_id);
create index idx_sla_reports_contract on sla_reports(contract_id);
create trigger trg_sla_reports_updated_at before update on sla_reports
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- knowledge_articles
-- ---------------------------------------------------------------------
create table knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  article_no text not null,
  title text not null,
  category text,
  symptom text,
  root_cause text,
  resolution_steps text,
  applicable_to text,
  attachments jsonb default '[]'::jsonb,
  view_count integer not null default 0,
  is_published boolean not null default false,
  author_id uuid references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, article_no)
);
create index idx_knowledge_articles_company on knowledge_articles(company_id);
create index idx_knowledge_articles_author on knowledge_articles(author_id);
create trigger trg_knowledge_articles_updated_at before update on knowledge_articles
  for each row execute function set_updated_at();

-- =====================  DEPLOYMENT  =====================

-- ---------------------------------------------------------------------
-- permits (perizinan proyek)
-- ---------------------------------------------------------------------
create table permits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  permit_no text not null,
  project_id uuid not null references projects(id) on delete cascade,
  permit_type text check (permit_type in ('row','galian','pemda','kawasan','ketinggian','lingkungan')),
  authority_name text,
  applied_date date,
  issued_date date,
  expiry_date date,
  cost numeric default 0,
  status text not null default 'disiapkan' check (status in ('disiapkan','diajukan','proses','terbit','ditolak','kedaluwarsa')),
  pic_id uuid references employees(id),
  file_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, permit_no)
);
create index idx_permits_company on permits(company_id);
create index idx_permits_project on permits(project_id);
create index idx_permits_pic on permits(pic_id);
create trigger trg_permits_updated_at before update on permits
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- punch_lists
-- ---------------------------------------------------------------------
create table punch_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  punch_no text not null,
  project_id uuid not null references projects(id) on delete cascade,
  bast_id uuid references bast(id),
  found_date date not null default current_date,
  location text,
  lat numeric,
  lng numeric,
  category text,
  description text,
  severity text check (severity in ('minor','mayor','kritis')),
  photo_urls jsonb default '[]'::jsonb,
  assigned_to uuid references employees(id),
  due_date date,
  fixed_date date,
  verified_by uuid references auth.users(id),
  status text not null default 'terbuka' check (status in ('terbuka','diperbaiki','diverifikasi','ditolak','ditutup')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, punch_no)
);
create index idx_punch_lists_company on punch_lists(company_id);
create index idx_punch_lists_project on punch_lists(project_id);
create index idx_punch_lists_bast on punch_lists(bast_id);
create index idx_punch_lists_assigned_to on punch_lists(assigned_to);
create trigger trg_punch_lists_updated_at before update on punch_lists
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- warranty_periods
-- ---------------------------------------------------------------------
create table warranty_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  spk_id uuid references spk(id),
  start_date date not null,
  end_date date not null,
  warranty_months integer,
  scope text,
  status text not null default 'aktif' check (status in ('aktif','berakhir','klaim')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_warranty_periods_company on warranty_periods(company_id);
create index idx_warranty_periods_project on warranty_periods(project_id);
create index idx_warranty_periods_spk on warranty_periods(spk_id);
create trigger trg_warranty_periods_updated_at before update on warranty_periods
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- subcontract_packages
-- ---------------------------------------------------------------------
create table subcontract_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  package_no text not null,
  project_id uuid not null references projects(id) on delete cascade,
  vendor_id uuid not null references vendors(id),
  scope text,
  contract_value numeric default 0,
  start_date date,
  end_date date,
  progress_percent numeric default 0,
  retention_percent numeric default 0,
  status text not null default 'draft' check (status in ('draft','aktif','selesai','putus')),
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, package_no)
);
create index idx_subcontract_packages_company on subcontract_packages(company_id);
create index idx_subcontract_packages_project on subcontract_packages(project_id);
create index idx_subcontract_packages_vendor on subcontract_packages(vendor_id);
create trigger trg_subcontract_packages_updated_at before update on subcontract_packages
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- subcontract_progress
-- ---------------------------------------------------------------------
create table subcontract_progress (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  package_id uuid not null references subcontract_packages(id) on delete cascade,
  report_date date not null default current_date,
  progress_percent numeric default 0,
  amount_claimed numeric default 0,
  verified_by uuid references auth.users(id),
  note text,
  photo_urls jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_subcontract_progress_company on subcontract_progress(company_id);
create index idx_subcontract_progress_package on subcontract_progress(package_id);
create trigger trg_subcontract_progress_updated_at before update on subcontract_progress
  for each row execute function set_updated_at();

-- =====================  CORE  =====================

-- ---------------------------------------------------------------------
-- master_references
-- ---------------------------------------------------------------------
create table master_references (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  ref_group text not null check (ref_group in ('STO','AREA','KATEGORI_GANGGUAN','JENIS_MATERIAL','BANK','SATUAN','LAINNYA')),
  code text not null,
  name text not null,
  parent_code text,
  sort_order integer default 0,
  attributes jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, ref_group, code)
);
create index idx_master_references_company on master_references(company_id);
create index idx_master_references_group on master_references(ref_group);
create trigger trg_master_references_updated_at before update on master_references
  for each row execute function set_updated_at();
