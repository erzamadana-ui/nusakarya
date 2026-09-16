-- =====================================================================
-- 0006_design_deployment.sql — Projects, Survey, DRM, BoQ, Milestones,
--                               Progress, Documents, QC, RFS
-- =====================================================================

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_code text not null,
  project_name text not null,
  customer_id uuid not null references customers(id),
  contract_id uuid references contracts(id),
  spk_id uuid references spk(id),
  project_type text check (project_type in ('deployment','relokasi','upgrade','recovery','manage_service')),
  branch_id uuid references branches(id),
  location text,
  lat numeric,
  lng numeric,
  start_date date,
  target_date date,
  actual_finish_date date,
  contract_value numeric default 0,
  budget_cost numeric default 0,
  progress_percent numeric default 0,
  status text not null default 'perencanaan' check (status in ('perencanaan','survey','design','approval','pelaksanaan','testing','bast','selesai','hold','batal')),
  pm_id uuid references employees(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, project_code)
);
create index idx_projects_company on projects(company_id);
create index idx_projects_customer on projects(customer_id);
create index idx_projects_contract on projects(contract_id);
create index idx_projects_spk on projects(spk_id);
create index idx_projects_branch on projects(branch_id);
create trigger trg_projects_updated_at before update on projects
  for each row execute function set_updated_at();

-- backfill FKs deferred from earlier migrations that reference projects(id)
alter table purchase_requests add constraint fk_pr_project foreign key (project_id) references projects(id);
alter table job_costs add constraint fk_jobcosts_project foreign key (project_id) references projects(id);
alter table budgets add constraint fk_budgets_project foreign key (project_id) references projects(id);
alter table material_requests add constraint fk_mr_project foreign key (project_id) references projects(id);
alter table material_usages add constraint fk_matusage_project foreign key (project_id) references projects(id);
alter table bast add constraint fk_bast_project foreign key (project_id) references projects(id);
alter table work_orders add constraint fk_wo_project foreign key (project_id) references projects(id);
create index idx_wo_project on work_orders(project_id);

create table surveys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  survey_no text not null,
  project_id uuid not null references projects(id) on delete cascade,
  survey_date date not null default current_date,
  surveyor_id uuid references employees(id),
  location text,
  lat numeric,
  lng numeric,
  findings text,
  feasibility text check (feasibility in ('layak','layak_bersyarat','tidak_layak')),
  recommendation text,
  photo_urls jsonb,
  status text default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, survey_no)
);
create index idx_surveys_company on surveys(company_id);
create index idx_surveys_project on surveys(project_id);
create trigger trg_surveys_updated_at before update on surveys
  for each row execute function set_updated_at();

create table drm_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  drm_no text not null,
  project_id uuid not null references projects(id) on delete cascade,
  drm_date date not null default current_date,
  participants jsonb,
  agenda text,
  decisions text,
  action_items jsonb,
  status text default 'draft',
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, drm_no)
);
create index idx_drm_company on drm_sessions(company_id);
create index idx_drm_project on drm_sessions(project_id);
create trigger trg_drm_updated_at before update on drm_sessions
  for each row execute function set_updated_at();

create table boq_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  boq_type text not null check (boq_type in ('plan','revisi','actual')),
  version int not null default 1,
  item_id uuid references item_catalog(id),
  item_code text,
  description text,
  uom text,
  qty numeric default 0,
  unit_price numeric default 0,
  amount numeric default 0,
  category text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_boq_company on boq_items(company_id);
create index idx_boq_project on boq_items(project_id);
create index idx_boq_item on boq_items(item_id);
create trigger trg_boq_updated_at before update on boq_items
  for each row execute function set_updated_at();

-- backfill FK from material_usages.boq_item_id -> boq_items(id)
alter table material_usages add constraint fk_matusage_boqitem foreign key (boq_item_id) references boq_items(id);

create table project_milestones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  seq int not null default 1,
  milestone_name text not null,
  weight_percent numeric default 0,
  plan_start date,
  plan_end date,
  actual_start date,
  actual_end date,
  progress_percent numeric default 0,
  status text default 'belum_mulai',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_milestones_company on project_milestones(company_id);
create index idx_milestones_project on project_milestones(project_id);
create trigger trg_milestones_updated_at before update on project_milestones
  for each row execute function set_updated_at();

create table progress_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  report_date date not null default current_date,
  plan_percent numeric default 0,
  actual_percent numeric default 0,
  deviation numeric default 0,
  week_no int,
  activities text,
  constraints text,
  next_plan text,
  photo_urls jsonb,
  reported_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_progrep_company on progress_reports(company_id);
create index idx_progrep_project on progress_reports(project_id);
create trigger trg_progrep_updated_at before update on progress_reports
  for each row execute function set_updated_at();

create table documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid references projects(id),
  doc_type text not null check (doc_type in ('ABD','SHOPDRAWING','QC','OTDR','IZIN','KONTRAK','BAST','FOTO','LAINNYA')),
  doc_no text,
  title text not null,
  version int not null default 1,
  parent_document_id uuid references documents(id),
  file_url text,
  file_size bigint,
  status text not null default 'draft' check (status in ('draft','review','approved','rejected','obsolete')),
  reviewed_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_documents_company on documents(company_id);
create index idx_documents_project on documents(project_id);
create index idx_documents_parent on documents(parent_document_id);
create trigger trg_documents_updated_at before update on documents
  for each row execute function set_updated_at();

create table qc_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid references projects(id),
  work_order_id uuid references work_orders(id),
  qc_no text,
  qc_date date not null default current_date,
  qc_type text check (qc_type in ('OTDR','OPM','VISUAL','SPLICING','INSTALASI')),
  network_element_id uuid references network_elements(id),
  measured_value numeric,
  threshold_value numeric,
  unit text,
  result text check (result in ('lulus','tidak_lulus','perbaikan')),
  inspector_id uuid references employees(id),
  photo_urls jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_qcrecords_company on qc_records(company_id);
create index idx_qcrecords_project on qc_records(project_id);
create index idx_qcrecords_wo on qc_records(work_order_id);
create index idx_qcrecords_netel on qc_records(network_element_id);
create trigger trg_qcrecords_updated_at before update on qc_records
  for each row execute function set_updated_at();

create table rfs_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  rfs_no text not null,
  rfs_date date not null default current_date,
  scope text,
  capacity int,
  status text not null default 'draft' check (status in ('draft','diajukan','disetujui','ditolak')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, rfs_no)
);
create index idx_rfs_company on rfs_records(company_id);
create index idx_rfs_project on rfs_records(project_id);
create trigger trg_rfs_updated_at before update on rfs_records
  for each row execute function set_updated_at();
