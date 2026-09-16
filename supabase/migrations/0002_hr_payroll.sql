-- =====================================================================
-- 0002_hr_payroll.sql — HR, Attendance, Payroll, Productivity
-- =====================================================================

-- ---------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------
create table employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  nip text not null,
  full_name text not null,
  gender text check (gender in ('L','P')),
  birth_date date,
  phone text,
  email text,
  address text,
  branch_id uuid references branches(id),
  position text,
  unit text check (unit in ('EXECUTIVE','HR','COMMERCE','PROCUREMENT','FINANCE','INVENTORY','OPERATIONS','DEPLOYMENT')),
  employment_type text check (employment_type in ('PKWT','PKWTT','MITRA','OUTSOURCE','MAGANG')),
  join_date date,
  contract_start date,
  contract_end date,
  status text not null default 'aktif' check (status in ('aktif','cuti','nonaktif','resign')),
  ptkp_status text check (ptkp_status in ('TK/0','TK/1','TK/2','TK/3','K/0','K/1','K/2','K/3')),
  ter_category text check (ter_category in ('A','B','C')),
  npwp text,
  nik_ktp text,
  bank_name text,
  bank_account text,
  bank_holder text,
  bpjs_tk_no text,
  bpjs_kes_no text,
  photo_url text,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, nip)
);
create index idx_employees_company on employees(company_id);
create index idx_employees_branch on employees(branch_id);
create index idx_employees_user on employees(user_id);
create trigger trg_employees_updated_at before update on employees
  for each row execute function set_updated_at();

-- backfill FK from profiles.employee_id -> employees.id (deferred from 0001)
alter table profiles
  add constraint fk_profiles_employee foreign key (employee_id) references employees(id);

-- derive ter_category from ptkp_status: TK/0,TK/1,TK/2,K/0 -> A ; TK/3,K/1,K/2 -> B ; K/3 -> C
create or replace function fn_derive_ter_category()
returns trigger
language plpgsql
as $$
begin
  new.ter_category := case
    when new.ptkp_status in ('TK/0','TK/1','TK/2','K/0') then 'A'
    when new.ptkp_status in ('TK/3','K/1','K/2') then 'B'
    when new.ptkp_status in ('K/3') then 'C'
    else new.ter_category
  end;
  return new;
end;
$$;
create trigger trg_employees_ter_category before insert or update of ptkp_status on employees
  for each row execute function fn_derive_ter_category();

-- ---------------------------------------------------------------------
-- employee_certifications
-- ---------------------------------------------------------------------
create table employee_certifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  cert_type text,
  cert_name text not null,
  cert_no text,
  issuer text,
  issued_date date,
  expiry_date date,
  file_url text,
  status text default 'aktif' check (status in ('aktif','expired','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_empcert_company on employee_certifications(company_id);
create index idx_empcert_employee on employee_certifications(employee_id);
create trigger trg_empcert_updated_at before update on employee_certifications
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------
create table shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_shifts_company on shifts(company_id);
create trigger trg_shifts_updated_at before update on shifts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- rosters
-- ---------------------------------------------------------------------
create table rosters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  shift_id uuid references shifts(id),
  branch_id uuid references branches(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_rosters_company on rosters(company_id);
create index idx_rosters_employee on rosters(employee_id);
create trigger trg_rosters_updated_at before update on rosters
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- attendances
-- ---------------------------------------------------------------------
create table attendances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  check_in_at timestamptz,
  check_in_lat numeric,
  check_in_lng numeric,
  check_in_photo_url text,
  check_out_at timestamptz,
  check_out_lat numeric,
  check_out_lng numeric,
  check_out_photo_url text,
  shift_id uuid references shifts(id),
  status text check (status in ('hadir','terlambat','izin','sakit','cuti','alpa','libur')),
  late_minutes int default 0,
  work_minutes int default 0,
  overtime_minutes int default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, employee_id, work_date)
);
create index idx_attendances_company on attendances(company_id);
create index idx_attendances_employee on attendances(employee_id);
create trigger trg_attendances_updated_at before update on attendances
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- leave_requests
-- ---------------------------------------------------------------------
create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type text not null check (leave_type in ('cuti_tahunan','sakit','izin','melahirkan','tanpa_keterangan')),
  start_date date not null,
  end_date date not null,
  days numeric,
  reason text,
  attachment_url text,
  status text not null default 'draft' check (status in ('draft','diajukan','disetujui','ditolak')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_leave_company on leave_requests(company_id);
create index idx_leave_employee on leave_requests(employee_id);
create trigger trg_leave_updated_at before update on leave_requests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- salary_components
-- ---------------------------------------------------------------------
create table salary_components (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  component_type text not null check (component_type in ('earning','deduction')),
  calc_type text not null check (calc_type in ('fixed','formula','percentage','manual')),
  taxable boolean not null default false,
  is_bpjs_base boolean not null default false,
  default_amount numeric default 0,
  formula text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_salcomp_company on salary_components(company_id);
create trigger trg_salcomp_updated_at before update on salary_components
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- employee_salaries
-- ---------------------------------------------------------------------
create table employee_salaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  component_id uuid not null references salary_components(id) on delete cascade,
  amount numeric not null default 0,
  effective_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_empsal_company on employee_salaries(company_id);
create index idx_empsal_employee on employee_salaries(employee_id);
create index idx_empsal_component on employee_salaries(component_id);
create trigger trg_empsal_updated_at before update on employee_salaries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- payroll_periods
-- ---------------------------------------------------------------------
create table payroll_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period_code text not null,
  start_date date not null,
  end_date date not null,
  pay_date date,
  status text not null default 'draft' check (status in ('draft','dihitung','diverifikasi','disetujui','dibayar','closed')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, period_code)
);
create index idx_payperiod_company on payroll_periods(company_id);
create trigger trg_payperiod_updated_at before update on payroll_periods
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- payroll_runs
-- ---------------------------------------------------------------------
create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period_id uuid not null references payroll_periods(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  gross numeric default 0,
  taxable_gross numeric default 0,
  bpjs_jht_company numeric default 0,
  bpjs_jht_employee numeric default 0,
  bpjs_jkk numeric default 0,
  bpjs_jkm numeric default 0,
  bpjs_jp_company numeric default 0,
  bpjs_jp_employee numeric default 0,
  bpjs_kes_company numeric default 0,
  bpjs_kes_employee numeric default 0,
  overtime_amount numeric default 0,
  productivity_amount numeric default 0,
  thr_amount numeric default 0,
  pph21_amount numeric default 0,
  other_deduction numeric default 0,
  net_pay numeric default 0,
  status text not null default 'draft' check (status in ('draft','dihitung','diverifikasi','disetujui','dibayar','closed')),
  paid_at timestamptz,
  slip_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_payrun_company on payroll_runs(company_id);
create index idx_payrun_period on payroll_runs(period_id);
create index idx_payrun_employee on payroll_runs(employee_id);
create trigger trg_payrun_updated_at before update on payroll_runs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- payroll_run_lines
-- ---------------------------------------------------------------------
create table payroll_run_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  run_id uuid not null references payroll_runs(id) on delete cascade,
  component_id uuid references salary_components(id),
  component_name text not null,
  component_type text not null check (component_type in ('earning','deduction')),
  amount numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_payrunline_company on payroll_run_lines(company_id);
create index idx_payrunline_run on payroll_run_lines(run_id);
create trigger trg_payrunline_updated_at before update on payroll_run_lines
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- ter_rates (company_id nullable => global default rates)
-- ---------------------------------------------------------------------
create table ter_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  category text not null check (category in ('A','B','C')),
  min_income numeric not null,
  max_income numeric,
  rate numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_terrates_company on ter_rates(company_id);
create index idx_terrates_category on ter_rates(category);
create trigger trg_terrates_updated_at before update on ter_rates
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- bpjs_config
-- ---------------------------------------------------------------------
create table bpjs_config (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  jht_company numeric not null default 0.037,
  jht_employee numeric not null default 0.02,
  jkk numeric not null default 0.0054,
  jkm numeric not null default 0.003,
  jp_company numeric not null default 0.02,
  jp_employee numeric not null default 0.01,
  jp_cap numeric not null default 11086300,
  kes_company numeric not null default 0.04,
  kes_employee numeric not null default 0.01,
  kes_cap numeric not null default 12000000,
  effective_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_bpjscfg_company on bpjs_config(company_id);
create trigger trg_bpjscfg_updated_at before update on bpjs_config
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- job_types
-- ---------------------------------------------------------------------
create table job_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check (category in ('PROVISIONING','ASSURANCE','MAINTENANCE','DEPLOYMENT')),
  point_weight numeric not null default 0,
  standard_minutes int,
  tariff_amount numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_jobtypes_company on job_types(company_id);
create trigger trg_jobtypes_updated_at before update on job_types
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- productivity_entries
-- ---------------------------------------------------------------------
create table productivity_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  job_type_id uuid not null references job_types(id),
  work_order_id uuid,
  qty int not null default 1,
  points numeric not null default 0,
  amount numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','diverifikasi','dibayar')),
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_prodentries_company on productivity_entries(company_id);
create index idx_prodentries_employee on productivity_entries(employee_id);
create index idx_prodentries_jobtype on productivity_entries(job_type_id);
create index idx_prodentries_wo on productivity_entries(work_order_id);
create trigger trg_prodentries_updated_at before update on productivity_entries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- productivity_targets
-- ---------------------------------------------------------------------
create table productivity_targets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  position text,
  period_code text not null,
  target_points numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_prodtargets_company on productivity_targets(company_id);
create index idx_prodtargets_employee on productivity_targets(employee_id);
create trigger trg_prodtargets_updated_at before update on productivity_targets
  for each row execute function set_updated_at();
