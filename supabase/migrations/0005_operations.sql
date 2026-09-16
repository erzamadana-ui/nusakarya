-- =====================================================================
-- 0005_operations.sql — Network Elements, Tickets, Work Orders, Maintenance
-- =====================================================================

create table network_elements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  element_type text not null check (element_type in ('ODC','ODP','FAT','FDT','CLOSURE','TIANG','KABEL','OLT','SEGMENT')),
  code text not null,
  name text,
  parent_id uuid references network_elements(id),
  branch_id uuid references branches(id),
  sto text,
  lat numeric,
  lng numeric,
  capacity int,
  used int default 0,
  status text not null default 'aktif' check (status in ('aktif','penuh','rusak','nonaktif')),
  install_date date,
  last_maintenance_at timestamptz,
  attributes jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_netel_company on network_elements(company_id);
create index idx_netel_parent on network_elements(parent_id);
create index idx_netel_branch on network_elements(branch_id);
create trigger trg_netel_updated_at before update on network_elements
  for each row execute function set_updated_at();

create table root_causes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  aspect text not null check (aspect in ('People','Process','Tools','Partnership')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_rootcause_company on root_causes(company_id);
create trigger trg_rootcause_updated_at before update on root_causes
  for each row execute function set_updated_at();

create table tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  ticket_no text not null,
  source text check (source in ('pelanggan','nms','preventive','internal','principal')),
  ticket_type text check (ticket_type in ('gangguan','keluhan','request','massal')),
  customer_name text,
  customer_no text,
  customer_phone text,
  address text,
  lat numeric,
  lng numeric,
  branch_id uuid references branches(id),
  network_element_id uuid references network_elements(id),
  category text,
  sub_category text,
  severity text check (severity in ('kritis','tinggi','sedang','rendah')),
  reported_at timestamptz not null default now(),
  sla_minutes int,
  sla_due_at timestamptz,
  responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  ttr_minutes int,
  sla_status text check (sla_status in ('on_track','warning','breach','met')),
  status text not null default 'open' check (status in ('open','assigned','on_progress','pending','resolved','closed','cancelled')),
  assigned_to uuid references employees(id),
  root_cause_id uuid references root_causes(id),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, ticket_no)
);
create index idx_tickets_company on tickets(company_id);
create index idx_tickets_branch on tickets(branch_id);
create index idx_tickets_netel on tickets(network_element_id);
create index idx_tickets_assigned on tickets(assigned_to);
create index idx_tickets_rootcause on tickets(root_cause_id);
create trigger trg_tickets_updated_at before update on tickets
  for each row execute function set_updated_at();

create table ticket_sla_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  ticket_id uuid not null references tickets(id) on delete cascade,
  event_type text not null check (event_type in ('start','pause','resume','stop')),
  reason text,
  event_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_slaevents_company on ticket_sla_events(company_id);
create index idx_slaevents_ticket on ticket_sla_events(ticket_id);
create trigger trg_slaevents_updated_at before update on ticket_sla_events
  for each row execute function set_updated_at();

create table ticket_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  ticket_id uuid not null references tickets(id) on delete cascade,
  activity_type text,
  note text,
  lat numeric,
  lng numeric,
  photo_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_ticketact_company on ticket_activities(company_id);
create index idx_ticketact_ticket on ticket_activities(ticket_id);
create trigger trg_ticketact_updated_at before update on ticket_activities
  for each row execute function set_updated_at();

create table work_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  wo_no text not null,
  wo_type text not null check (wo_type in ('PSB','MIGRASI','GANGGUAN','MAINTENANCE','DEPLOYMENT','SURVEY','DISMANTLE')),
  ticket_id uuid references tickets(id),
  project_id uuid,
  spk_id uuid references spk(id),
  job_type_id uuid references job_types(id),
  title text,
  description text,
  customer_name text,
  customer_no text,
  address text,
  lat numeric,
  lng numeric,
  branch_id uuid references branches(id),
  scheduled_at timestamptz,
  assigned_to uuid references employees(id),
  assigned_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  duration_minutes int,
  status text not null default 'draft' check (status in ('draft','dispatched','accepted','on_progress','pending_material','done','failed','cancelled')),
  fail_reason text,
  result_note text,
  evidence_count int default 0,
  points numeric default 0,
  amount numeric default 0,
  qc_status text default 'belum' check (qc_status in ('belum','lulus','tidak_lulus')),
  qc_by uuid references auth.users(id),
  qc_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, wo_no)
);
create index idx_wo_company on work_orders(company_id);
create index idx_wo_ticket on work_orders(ticket_id);
create index idx_wo_spk on work_orders(spk_id);
create index idx_wo_jobtype on work_orders(job_type_id);
create index idx_wo_assigned on work_orders(assigned_to);
create index idx_wo_branch on work_orders(branch_id);
create trigger trg_wo_updated_at before update on work_orders
  for each row execute function set_updated_at();

-- backfill FKs deferred from earlier migrations that reference work_orders(id)
alter table productivity_entries add constraint fk_prodentries_wo foreign key (work_order_id) references work_orders(id);
alter table stock_movements add constraint fk_stockmove_wo foreign key (work_order_id) references work_orders(id);
alter table serials add constraint fk_serials_wo foreign key (work_order_id) references work_orders(id);
alter table material_requests add constraint fk_mr_wo foreign key (work_order_id) references work_orders(id);
alter table material_usages add constraint fk_matusage_wo foreign key (work_order_id) references work_orders(id);
alter table job_costs add constraint fk_jobcosts_wo foreign key (work_order_id) references work_orders(id);
alter table bast add constraint fk_bast_wo foreign key (work_order_id) references work_orders(id);
create index idx_jobcosts_wo on job_costs(work_order_id);
create index idx_bast_wo on bast(work_order_id);

create table wo_checklists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  work_order_id uuid not null references work_orders(id) on delete cascade,
  seq int not null default 1,
  question text not null,
  answer_type text check (answer_type in ('boolean','text','number','photo','signature')),
  answer_value text,
  photo_url text,
  is_mandatory boolean default true,
  is_passed boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_wochecklist_company on wo_checklists(company_id);
create index idx_wochecklist_wo on wo_checklists(work_order_id);
create trigger trg_wochecklist_updated_at before update on wo_checklists
  for each row execute function set_updated_at();

create table maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  plan_no text not null,
  plan_name text not null,
  plan_type text check (plan_type in ('preventive','patroli','pengukuran','perapihan')),
  frequency text check (frequency in ('harian','mingguan','bulanan','triwulan','semester','tahunan')),
  branch_id uuid references branches(id),
  network_element_id uuid references network_elements(id),
  route_json jsonb,
  next_due_date date,
  assigned_to uuid references employees(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, plan_no)
);
create index idx_maintplan_company on maintenance_plans(company_id);
create index idx_maintplan_branch on maintenance_plans(branch_id);
create index idx_maintplan_netel on maintenance_plans(network_element_id);
create trigger trg_maintplan_updated_at before update on maintenance_plans
  for each row execute function set_updated_at();

create table maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  plan_id uuid not null references maintenance_plans(id) on delete cascade,
  task_date date not null,
  assigned_to uuid references employees(id),
  status text not null default 'terjadwal' check (status in ('terjadwal','berjalan','selesai','terlewat')),
  started_at timestamptz,
  finished_at timestamptz,
  findings text,
  photo_urls jsonb,
  work_order_id uuid references work_orders(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_mainttask_company on maintenance_tasks(company_id);
create index idx_mainttask_plan on maintenance_tasks(plan_id);
create index idx_mainttask_wo on maintenance_tasks(work_order_id);
create trigger trg_mainttask_updated_at before update on maintenance_tasks
  for each row execute function set_updated_at();
