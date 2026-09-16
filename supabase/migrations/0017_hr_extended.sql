-- =====================================================================
-- 0017_hr_extended.sql — HR tahap 2: Rekrutmen, Kompetensi & Pelatihan,
-- Lembur, Perjalanan Dinas, Disiplin, Kinerja, K3/HSE
-- =====================================================================

-- ---------------------------------------------------------------------
-- job_vacancies
-- ---------------------------------------------------------------------
create table job_vacancies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  vacancy_no text not null,
  title text not null,
  unit text check (unit in ('EXECUTIVE','HR','COMMERCE','PROCUREMENT','FINANCE','INVENTORY','OPERATIONS','DEPLOYMENT')),
  branch_id uuid references branches(id),
  position text,
  employment_type text check (employment_type in ('PKWT','PKWTT','MITRA','OUTSOURCE','MAGANG')),
  qty integer not null default 1,
  requirements text,
  salary_range_min numeric,
  salary_range_max numeric,
  open_date date,
  close_date date,
  status text not null default 'draft' check (status in ('draft','dibuka','ditutup','batal')),
  pic_id uuid references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, vacancy_no)
);
create index idx_job_vacancies_company on job_vacancies(company_id);
create index idx_job_vacancies_branch on job_vacancies(branch_id);
create index idx_job_vacancies_pic on job_vacancies(pic_id);
create trigger trg_job_vacancies_updated_at before update on job_vacancies
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- job_applicants
-- ---------------------------------------------------------------------
create table job_applicants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  vacancy_id uuid not null references job_vacancies(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  education text,
  experience_years numeric,
  cv_url text,
  source text,
  stage text not null default 'baru' check (stage in ('baru','seleksi_berkas','tes','wawancara','tawaran','diterima','ditolak')),
  score numeric,
  note text,
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_job_applicants_company on job_applicants(company_id);
create index idx_job_applicants_vacancy on job_applicants(vacancy_id);
create trigger trg_job_applicants_updated_at before update on job_applicants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- competencies
-- ---------------------------------------------------------------------
create table competencies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check (category in ('teknis','K3','manajerial','sertifikasi')),
  description text,
  required_for_positions text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_competencies_company on competencies(company_id);
create trigger trg_competencies_updated_at before update on competencies
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- employee_competencies
-- ---------------------------------------------------------------------
create table employee_competencies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  competency_id uuid not null references competencies(id) on delete cascade,
  level text not null check (level in ('dasar','madya','utama')),
  assessed_at date,
  assessed_by uuid references auth.users(id),
  expiry_date date,
  evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_employee_competencies_company on employee_competencies(company_id);
create index idx_employee_competencies_employee on employee_competencies(employee_id);
create index idx_employee_competencies_competency on employee_competencies(competency_id);
create trigger trg_employee_competencies_updated_at before update on employee_competencies
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- trainings
-- ---------------------------------------------------------------------
create table trainings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  training_no text not null,
  title text not null,
  training_type text not null check (training_type in ('internal','eksternal','sertifikasi','induksi_K3')),
  competency_id uuid references competencies(id),
  provider text,
  start_date date,
  end_date date,
  location text,
  cost numeric default 0,
  quota integer,
  status text not null default 'rencana' check (status in ('rencana','berjalan','selesai','batal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, training_no)
);
create index idx_trainings_company on trainings(company_id);
create index idx_trainings_competency on trainings(competency_id);
create trigger trg_trainings_updated_at before update on trainings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- training_participants
-- ---------------------------------------------------------------------
create table training_participants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  training_id uuid not null references trainings(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  attendance text not null default 'terdaftar' check (attendance in ('terdaftar','hadir','tidak_hadir','lulus','tidak_lulus')),
  score numeric,
  certificate_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(training_id, employee_id)
);
create index idx_training_participants_company on training_participants(company_id);
create index idx_training_participants_training on training_participants(training_id);
create index idx_training_participants_employee on training_participants(employee_id);
create trigger trg_training_participants_updated_at before update on training_participants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- overtime_requests (SPL) — sumber resmi lembur untuk payroll
-- ---------------------------------------------------------------------
create table overtime_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  spl_no text not null,
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  start_at timestamptz,
  end_at timestamptz,
  hours numeric,
  reason text,
  work_order_id uuid references work_orders(id),
  status text not null default 'diajukan' check (status in ('diajukan','disetujui','ditolak','dibayar')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  calculated_amount numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, spl_no)
);
create index idx_overtime_requests_company on overtime_requests(company_id);
create index idx_overtime_requests_employee on overtime_requests(employee_id);
create index idx_overtime_requests_work_order on overtime_requests(work_order_id);
create trigger trg_overtime_requests_updated_at before update on overtime_requests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- business_trips (SPPD)
-- ---------------------------------------------------------------------
create table business_trips (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  sppd_no text not null,
  employee_id uuid not null references employees(id) on delete cascade,
  destination text,
  purpose text,
  start_date date,
  end_date date,
  transport_type text,
  daily_allowance numeric default 0,
  total_advance numeric default 0,
  status text not null default 'diajukan' check (status in ('diajukan','disetujui','berjalan','selesai','ditolak')),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, sppd_no)
);
create index idx_business_trips_company on business_trips(company_id);
create index idx_business_trips_employee on business_trips(employee_id);
create trigger trg_business_trips_updated_at before update on business_trips
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- trip_expenses
-- ---------------------------------------------------------------------
create table trip_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  trip_id uuid not null references business_trips(id) on delete cascade,
  expense_date date,
  category text check (category in ('transport','penginapan','makan','bbm','tol','lain')),
  description text,
  amount numeric not null default 0,
  receipt_url text,
  status text not null default 'diajukan' check (status in ('diajukan','diverifikasi','disetujui','ditolak','dibayar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_trip_expenses_company on trip_expenses(company_id);
create index idx_trip_expenses_trip on trip_expenses(trip_id);
create trigger trg_trip_expenses_updated_at before update on trip_expenses
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- disciplinary_actions
-- ---------------------------------------------------------------------
create table disciplinary_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  action_no text not null,
  action_type text check (action_type in ('teguran_lisan','teguran_tertulis','SP1','SP2','SP3','PHK')),
  violation_date date,
  violation_category text,
  description text,
  issued_date date,
  valid_until date,
  issued_by uuid references auth.users(id),
  document_url text,
  status text not null default 'aktif' check (status in ('aktif','berakhir','dicabut')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, action_no)
);
create index idx_disciplinary_actions_company on disciplinary_actions(company_id);
create index idx_disciplinary_actions_employee on disciplinary_actions(employee_id);
create trigger trg_disciplinary_actions_updated_at before update on disciplinary_actions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- performance_reviews
-- ---------------------------------------------------------------------
create table performance_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  period_code text not null,
  review_type text check (review_type in ('bulanan','triwulan','semester','tahunan')),
  total_score numeric,
  grade text check (grade in ('A','B','C','D','E')),
  strengths text,
  improvements text,
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  status text not null default 'draft' check (status in ('draft','diajukan','disetujui','disanggah')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, employee_id, period_code, review_type)
);
create index idx_performance_reviews_company on performance_reviews(company_id);
create index idx_performance_reviews_employee on performance_reviews(employee_id);
create trigger trg_performance_reviews_updated_at before update on performance_reviews
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- performance_review_items
-- ---------------------------------------------------------------------
create table performance_review_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  review_id uuid not null references performance_reviews(id) on delete cascade,
  aspect text not null,
  weight_percent numeric,
  target_value numeric,
  actual_value numeric,
  score numeric,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_performance_review_items_company on performance_review_items(company_id);
create index idx_performance_review_items_review on performance_review_items(review_id);
create trigger trg_performance_review_items_updated_at before update on performance_review_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- hse_incidents
-- ---------------------------------------------------------------------
create table hse_incidents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  incident_no text not null,
  incident_date date not null default current_date,
  incident_type text check (incident_type in ('nearmiss','ringan','sedang','berat','fatal','kerusakan_aset')),
  location text,
  lat numeric,
  lng numeric,
  branch_id uuid references branches(id),
  employee_id uuid references employees(id),
  work_order_id uuid references work_orders(id),
  description text,
  immediate_action text,
  root_cause_id uuid references root_causes(id),
  corrective_action text,
  lost_days integer default 0,
  cost_estimate numeric default 0,
  photo_urls jsonb default '[]'::jsonb,
  status text not null default 'dilaporkan' check (status in ('dilaporkan','investigasi','selesai')),
  reported_by uuid references auth.users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, incident_no)
);
create index idx_hse_incidents_company on hse_incidents(company_id);
create index idx_hse_incidents_branch on hse_incidents(branch_id);
create index idx_hse_incidents_employee on hse_incidents(employee_id);
create index idx_hse_incidents_work_order on hse_incidents(work_order_id);
create trigger trg_hse_incidents_updated_at before update on hse_incidents
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- hse_inspections
-- ---------------------------------------------------------------------
create table hse_inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  inspection_no text not null,
  inspection_date date not null default current_date,
  inspection_type text check (inspection_type in ('APD','kendaraan','alat','lokasi_kerja','ketinggian')),
  branch_id uuid references branches(id),
  inspector_id uuid references employees(id),
  target_ref text,
  findings jsonb default '[]'::jsonb,
  score numeric,
  result text check (result in ('aman','perlu_perbaikan','tidak_aman')),
  photo_urls jsonb default '[]'::jsonb,
  follow_up text,
  due_date date,
  status text not null default 'draft' check (status in ('draft','selesai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, inspection_no)
);
create index idx_hse_inspections_company on hse_inspections(company_id);
create index idx_hse_inspections_branch on hse_inspections(branch_id);
create index idx_hse_inspections_inspector on hse_inspections(inspector_id);
create trigger trg_hse_inspections_updated_at before update on hse_inspections
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- work_permits (SIKA)
-- ---------------------------------------------------------------------
create table work_permits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  permit_no text not null,
  permit_type text check (permit_type in ('kerja_ketinggian','galian','listrik','ruang_terbatas','panas')),
  work_order_id uuid references work_orders(id),
  project_id uuid references projects(id),
  location text,
  lat numeric,
  lng numeric,
  valid_from timestamptz,
  valid_to timestamptz,
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  safety_checklist jsonb default '[]'::jsonb,
  status text not null default 'diajukan' check (status in ('diajukan','disetujui','aktif','ditutup','ditolak')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, permit_no)
);
create index idx_work_permits_company on work_permits(company_id);
create index idx_work_permits_work_order on work_permits(work_order_id);
create index idx_work_permits_project on work_permits(project_id);
create trigger trg_work_permits_updated_at before update on work_permits
  for each row execute function set_updated_at();
