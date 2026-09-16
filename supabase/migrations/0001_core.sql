-- =====================================================================
-- 0001_core.sql — NUSAKARYA ERP: Core / Multi-tenant foundation
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- generic updated_at trigger function
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  npwp text,
  address text,
  phone text,
  email text,
  logo_url text,
  is_active boolean not null default true,
  plan text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create trigger trg_companies_updated_at before update on companies
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- branches
-- ---------------------------------------------------------------------
create table branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  city text,
  province text,
  lat numeric,
  lng numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_branches_company on branches(company_id);
create trigger trg_branches_updated_at before update on branches
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid,
  full_name text not null,
  email text,
  phone text,
  avatar_url text,
  role text not null check (role in (
    'super_admin','direktur','komisaris','manager_hr','manager_commerce',
    'manager_procurement','manager_finance','manager_inventory','manager_operations',
    'manager_deployment','staff_hr','staff_commerce','staff_procurement','staff_finance',
    'staff_inventory','spv_operations','dispatcher','teknisi','design_engineer',
    'project_manager','qc','mitra','viewer'
  )),
  unit text check (unit in (
    'EXECUTIVE','HR','COMMERCE','PROCUREMENT','FINANCE','INVENTORY','OPERATIONS','DEPLOYMENT'
  )),
  branch_id uuid references branches(id),
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_profiles_company on profiles(company_id);
create index idx_profiles_branch on profiles(branch_id);
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- modules
-- ---------------------------------------------------------------------
create table modules (
  code text primary key,
  name text not null,
  unit text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_modules_updated_at before update on modules
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- role_module_access
-- ---------------------------------------------------------------------
create table role_module_access (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  role text not null,
  module_code text not null references modules(code) on delete cascade,
  can_read boolean not null default false,
  can_write boolean not null default false,
  can_approve boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, role, module_code)
);
create index idx_rma_company on role_module_access(company_id);
create index idx_rma_module on role_module_access(module_code);
create trigger trg_rma_updated_at before update on role_module_access
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- approvals
-- ---------------------------------------------------------------------
create table approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  step int not null default 1,
  approver_role text,
  approver_id uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','skipped')),
  note text,
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_approvals_company on approvals(company_id);
create index idx_approvals_entity on approvals(entity_type, entity_id);
create trigger trg_approvals_updated_at before update on approvals
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------
create table attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  file_name text not null,
  file_url text not null,
  mime_type text,
  size_bytes bigint,
  lat numeric,
  lng numeric,
  taken_at timestamptz,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_attachments_company on attachments(company_id);
create index idx_attachments_entity on attachments(entity_type, entity_id);
create trigger trg_attachments_updated_at before update on attachments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid references auth.users(id),
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_notifications_company on notifications(company_id);
create index idx_notifications_user on notifications(user_id);
create trigger trg_notifications_updated_at before update on notifications
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- audit_logs (append only)
-- ---------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_company on audit_logs(company_id);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);

-- ---------------------------------------------------------------------
-- doc_sequences + next_doc_no()
-- ---------------------------------------------------------------------
create table doc_sequences (
  company_id uuid not null references companies(id) on delete cascade,
  prefix text not null,
  year int not null,
  last_no int not null default 0,
  primary key (company_id, prefix, year)
);

create or replace function next_doc_no(p_company uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year int := extract(year from now())::int;
  v_last int;
  v_no text;
begin
  insert into doc_sequences (company_id, prefix, year, last_no)
  values (p_company, p_prefix, v_year, 1)
  on conflict (company_id, prefix, year)
  do update set last_no = doc_sequences.last_no + 1
  returning last_no into v_last;

  v_no := p_prefix || '/' || v_year::text || '/' || lpad(v_last::text, 5, '0');
  return v_no;
end;
$$;

-- ---------------------------------------------------------------------
-- helper functions (SECURITY DEFINER)
-- ---------------------------------------------------------------------
create or replace function auth_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select company_id from profiles where id = auth.uid();
$$;

create or replace function auth_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_super()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth_role() = 'super_admin', false);
$$;

create or replace function can_read(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select is_super() or coalesce((
    select rma.can_read
    from role_module_access rma
    where rma.company_id = auth_company_id()
      and rma.role = auth_role()
      and rma.module_code = p_module
  ), false);
$$;

create or replace function can_write(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select is_super() or coalesce((
    select rma.can_write
    from role_module_access rma
    where rma.company_id = auth_company_id()
      and rma.role = auth_role()
      and rma.module_code = p_module
  ), false);
$$;

create or replace function can_approve(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select is_super() or coalesce((
    select rma.can_approve
    from role_module_access rma
    where rma.company_id = auth_company_id()
      and rma.role = auth_role()
      and rma.module_code = p_module
  ), false);
$$;
