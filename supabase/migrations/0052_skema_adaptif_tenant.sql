-- =====================================================================
-- 0052_skema_adaptif_tenant.sql — konfigurasi per tenant TANPA mengubah core
--   * custom_field_defs  : definisi field tambahan per entitas inti
--   * kolom custom jsonb  : nilai field tambahan disimpan di entitas inti
--   * custom_tables / custom_records : tabel ringan buatan tenant
--   * tenant_status_labels : ganti label/warna status inti (& label jabatan)
--   * tenant_status_transitions : alur status yang diizinkan (opsional)
--   * tenant_sla_rules    : SLA tiket per severity/kategori
--   * tenant_approval_rules : jenjang persetujuan per nominal
--   * audit trail untuk SETIAP perubahan konfigurasi + data master utama
-- Prinsip: status inti (CHECK constraint) tidak diubah; tenant hanya memberi
-- label, menyembunyikan, dan membatasi transisi. Idempoten.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Definisi field kustom
-- ---------------------------------------------------------------------
create table if not exists public.custom_field_defs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  entity        text not null check (entity in ('work_orders','employees','customers','vendors','item_catalog',
                  'network_elements','projects','contracts','tickets','assets') or entity like 'ct:%'),
  field_key     text not null check (field_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label         text not null,
  data_type     text not null check (data_type in ('teks','teks_panjang','angka','tanggal','pilihan','ya_tidak')),
  options       text[] not null default '{}',
  required      boolean not null default false,
  show_in_table boolean not null default true,
  filterable    boolean not null default false,
  help_text     text,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) default auth.uid(),
  unique (company_id, entity, field_key)
);
create index if not exists idx_cfd_company_entity on public.custom_field_defs(company_id, entity);
alter table public.custom_field_defs enable row level security;
drop policy if exists cfd_read on public.custom_field_defs;
create policy cfd_read on public.custom_field_defs for select using (company_id = public.auth_company_id());
drop policy if exists cfd_write on public.custom_field_defs;
create policy cfd_write on public.custom_field_defs for all
  using (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis())
  with check (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis()
    and public.fn_fitur_aktif(case when entity like 'ct:%' then 'tabel_kustom' else 'custom_field' end));
grant select, insert, update, delete on public.custom_field_defs to authenticated;
drop trigger if exists trg_cfd_updated_at on public.custom_field_defs;
create trigger trg_cfd_updated_at before update on public.custom_field_defs for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. Tabel kustom ringan
-- ---------------------------------------------------------------------
create table if not exists public.custom_tables (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  code        text not null check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name        text not null,
  description text,
  module_code text not null default 'CORE' references public.modules(code),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) default auth.uid(),
  unique (company_id, code)
);
alter table public.custom_tables enable row level security;
drop policy if exists ct_read on public.custom_tables;
create policy ct_read on public.custom_tables for select using (company_id = public.auth_company_id() and public.can_read(module_code));
drop policy if exists ct_write on public.custom_tables;
create policy ct_write on public.custom_tables for all
  using (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis())
  with check (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis() and public.fn_fitur_aktif('tabel_kustom'));
grant select, insert, update, delete on public.custom_tables to authenticated;

create table if not exists public.custom_records (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  table_id    uuid not null references public.custom_tables(id) on delete cascade,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) default auth.uid()
);
create index if not exists idx_cr_table on public.custom_records(company_id, table_id);
alter table public.custom_records enable row level security;
drop policy if exists cr_read on public.custom_records;
create policy cr_read on public.custom_records for select using (company_id = public.auth_company_id()
  and exists (select 1 from public.custom_tables t where t.id = table_id and public.can_read(t.module_code)));
drop policy if exists cr_write on public.custom_records;
create policy cr_write on public.custom_records for all
  using (company_id = public.auth_company_id()
    and exists (select 1 from public.custom_tables t where t.id = table_id and public.can_write(t.module_code)))
  with check (company_id = public.auth_company_id()
    and exists (select 1 from public.custom_tables t where t.id = table_id and t.company_id = public.auth_company_id() and public.can_write(t.module_code)));
grant select, insert, update, delete on public.custom_records to authenticated;
drop trigger if exists trg_cr_updated_at on public.custom_records;
create trigger trg_cr_updated_at before update on public.custom_records for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Kolom custom pada entitas inti + validasi
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['work_orders','employees','customers','vendors','item_catalog','network_elements',
                           'projects','contracts','tickets','assets'] loop
    execute format('alter table public.%I add column if not exists custom jsonb not null default ''{}''', t);
  end loop;
end $$;

create or replace function public.fn_validasi_custom()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare d record; v jsonb; ent text := tg_table_name; val text;
begin
  if tg_table_name = 'custom_records' then
    select 'ct:' || code into ent from public.custom_tables where id = new.table_id;
    v := coalesce(new.data, '{}');
  else
    if tg_op = 'UPDATE' and new.custom is not distinct from old.custom then return new; end if;
    v := coalesce(new.custom, '{}');
  end if;
  for d in select * from public.custom_field_defs
           where company_id = new.company_id and entity = ent and is_active order by sort_order loop
    val := nullif(trim(v->>d.field_key), '');
    if val is null then
      if d.required then
        raise exception 'Kolom "%" wajib diisi.', d.label using errcode = '23502';
      end if;
      continue;
    end if;
    if d.data_type = 'angka' and val !~ '^-?[0-9]+(\.[0-9]+)?$' then
      raise exception 'Kolom "%" harus berupa angka (nilai: %).', d.label, val using errcode = '22P02';
    elsif d.data_type = 'tanggal' and val !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Kolom "%" harus tanggal YYYY-MM-DD (nilai: %).', d.label, val using errcode = '22007';
    elsif d.data_type = 'pilihan' and cardinality(d.options) > 0 and not (val = any (d.options)) then
      raise exception 'Nilai "%" tidak ada di pilihan kolom "%" (%).', val, d.label, array_to_string(d.options, ', ') using errcode = '23514';
    elsif d.data_type = 'ya_tidak' and lower(val) not in ('true','false','ya','tidak','1','0') then
      raise exception 'Kolom "%" hanya menerima ya/tidak (nilai: %).', d.label, val using errcode = '22P02';
    end if;
  end loop;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['work_orders','employees','customers','vendors','item_catalog','network_elements',
                           'projects','contracts','tickets','assets','custom_records'] loop
    execute format('drop trigger if exists trg_validasi_custom on public.%I', t);
    execute format('create trigger trg_validasi_custom before insert or update on public.%I for each row execute function public.fn_validasi_custom()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Label status, transisi, SLA, persetujuan
-- ---------------------------------------------------------------------
create table if not exists public.tenant_status_labels (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  entity      text not null check (entity in ('work_orders','tickets','projects','ar_invoices','contracts','_role')),
  status_code text not null,
  label       text not null,
  color       text check (color is null or color in ('slate','blue','teal','green','amber','orange','red','purple')),
  sort_order  int not null default 0,
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, entity, status_code)
);
alter table public.tenant_status_labels enable row level security;
drop policy if exists tsl_read on public.tenant_status_labels;
create policy tsl_read on public.tenant_status_labels for select using (company_id = public.auth_company_id());
drop policy if exists tsl_write on public.tenant_status_labels;
create policy tsl_write on public.tenant_status_labels for all
  using (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis())
  with check (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis() and public.fn_fitur_aktif('status_kustom'));
grant select, insert, update, delete on public.tenant_status_labels to authenticated;

create table if not exists public.tenant_status_transitions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  entity        text not null check (entity in ('work_orders','tickets')),
  from_status   text not null,
  to_status     text not null,
  allowed_roles text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, entity, from_status, to_status)
);
alter table public.tenant_status_transitions enable row level security;
drop policy if exists tst_read on public.tenant_status_transitions;
create policy tst_read on public.tenant_status_transitions for select using (company_id = public.auth_company_id());
drop policy if exists tst_write on public.tenant_status_transitions;
create policy tst_write on public.tenant_status_transitions for all
  using (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis())
  with check (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis() and public.fn_fitur_aktif('transisi_status'));
grant select, insert, update, delete on public.tenant_status_transitions to authenticated;

-- Bila tenant mendefinisikan transisi untuk sebuah entitas, hanya transisi itu yang sah.
create or replace function public.fn_jaga_transisi_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.tenant_status_transitions;
begin
  if new.status is not distinct from old.status then return new; end if;
  if auth.uid() is null or current_setting('nusakarya.sistem', true) = 'on' then return new; end if;
  if not exists (select 1 from public.tenant_status_transitions where company_id = new.company_id and entity = tg_table_name) then
    return new;
  end if;
  select * into r from public.tenant_status_transitions
   where company_id = new.company_id and entity = tg_table_name and from_status = old.status and to_status = new.status;
  if not found then
    raise exception 'Alur kerja perusahaan tidak mengizinkan perubahan status dari "%" ke "%".', old.status, new.status using errcode = '23514';
  end if;
  if cardinality(r.allowed_roles) > 0 and not public.is_super() and not (public.auth_role() = any (r.allowed_roles)) then
    raise exception 'Jabatan Anda tidak berwenang mengubah status dari "%" ke "%".', old.status, new.status using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_transisi_status on public.work_orders;
create trigger trg_transisi_status before update of status on public.work_orders for each row execute function public.fn_jaga_transisi_status();
drop trigger if exists trg_transisi_status on public.tickets;
create trigger trg_transisi_status before update of status on public.tickets for each row execute function public.fn_jaga_transisi_status();

create table if not exists public.tenant_sla_rules (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  entity           text not null default 'tickets' check (entity in ('tickets','work_orders')),
  match_field      text not null check (match_field in ('severity','category','ticket_type','wo_type')),
  match_value      text not null,
  response_minutes int,
  resolve_minutes  int not null check (resolve_minutes > 0),
  keterangan       text,
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, entity, match_field, match_value)
);
alter table public.tenant_sla_rules enable row level security;
drop policy if exists tsr_read on public.tenant_sla_rules;
create policy tsr_read on public.tenant_sla_rules for select using (company_id = public.auth_company_id());
drop policy if exists tsr_write on public.tenant_sla_rules;
create policy tsr_write on public.tenant_sla_rules for all
  using (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis())
  with check (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis() and public.fn_fitur_aktif('sla_kustom'));
grant select, insert, update, delete on public.tenant_sla_rules to authenticated;

create or replace function public.fn_terapkan_sla_tiket()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.tenant_sla_rules;
begin
  if new.sla_minutes is not null then return new; end if;
  select * into r from public.tenant_sla_rules s
   where s.company_id = new.company_id and s.entity = 'tickets' and s.is_active
     and ((s.match_field = 'severity' and s.match_value = new.severity)
       or (s.match_field = 'category' and s.match_value = new.category)
       or (s.match_field = 'ticket_type' and s.match_value = new.ticket_type))
   order by s.sort_order, case s.match_field when 'category' then 1 when 'ticket_type' then 2 else 3 end
   limit 1;
  if found then
    new.sla_minutes := r.resolve_minutes;
    new.sla_due_at := coalesce(new.sla_due_at, coalesce(new.reported_at, now()) + make_interval(mins => r.resolve_minutes));
  end if;
  return new;
end $$;
drop trigger if exists trg_sla_tiket on public.tickets;
create trigger trg_sla_tiket before insert on public.tickets for each row execute function public.fn_terapkan_sla_tiket();

create table if not exists public.tenant_approval_rules (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  entity_type   text not null,
  min_amount    numeric not null default 0,
  max_amount    numeric,
  step          int not null default 1 check (step between 1 and 5),
  approver_role text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.tenant_approval_rules enable row level security;
drop policy if exists tar_read on public.tenant_approval_rules;
create policy tar_read on public.tenant_approval_rules for select using (company_id = public.auth_company_id());
drop policy if exists tar_write on public.tenant_approval_rules;
create policy tar_write on public.tenant_approval_rules for all
  using (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis())
  with check (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis() and public.fn_fitur_aktif('aturan_persetujuan'));
grant select, insert, update, delete on public.tenant_approval_rules to authenticated;

-- Penyetuju yang berlaku untuk sebuah dokumen & nominal (dipakai alur persetujuan).
create or replace function public.fn_penyetuju(p_entity text, p_amount numeric)
returns table (step int, approver_role text)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.step, r.approver_role from public.tenant_approval_rules r
  where r.company_id = public.auth_company_id() and r.entity_type = p_entity and r.is_active
    and coalesce(p_amount, 0) >= r.min_amount and (r.max_amount is null or coalesce(p_amount, 0) < r.max_amount)
  order by r.step;
$$;
revoke execute on function public.fn_penyetuju(text, numeric) from anon;

-- ---------------------------------------------------------------------
-- 5. Audit trail: konfigurasi + data master & transaksi utama
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['custom_field_defs','custom_tables','custom_records','tenant_status_labels',
      'tenant_status_transitions','tenant_sla_rules','tenant_approval_rules','tenant_settings',
      'tenant_subscriptions','tenant_feature_overrides','tenant_invites','role_module_access','branches',
      'profiles','employees','customers','vendors','item_catalog','job_types','contract_price_list',
      'freelance_rate_cards','work_orders','tickets','stock_movements','stock_balances','ap_payments',
      'master_references','chart_of_accounts','salary_components'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_trigger where tgrelid = ('public.' || t)::regclass and tgfoid = 'public.fn_audit'::regproc) then
      execute format('create trigger trg_audit_%s after insert or update or delete on public.%I for each row execute function public.fn_audit()', t, t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Isi template "Mitra Fiber Optic Telkom Akses": field kustom, label status, SLA (ASUMSI)
-- ---------------------------------------------------------------------
update public.business_templates set config = config || jsonb_build_object(
  'custom_field_defs', jsonb_build_array(
    jsonb_build_object('entity','work_orders','field_key','sc_order_id','label','No. SC / Order ID','data_type','teks','options','{}'::text[],'required',false,'show_in_table',true,'filterable',true,'help_text','Nomor order dari sistem principal (mis. SC ID).','sort_order',1,'is_active',true),
    jsonb_build_object('entity','work_orders','field_key','nama_odp','label','Nama ODP','data_type','teks','options','{}'::text[],'required',false,'show_in_table',true,'filterable',true,'help_text','ODP tempat pelanggan disambungkan.','sort_order',2,'is_active',true),
    jsonb_build_object('entity','work_orders','field_key','sn_ont','label','SN ONT','data_type','teks','options','{}'::text[],'required',false,'show_in_table',false,'filterable',false,'help_text','Nomor seri perangkat yang dipasang.','sort_order',3,'is_active',true),
    jsonb_build_object('entity','work_orders','field_key','jenis_order','label','Jenis Order','data_type','pilihan','options',array['Pasang Baru','Migrasi','Add-on','Cabut'],'required',false,'show_in_table',true,'filterable',true,'help_text',null,'sort_order',4,'is_active',true),
    jsonb_build_object('entity','employees','field_key','laborcode','label','Laborcode Teknisi','data_type','teks','options','{}'::text[],'required',false,'show_in_table',true,'filterable',true,'help_text','Kode teknisi di sistem principal.','sort_order',1,'is_active',true),
    jsonb_build_object('entity','employees','field_key','crew','label','Crew / Tim','data_type','teks','options','{}'::text[],'required',false,'show_in_table',true,'filterable',true,'help_text',null,'sort_order',2,'is_active',true),
    jsonb_build_object('entity','customers','field_key','regional_principal','label','Regional Principal','data_type','teks','options','{}'::text[],'required',false,'show_in_table',true,'filterable',true,'help_text','Wilayah/regional pemberi kerja.','sort_order',1,'is_active',true)),
  'tenant_status_labels', jsonb_build_array(
    jsonb_build_object('entity','work_orders','status_code','draft','label','Draft','color','slate','sort_order',1,'is_hidden',false),
    jsonb_build_object('entity','work_orders','status_code','dispatched','label','Diteruskan ke Teknisi','color','blue','sort_order',2,'is_hidden',false),
    jsonb_build_object('entity','work_orders','status_code','accepted','label','Diterima Teknisi','color','blue','sort_order',3,'is_hidden',false),
    jsonb_build_object('entity','work_orders','status_code','on_progress','label','Dikerjakan','color','amber','sort_order',4,'is_hidden',false),
    jsonb_build_object('entity','work_orders','status_code','pending_material','label','Kendala Material','color','orange','sort_order',5,'is_hidden',false),
    jsonb_build_object('entity','work_orders','status_code','done','label','Selesai','color','green','sort_order',6,'is_hidden',false),
    jsonb_build_object('entity','work_orders','status_code','failed','label','Gagal / Kendala','color','red','sort_order',7,'is_hidden',false),
    jsonb_build_object('entity','work_orders','status_code','cancelled','label','Batal','color','slate','sort_order',8,'is_hidden',false)),
  'tenant_sla_rules', jsonb_build_array(
    jsonb_build_object('entity','tickets','match_field','severity','match_value','kritis','response_minutes',30,'resolve_minutes',180,'keterangan','ASUMSI — ganti sesuai SLA kontrak','sort_order',1,'is_active',true),
    jsonb_build_object('entity','tickets','match_field','severity','match_value','tinggi','response_minutes',60,'resolve_minutes',360,'keterangan','ASUMSI — ganti sesuai SLA kontrak','sort_order',2,'is_active',true),
    jsonb_build_object('entity','tickets','match_field','severity','match_value','sedang','response_minutes',120,'resolve_minutes',720,'keterangan','ASUMSI — ganti sesuai SLA kontrak','sort_order',3,'is_active',true),
    jsonb_build_object('entity','tickets','match_field','severity','match_value','rendah','response_minutes',240,'resolve_minutes',1440,'keterangan','ASUMSI — ganti sesuai SLA kontrak','sort_order',4,'is_active',true)))
where code = 'fo_telkom_akses';

-- Tenant peragaan ikut mendapat konfigurasi bawaan template (tanpa menimpa yang sudah ada).
do $$
declare c record; cfg jsonb;
begin
  select config into cfg from public.business_templates where code = 'fo_telkom_akses';
  for c in select id from public.companies loop
    perform public.fn__sisip_json(c.id, 'custom_field_defs', cfg->'custom_field_defs');
    perform public.fn__sisip_json(c.id, 'tenant_status_labels', cfg->'tenant_status_labels');
    perform public.fn__sisip_json(c.id, 'tenant_sla_rules', cfg->'tenant_sla_rules');
  end loop;
end $$;
