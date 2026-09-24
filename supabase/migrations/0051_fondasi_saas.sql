-- =====================================================================
-- 0051_fondasi_saas.sql — lapisan SaaS NUSAKARYA
--   * Paket langganan (saas_plans) + langganan per tenant + override fitur
--   * Feature flag per paket DITEGAKKAN di basis data lewat can_read/can_write
--   * Batas pemakaian (pengguna keras; teknisi & WO lunak -> dihitung overage)
--   * Kesiapan penagihan: draft tagihan per periode (tanpa payment gateway)
--   * Template bisnis, pembuatan workspace mandiri, undangan tim, data contoh
--   * Pengaturan perusahaan, onboarding, kesehatan tenant untuk platform admin
-- Semua harga = ASUMSI 24 Sep 2026 (lihat dokumen skema bisnis). Idempoten.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Katalog paket
-- ---------------------------------------------------------------------
create table if not exists public.saas_plans (
  code            text primary key,
  name            text not null,
  tagline         text,
  price_monthly   numeric not null default 0,
  price_setup     numeric not null default 0,
  max_users       int,      -- null = tanpa batas (sesuai kontrak)
  max_technicians int,
  max_wo_month    int,
  max_storage_gb  int,
  overage_technician numeric not null default 15000,
  overage_wo      numeric not null default 500,
  modules         text[] not null,
  features        text[] not null default '{}',
  support_level   text,
  onboarding      text,
  sort_order      int not null default 0,
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.saas_plans enable row level security;
drop policy if exists saas_plans_read on public.saas_plans;
create policy saas_plans_read on public.saas_plans for select using (true);
drop policy if exists saas_plans_write on public.saas_plans;
create policy saas_plans_write on public.saas_plans for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke all on public.saas_plans from anon;
grant select on public.saas_plans to anon, authenticated;
grant insert, update, delete on public.saas_plans to authenticated;

insert into public.saas_plans (code, name, tagline, price_monthly, price_setup, max_users, max_technicians,
  max_wo_month, max_storage_gb, modules, features, support_level, onboarding, sort_order) values
('starter', 'Starter', 'Rapikan WO, evidence, absensi & material tim lapangan',
  2500000, 5000000, 10, 30, 1000, 20,
  array['CORE','DASHBOARD','HR','OPERATIONS','INVENTORY','PRODUCTIVITY'],
  array['impor_data','ekspor_data','audit_trail','data_contoh','custom_field'],
  'Email/tiket jam kerja, respons 1 hari kerja', 'Mandiri + 1 sesi online 2 jam', 1),
('professional', 'Professional', 'WO sampai uang masuk: BAST, invoice, AP/AR, payroll',
  7500000, 15000000, 30, 150, 5000, 100,
  array['CORE','DASHBOARD','HR','OPERATIONS','INVENTORY','PRODUCTIVITY','PAYROLL','COMMERCE','PROCUREMENT','FINANCE','ASSET','DEPLOYMENT','EXECUTIVE'],
  array['impor_data','ekspor_data','audit_trail','data_contoh','custom_field','status_kustom','sla_kustom','aturan_persetujuan'],
  'WhatsApp jam kerja, respons 4 jam', '3 sesi + migrasi Excel dibantu', 2),
('enterprise', 'Enterprise', 'Multi-cabang besar, workflow & tabel kustom, integrasi',
  20000000, 40000000, 100, 500, 20000, 500,
  array['CORE','DASHBOARD','HR','OPERATIONS','INVENTORY','PRODUCTIVITY','PAYROLL','COMMERCE','PROCUREMENT','FINANCE','ASSET','DEPLOYMENT','EXECUTIVE'],
  array['impor_data','ekspor_data','audit_trail','data_contoh','custom_field','status_kustom','sla_kustom','aturan_persetujuan','tabel_kustom','transisi_status','api_integrasi','sso','multi_entitas'],
  'Prioritas; P1 7x24', 'Proyek onboarding + CSM dedicated', 3),
('managed', 'Managed Service', 'Tim NUSAKARYA ikut menjalankan admin data & rekonsiliasi',
  35000000, 40000000, null, null, null, 1000,
  array['CORE','DASHBOARD','HR','OPERATIONS','INVENTORY','PRODUCTIVITY','PAYROLL','COMMERCE','PROCUREMENT','FINANCE','ASSET','DEPLOYMENT','EXECUTIVE'],
  array['impor_data','ekspor_data','audit_trail','data_contoh','custom_field','status_kustom','sla_kustom','aturan_persetujuan','tabel_kustom','transisi_status','api_integrasi','sso','multi_entitas','white_glove'],
  'Tim dedicated + laporan bulanan', 'White glove, kontrak min. 12 bulan', 4)
on conflict (code) do update set
  name = excluded.name, tagline = excluded.tagline, price_monthly = excluded.price_monthly,
  price_setup = excluded.price_setup, max_users = excluded.max_users, max_technicians = excluded.max_technicians,
  max_wo_month = excluded.max_wo_month, max_storage_gb = excluded.max_storage_gb, modules = excluded.modules,
  features = excluded.features, support_level = excluded.support_level, onboarding = excluded.onboarding,
  sort_order = excluded.sort_order, updated_at = now();

-- ---------------------------------------------------------------------
-- 2. Langganan & override per tenant
-- ---------------------------------------------------------------------
create table if not exists public.tenant_subscriptions (
  id              uuid not null default gen_random_uuid() unique,
  company_id      uuid primary key references public.companies(id) on delete cascade,
  plan_code       text not null references public.saas_plans(code),
  status          text not null default 'trial'
                  check (status in ('trial','active','past_due','suspended','cancelled')),
  trial_ends_at   timestamptz,
  period_start    date not null default current_date,
  period_end      date,
  billing_cycle   text not null default 'bulanan' check (billing_cycle in ('bulanan','tahunan')),
  price_override  numeric,
  catatan         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id)
);
alter table public.tenant_subscriptions enable row level security;
drop policy if exists tsub_read on public.tenant_subscriptions;
create policy tsub_read on public.tenant_subscriptions for select
  using (company_id = public.auth_company_id() or public.is_platform_admin());
drop policy if exists tsub_write on public.tenant_subscriptions;
create policy tsub_write on public.tenant_subscriptions for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select, insert, update, delete on public.tenant_subscriptions to authenticated;

create table if not exists public.tenant_feature_overrides (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  feature_code text not null,      -- 'fitur:<kode>' atau 'modul:<KODE_MODUL>'
  enabled      boolean not null,
  catatan      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, feature_code)
);
alter table public.tenant_feature_overrides enable row level security;
drop policy if exists tfo_read on public.tenant_feature_overrides;
create policy tfo_read on public.tenant_feature_overrides for select
  using (company_id = public.auth_company_id() or public.is_platform_admin());
drop policy if exists tfo_write on public.tenant_feature_overrides;
create policy tfo_write on public.tenant_feature_overrides for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select, insert, update, delete on public.tenant_feature_overrides to authenticated;

-- Tenant yang sudah ada (peragaan) -> Enterprise aktif, supaya tidak ada fitur yang hilang.
insert into public.tenant_subscriptions (company_id, plan_code, status, catatan)
select id, 'enterprise', 'active', 'Tenant peragaan — dipasang otomatis oleh migrasi 0051'
from public.companies on conflict (company_id) do nothing;

-- ---------------------------------------------------------------------
-- 3. Status efektif, modul & fitur aktif
-- ---------------------------------------------------------------------
create or replace function public.fn_status_langganan(p_company uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case when s.status = 'trial' and s.trial_ends_at is not null and s.trial_ends_at < now()
                then 'trial_berakhir' else s.status end
    from public.tenant_subscriptions s where s.company_id = p_company), 'legacy');
$$;

create or replace function public.fn_modul_aktif(p_module text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_module in ('CORE','DASHBOARD') then true else coalesce((
    select s.status <> 'cancelled' and coalesce(
      (select o.enabled from public.tenant_feature_overrides o
        where o.company_id = s.company_id and o.feature_code = 'modul:' || p_module),
      p.modules @> array[p_module])
    from public.tenant_subscriptions s join public.saas_plans p on p.code = s.plan_code
    where s.company_id = public.auth_company_id()), true) end;
$$;

create or replace function public.fn_fitur_aktif(p_feature text, p_company uuid default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select s.status <> 'cancelled' and coalesce(
      (select o.enabled from public.tenant_feature_overrides o
        where o.company_id = s.company_id and o.feature_code = 'fitur:' || p_feature),
      p.features @> array[p_feature])
    from public.tenant_subscriptions s join public.saas_plans p on p.code = s.plan_code
    where s.company_id = coalesce(p_company, public.auth_company_id())), true);
$$;

create or replace function public.fn_boleh_tulis()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.fn_status_langganan(public.auth_company_id()) in ('trial','active','past_due','legacy');
$$;

-- can_* kini juga menghormati paket: modul di luar paket = tertutup,
-- langganan ditangguhkan / trial berakhir = hanya-baca.
create or replace function public.can_read(p_module text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.fn_modul_aktif(p_module) and (public.is_super() or coalesce((
    select rma.can_read from public.role_module_access rma
    where rma.company_id = public.auth_company_id() and rma.role = public.auth_role()
      and rma.module_code = p_module), false));
$$;
create or replace function public.can_write(p_module text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.fn_modul_aktif(p_module) and public.fn_boleh_tulis() and (public.is_super() or coalesce((
    select rma.can_write from public.role_module_access rma
    where rma.company_id = public.auth_company_id() and rma.role = public.auth_role()
      and rma.module_code = p_module), false));
$$;
create or replace function public.can_approve(p_module text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.fn_modul_aktif(p_module) and public.fn_boleh_tulis() and (public.is_super() or coalesce((
    select rma.can_approve from public.role_module_access rma
    where rma.company_id = public.auth_company_id() and rma.role = public.auth_role()
      and rma.module_code = p_module), false));
$$;

-- ---------------------------------------------------------------------
-- 4. Pemakaian & kuota
-- ---------------------------------------------------------------------
create or replace function public.fn_pemakaian(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public, storage, pg_temp as $$
declare v jsonb;
begin
  if auth.uid() is not null and current_setting('nusakarya.sistem', true) is distinct from 'on'
     and p_company is distinct from public.auth_company_id() and not public.is_platform_admin() then
    raise exception 'Tidak berwenang melihat pemakaian perusahaan lain.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles where company_id = p_company and is_active and role not in ('teknisi','mitra')),
    'teknisi', (select count(*) from public.profiles where company_id = p_company and is_active and role in ('teknisi','mitra')),
    'wo_bulan_ini', (select count(*) from public.work_orders where company_id = p_company and created_at >= date_trunc('month', now())),
    'storage_mb', round(coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o
                   where o.bucket_id = 'files' and o.name like p_company::text || '/%'), 0) / 1048576.0, 1)
  ) into v;
  return v;
end $$;

create or replace function public.fn_cek_kuota(p_company uuid, p_metrik text, p_tambah int default 1)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  p public.saas_plans; s public.tenant_subscriptions; u jsonb; v_pakai numeric; v_batas numeric; v_keras boolean;
  v_label text;
begin
  select * into s from public.tenant_subscriptions where company_id = p_company;
  if not found then return jsonb_build_object('ok', true, 'keras', false, 'pesan', 'Tanpa paket (legacy)'); end if;
  select * into p from public.saas_plans where code = s.plan_code;
  u := public.fn_pemakaian(p_company);
  if p_metrik = 'users' then
    v_pakai := (u->>'users')::numeric; v_batas := p.max_users; v_keras := true; v_label := 'pengguna panel';
  elsif p_metrik = 'teknisi' then
    v_pakai := (u->>'teknisi')::numeric; v_batas := p.max_technicians; v_keras := false; v_label := 'teknisi aktif';
  elsif p_metrik = 'wo' then
    v_pakai := (u->>'wo_bulan_ini')::numeric; v_batas := p.max_wo_month; v_keras := false; v_label := 'WO bulan ini';
  else
    v_pakai := (u->>'storage_mb')::numeric / 1024; v_batas := p.max_storage_gb; v_keras := false; v_label := 'GB penyimpanan';
  end if;
  if v_batas is null or v_pakai + p_tambah <= v_batas then
    return jsonb_build_object('ok', true, 'keras', v_keras, 'pakai', v_pakai, 'batas', v_batas);
  end if;
  return jsonb_build_object('ok', false, 'keras', v_keras, 'pakai', v_pakai, 'batas', v_batas,
    'pesan', format('Batas %s paket %s adalah %s (terpakai %s). %s', v_label, p.name, v_batas, v_pakai,
      case when v_keras then 'Naikkan paket atau nonaktifkan akun yang tidak dipakai.'
           else 'Kelebihan tetap diizinkan dan akan ditagih sebagai overage.' end));
end $$;
revoke execute on function public.fn_cek_kuota(uuid, text, int) from anon;

create or replace function public.fn_jaga_kuota_profil()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
  if new.role in ('teknisi','mitra') then return new; end if;  -- teknisi = kuota lunak (overage)
  if tg_op = 'INSERT' or (new.is_active and not old.is_active) or (old.role in ('teknisi','mitra')) then
    if new.is_active then
      v := public.fn_cek_kuota(new.company_id, 'users', 1);
      if not (v->>'ok')::boolean then raise exception '%', v->>'pesan' using errcode = 'P0402'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_kuota on public.profiles;
create trigger trg_profiles_kuota before insert or update of is_active, role on public.profiles
  for each row execute function public.fn_jaga_kuota_profil();

-- ---------------------------------------------------------------------
-- 5. Ringkasan langganan untuk UI tenant
-- ---------------------------------------------------------------------
create or replace function public.fn_ringkasan_langganan()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c uuid := public.auth_company_id(); s public.tenant_subscriptions; p public.saas_plans;
begin
  if c is null then return null; end if;
  select * into s from public.tenant_subscriptions where company_id = c;
  if not found then
    return jsonb_build_object('status', 'legacy', 'modules', null, 'features', null, 'usage', public.fn_pemakaian(c));
  end if;
  select * into p from public.saas_plans where code = s.plan_code;
  return jsonb_build_object(
    'plan_code', p.code, 'plan_name', p.name, 'status', public.fn_status_langganan(c),
    'trial_ends_at', s.trial_ends_at, 'period_start', s.period_start, 'period_end', s.period_end,
    'price_monthly', coalesce(s.price_override, p.price_monthly),
    'limits', jsonb_build_object('users', p.max_users, 'teknisi', p.max_technicians, 'wo_bulan_ini', p.max_wo_month, 'storage_gb', p.max_storage_gb),
    'modules', (select coalesce(jsonb_agg(m), '[]') from (
        select m from unnest(p.modules) m
        where coalesce((select o.enabled from public.tenant_feature_overrides o where o.company_id = c and o.feature_code = 'modul:' || m), true)
        union select substr(o.feature_code, 7) from public.tenant_feature_overrides o where o.company_id = c and o.feature_code like 'modul:%' and o.enabled) x),
    'features', (select coalesce(jsonb_agg(f), '[]') from (
        select f from unnest(p.features) f
        where coalesce((select o.enabled from public.tenant_feature_overrides o where o.company_id = c and o.feature_code = 'fitur:' || f), true)
        union select substr(o.feature_code, 7) from public.tenant_feature_overrides o where o.company_id = c and o.feature_code like 'fitur:%' and o.enabled) y),
    'usage', public.fn_pemakaian(c),
    'support', p.support_level);
end $$;
revoke execute on function public.fn_ringkasan_langganan() from anon;

-- ---------------------------------------------------------------------
-- 6. Kesiapan penagihan — tagihan langganan ke tenant (draft, tanpa gateway)
-- ---------------------------------------------------------------------
create table if not exists public.saas_invoices (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  invoice_no   text not null unique,
  period_start date not null,
  period_end   date not null,
  plan_code    text references public.saas_plans(code),
  lines        jsonb not null default '[]',
  subtotal     numeric not null default 0,
  status       text not null default 'draft' check (status in ('draft','terbit','lunas','batal')),
  due_date     date,
  issued_at    timestamptz,
  paid_at      timestamptz,
  catatan      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, period_start)
);
alter table public.saas_invoices enable row level security;
drop policy if exists sinv_read on public.saas_invoices;
create policy sinv_read on public.saas_invoices for select
  using ((company_id = public.auth_company_id() and status <> 'draft') or public.is_platform_admin());
drop policy if exists sinv_write on public.saas_invoices;
create policy sinv_write on public.saas_invoices for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select, insert, update, delete on public.saas_invoices to authenticated;

create or replace function public.fn_buat_draft_tagihan(p_company uuid, p_bulan date default date_trunc('month', current_date)::date)
returns public.saas_invoices language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.tenant_subscriptions; p public.saas_plans; u jsonb; v_lines jsonb := '[]'; v_total numeric := 0;
  v_awal date := date_trunc('month', p_bulan)::date; v_akhir date := (date_trunc('month', p_bulan) + interval '1 month - 1 day')::date;
  v_teknisi numeric; v_wo numeric; v_inv public.saas_invoices; v_harga numeric;
begin
  if not public.is_platform_admin() then raise exception 'Hanya platform admin.' using errcode = '42501'; end if;
  select * into s from public.tenant_subscriptions where company_id = p_company;
  if not found then raise exception 'Tenant belum punya langganan.'; end if;
  select * into p from public.saas_plans where code = s.plan_code;
  u := public.fn_pemakaian(p_company);
  v_harga := coalesce(s.price_override, p.price_monthly);
  v_lines := v_lines || jsonb_build_array(jsonb_build_object('uraian', 'Langganan paket ' || p.name || ' ' || to_char(v_awal, 'MM/YYYY'), 'qty', 1, 'harga', v_harga, 'jumlah', v_harga));
  v_total := v_harga;
  v_teknisi := greatest(0, (u->>'teknisi')::numeric - coalesce(p.max_technicians, 1e9));
  if v_teknisi > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('uraian', 'Overage teknisi aktif', 'qty', v_teknisi, 'harga', p.overage_technician, 'jumlah', v_teknisi * p.overage_technician));
    v_total := v_total + v_teknisi * p.overage_technician;
  end if;
  select greatest(0, count(*) - coalesce(p.max_wo_month, 1e9)) into v_wo from public.work_orders
   where company_id = p_company and created_at >= v_awal and created_at < v_akhir + 1;
  if v_wo > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('uraian', 'Overage work order', 'qty', v_wo, 'harga', p.overage_wo, 'jumlah', v_wo * p.overage_wo));
    v_total := v_total + v_wo * p.overage_wo;
  end if;
  insert into public.saas_invoices (company_id, invoice_no, period_start, period_end, plan_code, lines, subtotal, due_date, catatan)
  values (p_company, 'NKS-' || to_char(v_awal, 'YYYYMM') || '-' || upper(substr(p_company::text, 1, 6)), v_awal, v_akhir, p.code,
          v_lines, v_total, v_akhir + 14, 'Harga belum termasuk PPN. Draft otomatis — periksa sebelum diterbitkan.')
  on conflict (company_id, period_start) do update set lines = excluded.lines, subtotal = excluded.subtotal, updated_at = now()
    where public.saas_invoices.status = 'draft'
  returning * into v_inv;
  return v_inv;
end $$;
revoke execute on function public.fn_buat_draft_tagihan(uuid, date) from anon;

-- ---------------------------------------------------------------------
-- 7. Pengaturan perusahaan & onboarding
-- ---------------------------------------------------------------------
create table if not exists public.tenant_settings (
  id                uuid not null default gen_random_uuid() unique,
  company_id        uuid primary key references public.companies(id) on delete cascade,
  zona_waktu        text not null default 'Asia/Jakarta',
  mata_uang         text not null default 'IDR',
  format_tanggal    text not null default 'DD/MM/YYYY',
  awal_tahun_fiskal int  not null default 1 check (awal_tahun_fiskal between 1 and 12),
  warna_utama       text,
  prefix_wo         text not null default 'WO',
  hari_kerja        int[] not null default array[1,2,3,4,5,6],
  jam_mulai         time not null default '08:00',
  jam_selesai       time not null default '17:00',
  radius_absensi_m  int not null default 200,
  wajib_foto_evidence int not null default 2,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users(id)
);
alter table public.tenant_settings enable row level security;
drop policy if exists tset_read on public.tenant_settings;
create policy tset_read on public.tenant_settings for select using (company_id = public.auth_company_id() or public.is_platform_admin());
drop policy if exists tset_write on public.tenant_settings;
create policy tset_write on public.tenant_settings for all
  using (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis())
  with check (company_id = public.auth_company_id() and public.is_super() and public.fn_boleh_tulis());
grant select, insert, update on public.tenant_settings to authenticated;
insert into public.tenant_settings (company_id) select id from public.companies on conflict do nothing;

create table if not exists public.tenant_onboarding (
  id             uuid not null default gen_random_uuid() unique,
  company_id     uuid primary key references public.companies(id) on delete cascade,
  template_code  text,
  langkah_selesai text[] not null default '{}',
  activated_at   timestamptz,
  activated_by   uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.tenant_onboarding enable row level security;
drop policy if exists tonb_read on public.tenant_onboarding;
create policy tonb_read on public.tenant_onboarding for select using (company_id = public.auth_company_id() or public.is_platform_admin());
drop policy if exists tonb_write on public.tenant_onboarding;
create policy tonb_write on public.tenant_onboarding for update
  using (company_id = public.auth_company_id() and public.is_super())
  with check (company_id = public.auth_company_id() and public.is_super());
grant select, update on public.tenant_onboarding to authenticated;
insert into public.tenant_onboarding (company_id, template_code, langkah_selesai, activated_at)
select id, 'fo_telkom_akses', array['perusahaan','template','impor','validasi','pratinjau','aktivasi'], now()
from public.companies on conflict do nothing;

-- ---------------------------------------------------------------------
-- 8. Template bisnis
-- ---------------------------------------------------------------------
create table if not exists public.business_templates (
  code        text primary key,
  name        text not null,
  description text,
  config      jsonb not null default '{}',
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.business_templates enable row level security;
drop policy if exists btpl_read on public.business_templates;
create policy btpl_read on public.business_templates for select using (true);
drop policy if exists btpl_write on public.business_templates;
create policy btpl_write on public.business_templates for all using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select on public.business_templates to anon, authenticated;
grant insert, update, delete on public.business_templates to authenticated;

-- Template "Mitra Fiber Optic Telkom Akses" disusun dari konfigurasi tenant pola
-- (matriks akses, jenis pekerjaan, master referensi, RCA, shift, kompetensi,
-- komponen gaji, COA). Tarif tetap berlabel asumsi_sistem -> wajib diverifikasi.
do $$
declare v_src uuid; v_strip text[] := array['id','company_id','created_at','updated_at','created_by'];
begin
  select id into v_src from public.companies order by created_at limit 1;
  if v_src is null then return; end if;
  insert into public.business_templates (code, name, description, sort_order, config)
  values ('fo_telkom_akses', 'Mitra Fiber Optic Telkom Akses',
    'Untuk kontraktor PSB, assurance, maintenance & deployment FTTH. Berisi 23 jabatan dengan matriks akses, katalog jenis pekerjaan (tarif ASUMSI — wajib diganti tarif kontrak), akar masalah 4 aspek, shift, kompetensi, komponen gaji, bagan akun, field kustom & SLA tiket bawaan.',
    1, jsonb_build_object(
      'role_module_access', (select jsonb_agg(jsonb_build_object('role', role, 'module_code', module_code, 'can_read', can_read, 'can_write', can_write, 'can_approve', can_approve)) from public.role_module_access where company_id = v_src),
      'job_types',        (select jsonb_agg(to_jsonb(t) - v_strip - 'price_verified_at' - 'price_verified_by' || jsonb_build_object('price_source','asumsi_sistem')) from public.job_types t where company_id = v_src),
      'master_references',(select jsonb_agg(to_jsonb(t) - v_strip) from public.master_references t where company_id = v_src),
      'root_causes',      (select jsonb_agg(to_jsonb(t) - v_strip) from public.root_causes t where company_id = v_src),
      'shifts',           (select jsonb_agg(to_jsonb(t) - v_strip) from public.shifts t where company_id = v_src),
      'competencies',     (select jsonb_agg(to_jsonb(t) - v_strip) from public.competencies t where company_id = v_src),
      'salary_components',(select jsonb_agg(to_jsonb(t) - v_strip) from public.salary_components t where company_id = v_src),
      'chart_of_accounts',(select jsonb_agg(to_jsonb(t) - v_strip) from public.chart_of_accounts t where company_id = v_src)))
  on conflict (code) do update set config = excluded.config, description = excluded.description, updated_at = now();

  insert into public.business_templates (code, name, description, sort_order, config)
  values ('kontraktor_umum', 'Kontraktor Jaringan Umum',
    'Matriks akses 23 jabatan dan bagan akun saja. Jenis pekerjaan, tarif, dan master data diisi sendiri lewat Pusat Impor.',
    2, jsonb_build_object(
      'role_module_access', (select jsonb_agg(jsonb_build_object('role', role, 'module_code', module_code, 'can_read', can_read, 'can_write', can_write, 'can_approve', can_approve)) from public.role_module_access where company_id = v_src),
      'chart_of_accounts',(select jsonb_agg(to_jsonb(t) - v_strip) from public.chart_of_accounts t where company_id = v_src)))
  on conflict (code) do update set config = excluded.config, description = excluded.description, updated_at = now();
end $$;

create or replace function public.fn__sisip_json(p_company uuid, p_tabel text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then return 0; end if;
  execute format($f$
    insert into public.%1$I
    select (jsonb_populate_record(null::public.%1$I,
             x || jsonb_build_object('id', gen_random_uuid(), 'company_id', $1, 'created_at', now(), 'updated_at', now()))).*
    from jsonb_array_elements($2) x
    on conflict do nothing$f$, p_tabel) using p_company, p_rows;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.fn__sisip_json(uuid, text, jsonb) from anon, authenticated, public;

create or replace function public.fn_terapkan_template(p_company uuid, p_template text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare cfg jsonb; t text; hasil jsonb := '{}';
begin
  if auth.uid() is not null and current_setting('nusakarya.sistem', true) is distinct from 'on'
     and not public.is_platform_admin()
     and not (p_company = public.auth_company_id() and public.is_super()) then
    raise exception 'Hanya Super Admin perusahaan ini yang boleh menerapkan template.' using errcode = '42501';
  end if;
  select config into cfg from public.business_templates where code = p_template and is_active;
  if cfg is null then raise exception 'Template % tidak ditemukan.', p_template; end if;
  foreach t in array array['role_module_access','job_types','master_references','root_causes','shifts',
                           'competencies','salary_components','chart_of_accounts','custom_field_defs',
                           'tenant_status_labels','tenant_sla_rules'] loop
    if cfg ? t and to_regclass('public.' || t) is not null then
      hasil := hasil || jsonb_build_object(t, public.fn__sisip_json(p_company, t, cfg->t));
    end if;
  end loop;
  update public.tenant_onboarding set template_code = p_template,
    langkah_selesai = (select array_agg(distinct x) from unnest(langkah_selesai || array['template']) x), updated_at = now()
   where company_id = p_company;
  insert into public.audit_logs (company_id, user_id, action, entity_type, after)
  values (p_company, auth.uid(), 'terapkan_template', 'business_templates', jsonb_build_object('template', p_template, 'hasil', hasil));
  return hasil;
end $$;
revoke execute on function public.fn_terapkan_template(uuid, text) from anon;

-- ---------------------------------------------------------------------
-- 9. Pembuatan workspace (tenant) mandiri
-- ---------------------------------------------------------------------
create or replace function public.fn__buat_workspace(
  p_user uuid, p_nama text, p_template text default 'fo_telkom_akses', p_paket text default 'professional',
  p_nama_admin text default null, p_telepon text default null, p_data_contoh boolean default false)
returns uuid language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  v_company uuid; v_email text; v_kode text; v_nama text := trim(coalesce(p_nama, ''));
begin
  if p_user is null then raise exception 'Pengguna tidak dikenal.'; end if;
  if exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Akun ini sudah terdaftar di sebuah workspace.' using errcode = '23505';
  end if;
  if length(v_nama) < 3 then raise exception 'Nama perusahaan minimal 3 karakter.' using errcode = '22023'; end if;
  if not exists (select 1 from public.saas_plans where code = p_paket and is_public) then p_paket := 'professional'; end if;
  if (select count(*) from public.companies where created_by = p_user) >= 2 then
    raise exception 'Batas pembuatan workspace per akun tercapai. Hubungi tim NUSAKARYA.' using errcode = '54000';
  end if;
  if (select count(*) from public.companies where created_at > now() - interval '1 day') >= 30 then
    raise exception 'Pendaftaran sedang dibatasi. Coba lagi besok atau hubungi tim NUSAKARYA.' using errcode = '54000';
  end if;
  select email into v_email from auth.users where id = p_user;

  v_kode := upper(regexp_replace(left(v_nama, 12), '[^A-Za-z0-9]', '', 'g'));
  if v_kode = '' then v_kode := 'TNT'; end if;
  v_kode := v_kode || '-' || upper(substr(md5(random()::text), 1, 4));

  insert into public.companies (name, code, email, phone, is_active, is_demo, created_by)
  values (v_nama, v_kode, v_email, p_telepon, true, coalesce(p_data_contoh, false), p_user)
  returning id into v_company;

  insert into public.branches (company_id, code, name, is_active, created_by)
  values (v_company, 'PUSAT', 'Kantor Pusat', true, p_user);

  perform set_config('nusakarya.sistem', 'on', true);
  insert into public.profiles (id, company_id, full_name, email, phone, role, is_active)
  values (p_user, v_company, coalesce(nullif(trim(p_nama_admin), ''), split_part(v_email, '@', 1)), v_email, p_telepon, 'super_admin', true);

  insert into public.tenant_subscriptions (company_id, plan_code, status, trial_ends_at, catatan)
  values (v_company, p_paket, 'trial', now() + interval '30 days', 'Uji coba 30 hari dari pendaftaran mandiri');
  insert into public.tenant_settings (company_id) values (v_company) on conflict do nothing;
  insert into public.tenant_onboarding (company_id, template_code, langkah_selesai)
  values (v_company, p_template, array['perusahaan']) on conflict do nothing;

  -- Template & data contoh diterapkan sebagai SISTEM (bendera nusakarya.sistem).
  perform public.fn_terapkan_template(v_company, coalesce(p_template, 'kontraktor_umum'));
  if coalesce(p_data_contoh, false) then perform public.fn_isi_data_contoh(v_company); end if;
  perform set_config('nusakarya.sistem', 'off', true);

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, after)
  values (v_company, p_user, 'buat_workspace', 'companies', v_company,
          jsonb_build_object('nama', v_nama, 'paket', p_paket, 'template', p_template, 'data_contoh', p_data_contoh));
  return v_company;
end $$;
revoke execute on function public.fn__buat_workspace(uuid, text, text, text, text, text, boolean) from anon, authenticated, public;

-- Pembungkus untuk pengguna yang sudah login tapi belum punya workspace.
create or replace function public.fn_buat_workspace(
  p_nama text, p_template text default 'fo_telkom_akses', p_paket text default 'professional',
  p_nama_admin text default null, p_telepon text default null, p_data_contoh boolean default false)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu.' using errcode = '42501'; end if;
  return public.fn__buat_workspace(auth.uid(), p_nama, p_template, p_paket, p_nama_admin, p_telepon, p_data_contoh);
end $$;
revoke execute on function public.fn_buat_workspace(text, text, text, text, text, boolean) from anon;

-- fn_jaga_profil (0050) perlu mengenali sisipan oleh sistem pembuat workspace.
create or replace function public.fn_jaga_profil()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_company uuid;
begin
  if v_uid is null or public.is_platform_admin() or current_setting('nusakarya.sistem', true) = 'on' then
    return new;
  end if;
  select role, company_id into v_role, v_company from public.profiles where id = v_uid;
  if tg_op = 'INSERT' then
    if new.company_id is distinct from v_company then
      raise exception 'Pengguna hanya bisa ditambahkan ke perusahaan Anda sendiri.' using errcode = '42501';
    end if;
    if new.role = 'super_admin' and v_role <> 'super_admin' then
      raise exception 'Hanya Super Admin yang boleh membuat akun Super Admin.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.id is distinct from old.id or new.company_id is distinct from old.company_id then
    raise exception 'Perpindahan akun antar-perusahaan tidak diizinkan.' using errcode = '42501';
  end if;
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active
  or new.employee_id is distinct from old.employee_id or new.branch_id is distinct from old.branch_id
  or new.unit is distinct from old.unit then
    if old.company_id is distinct from v_company then
      raise exception 'Akun ini bukan milik perusahaan Anda.' using errcode = '42501';
    end if;
    if new.id = v_uid and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
      raise exception 'Anda tidak dapat mengubah jabatan atau status akun Anda sendiri.' using errcode = '42501';
    end if;
    if v_role = 'super_admin' then return new; end if;
    if v_role = 'manager_hr' and old.role <> 'super_admin' and new.role <> 'super_admin' then return new; end if;
    raise exception 'Hanya Super Admin (atau Manager HR untuk akun non-admin) yang boleh mengubah jabatan, status, cabang, atau tautan karyawan.'
      using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 10. Undangan tim
-- ---------------------------------------------------------------------
create table if not exists public.tenant_invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null,
  branch_id   uuid references public.branches(id),
  token       text not null unique default encode(gen_random_bytes(18), 'hex'),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at  timestamptz,
  invited_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_tenant_invites_company on public.tenant_invites(company_id);
alter table public.tenant_invites enable row level security;
drop policy if exists tinv_rw on public.tenant_invites;
create policy tinv_rw on public.tenant_invites for all
  using (company_id = public.auth_company_id() and public.auth_role() in ('super_admin','manager_hr'))
  with check (company_id = public.auth_company_id() and public.auth_role() in ('super_admin','manager_hr')
              and (role <> 'super_admin' or public.is_super()) and public.fn_boleh_tulis());
grant select, insert, update, delete on public.tenant_invites to authenticated;

-- Info undangan untuk halaman publik "terima undangan" (tanpa login).
create or replace function public.fn_info_undangan(p_token text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('email', i.email, 'full_name', i.full_name, 'role', i.role, 'perusahaan', c.name,
         'berlaku', i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
  from public.tenant_invites i join public.companies c on c.id = i.company_id
  where i.token = p_token and length(p_token) >= 24;
$$;
grant execute on function public.fn_info_undangan(text) to anon, authenticated;

-- Untuk pengguna yang SUDAH login (akun sudah ada) menerima undangan.
create or replace function public.fn_terima_undangan(p_token text)
returns uuid language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare i public.tenant_invites; v_email text; v jsonb;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu.' using errcode = '42501'; end if;
  select * into i from public.tenant_invites where token = p_token for update;
  if not found or i.accepted_at is not null or i.revoked_at is not null or i.expires_at < now() then
    raise exception 'Undangan tidak berlaku atau sudah dipakai.' using errcode = '22023';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  if lower(v_email) <> lower(i.email) then
    raise exception 'Undangan ini ditujukan untuk %, bukan akun yang sedang masuk.', i.email using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Akun ini sudah terdaftar di sebuah workspace.' using errcode = '23505';
  end if;
  perform set_config('nusakarya.sistem', 'on', true);
  insert into public.profiles (id, company_id, full_name, email, role, branch_id, is_active)
  values (auth.uid(), i.company_id, coalesce(i.full_name, split_part(v_email, '@', 1)), v_email, i.role, i.branch_id, true);
  perform set_config('nusakarya.sistem', 'off', true);
  update public.tenant_invites set accepted_at = now(), accepted_by = auth.uid(), updated_at = now() where id = i.id;
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, after)
  values (i.company_id, auth.uid(), 'terima_undangan', 'tenant_invites', i.id, jsonb_build_object('email', i.email, 'role', i.role));
  return i.company_id;
end $$;
revoke execute on function public.fn_terima_undangan(text) from anon;

-- ---------------------------------------------------------------------
-- 11. Mode data contoh (dilacak supaya bisa dibersihkan tuntas)
-- ---------------------------------------------------------------------
create table if not exists public.demo_records (
  company_id uuid not null references public.companies(id) on delete cascade,
  tabel      text not null,
  row_id     uuid not null,
  urutan     int  not null,
  primary key (company_id, tabel, row_id)
);
alter table public.demo_records enable row level security;
drop policy if exists demo_read on public.demo_records;
create policy demo_read on public.demo_records for select using (company_id = public.auth_company_id());
grant select on public.demo_records to authenticated;

create or replace function public.fn_isi_data_contoh(p_company uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_br1 uuid := gen_random_uuid(); v_br2 uuid := gen_random_uuid();
  v_cus uuid := gen_random_uuid(); v_ctr uuid := gen_random_uuid();
  v_wh uuid := gen_random_uuid(); v_it1 uuid := gen_random_uuid(); v_it2 uuid := gen_random_uuid();
  v_emp uuid[] := array[]::uuid[]; v_id uuid; v_jt uuid[]; i int; v_st text[] := array['draft','dispatched','accepted','on_progress','done','done','done','failed','pending_material','done'];
  v_nama text[] := array['Andi Saputra','Budi Hartono','Citra Lestari','Dedi Kurnia','Eko Prasetyo','Fajar Ramadhan'];
  n int := 0;
begin
  if auth.uid() is not null and current_setting('nusakarya.sistem', true) is distinct from 'on'
     and not public.is_platform_admin() and not (p_company = public.auth_company_id() and public.is_super()) then
    raise exception 'Hanya Super Admin perusahaan ini.' using errcode = '42501';
  end if;
  insert into public.branches (id, company_id, code, name, city) values
    (v_br1, p_company, 'DMO-A', 'Cabang Contoh A', 'Padang'), (v_br2, p_company, 'DMO-B', 'Cabang Contoh B', 'Pekanbaru');
  insert into public.demo_records values (p_company,'branches',v_br1,90),(p_company,'branches',v_br2,90);
  insert into public.customers (id, company_id, code, name, customer_type, city, payment_term_days, status)
    values (v_cus, p_company, 'DMO-PRINCIPAL', 'Principal Contoh (fiktif)', 'principal', 'Padang', 45, 'aktif');
  insert into public.demo_records values (p_company,'customers',v_cus,80);
  insert into public.contracts (id, company_id, contract_no, contract_name, customer_id, contract_type, start_date, end_date, contract_value, status)
    values (v_ctr, p_company, 'DMO-KTR-001', 'Kontrak Contoh PSB & Assurance', v_cus, 'unit_price', current_date - 60, current_date + 300, 1500000000, 'aktif');
  insert into public.demo_records values (p_company,'contracts',v_ctr,70);
  insert into public.warehouses (id, company_id, code, name, warehouse_type, branch_id) values (v_wh, p_company, 'DMO-GD', 'Gudang Contoh', 'branch', v_br1);
  insert into public.demo_records values (p_company,'warehouses',v_wh,60);
  insert into public.item_catalog (id, company_id, code, name, category, uom, last_price, is_serial_tracked) values
    (v_it1, p_company, 'DMO-ONT', 'ONT Contoh', 'NTE', 'unit', 500000, true),
    (v_it2, p_company, 'DMO-DC', 'Kabel Drop Core Contoh', 'NON_NTE', 'roll', 150000, false);
  insert into public.demo_records values (p_company,'item_catalog',v_it1,50),(p_company,'item_catalog',v_it2,50);
  insert into public.stock_balances (id, company_id, warehouse_id, item_id, qty, avg_price) values
    (gen_random_uuid(), p_company, v_wh, v_it1, 40, 500000), (gen_random_uuid(), p_company, v_wh, v_it2, 120, 150000);
  insert into public.demo_records select p_company, 'stock_balances', id, 40 from public.stock_balances where company_id = p_company and warehouse_id = v_wh;
  for i in 1..6 loop
    v_id := gen_random_uuid();
    insert into public.employees (id, company_id, nip, full_name, branch_id, position, unit, employment_type, status, join_date, payroll_scheme)
      values (v_id, p_company, 'DMO-' || lpad(i::text, 3, '0'), v_nama[i] || ' (contoh)', case when i % 2 = 0 then v_br2 else v_br1 end,
              'Teknisi Fiber Optic', 'OPERATIONS', 'PKWT', 'aktif', current_date - 200, 'fix_salary');
    insert into public.demo_records values (p_company, 'employees', v_id, 30);
    v_emp := v_emp || v_id;
  end loop;
  select array_agg(id) into v_jt from public.job_types where company_id = p_company;
  for i in 1..30 loop
    v_id := gen_random_uuid();
    insert into public.work_orders (id, company_id, wo_no, wo_type, job_type_id, title, customer_name, address, branch_id,
      scheduled_at, assigned_to, status, qc_status, created_at, started_at, finished_at)
    values (v_id, p_company, 'DMO-WO-' || lpad(i::text, 4, '0'), (array['PSB','GANGGUAN','MAINTENANCE'])[1 + i % 3],
      case when v_jt is not null then v_jt[1 + i % array_length(v_jt, 1)] end,
      'Pekerjaan contoh #' || i, 'Pelanggan Contoh ' || i, 'Alamat contoh ' || i,
      case when i % 2 = 0 then v_br2 else v_br1 end, now() - (i || ' days')::interval, v_emp[1 + i % 6],
      v_st[1 + i % 10], case when v_st[1 + i % 10] = 'done' then (array['lulus','lulus','belum','tidak_lulus'])[1 + i % 4] else 'belum' end,
      now() - (i || ' days')::interval,
      case when v_st[1 + i % 10] in ('on_progress','done','failed') then now() - (i || ' days')::interval + interval '1 hour' end,
      case when v_st[1 + i % 10] in ('done','failed') then now() - (i || ' days')::interval + interval '3 hours' end);
    insert into public.demo_records values (p_company, 'work_orders', v_id, 10);
    n := n + 1;
  end loop;
  insert into public.ar_invoices (id, company_id, inv_no, invoice_date, due_date, customer_id, contract_id, dpp, ppn, total, paid_amount, status)
    values (gen_random_uuid(), p_company, 'DMO-INV-001', current_date - 40, current_date + 5, v_cus, v_ctr, 100000000, 11000000, 111000000, 0, 'terkirim'),
           (gen_random_uuid(), p_company, 'DMO-INV-002', current_date - 75, current_date - 30, v_cus, v_ctr, 80000000, 8800000, 88800000, 40000000, 'dibayar_sebagian');
  insert into public.demo_records select p_company, 'ar_invoices', id, 20 from public.ar_invoices where company_id = p_company and inv_no like 'DMO-INV-%';
  update public.companies set is_demo = true where id = p_company;
  return jsonb_build_object('cabang', 2, 'karyawan', 6, 'work_order', n, 'invoice', 2);
end $$;
revoke execute on function public.fn_isi_data_contoh(uuid) from anon;

create or replace function public.fn_hapus_data_contoh(p_company uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n int := 0; gagal int := 0;
begin
  if auth.uid() is not null and current_setting('nusakarya.sistem', true) is distinct from 'on'
     and not public.is_platform_admin() and not (p_company = public.auth_company_id() and public.is_super()) then
    raise exception 'Hanya Super Admin perusahaan ini.' using errcode = '42501';
  end if;
  for r in select * from public.demo_records where company_id = p_company order by urutan loop
    begin
      execute format('delete from public.%I where id = $1 and company_id = $2', r.tabel) using r.row_id, p_company;
      n := n + 1;
    exception when foreign_key_violation then gagal := gagal + 1; continue;
    end;
    delete from public.demo_records where company_id = p_company and tabel = r.tabel and row_id = r.row_id;
  end loop;
  if gagal = 0 then update public.companies set is_demo = false where id = p_company; end if;
  insert into public.audit_logs (company_id, user_id, action, entity_type, after)
  values (p_company, auth.uid(), 'hapus_data_contoh', 'companies', jsonb_build_object('dihapus', n, 'tertahan', gagal));
  return jsonb_build_object('dihapus', n, 'tertahan_relasi', gagal);
end $$;
revoke execute on function public.fn_hapus_data_contoh(uuid) from anon;

-- ---------------------------------------------------------------------
-- 12. Kesehatan tenant (platform admin)
-- ---------------------------------------------------------------------
create or replace function public.fn_platform_tenant()
returns table (company_id uuid, nama text, kode text, is_demo boolean, dibuat timestamptz,
  paket text, status text, trial_berakhir timestamptz, harga_bulanan numeric,
  pengguna bigint, teknisi bigint, wo_bulan_ini bigint, wo_7_hari bigint, storage_mb numeric,
  login_terakhir timestamptz, login_7_hari bigint, impor_gagal_7_hari bigint,
  onboarding_aktif boolean, batas_pengguna int, batas_teknisi int, batas_wo int, skor_kesehatan int)
language plpgsql stable security definer set search_path = public, storage, pg_temp as $$
begin
  if not public.is_platform_admin() then raise exception 'Hanya platform admin.' using errcode = '42501'; end if;
  return query
  with b as (
    select c.id, c.name, c.code, c.is_demo, c.created_at, p.name as paket, public.fn_status_langganan(c.id) as st,
      s.trial_ends_at, coalesce(s.price_override, p.price_monthly) as harga,
      (select count(*) from public.profiles x where x.company_id = c.id and x.is_active and x.role not in ('teknisi','mitra')) as usr,
      (select count(*) from public.profiles x where x.company_id = c.id and x.is_active and x.role in ('teknisi','mitra')) as tek,
      (select count(*) from public.work_orders w where w.company_id = c.id and w.created_at >= date_trunc('month', now())) as wom,
      (select count(*) from public.work_orders w where w.company_id = c.id and w.updated_at >= now() - interval '7 days') as wo7,
      round(coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o where o.bucket_id = 'files' and o.name like c.id::text || '/%'), 0) / 1048576.0, 1) as mb,
      (select max(x.last_login_at) from public.profiles x where x.company_id = c.id) as ll,
      (select count(*) from public.profiles x where x.company_id = c.id and x.last_login_at >= now() - interval '7 days') as l7,
      (select count(*) from public.audit_logs a where a.company_id = c.id and a.action = 'impor_gagal' and a.created_at >= now() - interval '7 days') as ig,
      (select o.activated_at is not null from public.tenant_onboarding o where o.company_id = c.id) as akt,
      p.max_users, p.max_technicians, p.max_wo_month
    from public.companies c
    left join public.tenant_subscriptions s on s.company_id = c.id
    left join public.saas_plans p on p.code = s.plan_code)
  select b.id, b.name, b.code, b.is_demo, b.created_at, b.paket, b.st, b.trial_ends_at, b.harga,
    b.usr, b.tek, b.wom, b.wo7, b.mb, b.ll, b.l7, b.ig, coalesce(b.akt, false), b.max_users, b.max_technicians, b.max_wo_month,
    (least(30, b.l7 * 10) + case when b.wo7 > 0 then 30 else 0 end + case when coalesce(b.akt, false) then 20 else 0 end
      + case when (b.max_users is null or b.usr <= b.max_users) and (b.max_wo_month is null or b.wom <= b.max_wo_month) then 20 else 5 end
      - case when b.ig > 0 then 10 else 0 end)::int
  from b order by b.created_at;
end $$;
revoke execute on function public.fn_platform_tenant() from anon;

-- ---------------------------------------------------------------------
-- 13. Validasi data awal (langkah onboarding)
-- ---------------------------------------------------------------------
create or replace function public.fn_validasi_data_awal()
returns table (kunci text, label text, jumlah bigint, status text, saran text, tautan text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c uuid := public.auth_company_id();
begin
  if c is null then return; end if;
  return query
  select 'cabang', 'Cabang', (select count(*) from public.branches where company_id = c),
    case when (select count(*) from public.branches where company_id = c) > 1 then 'ok' else 'peringatan' end,
    'Minimal satu cabang operasional selain Kantor Pusat.', '/pengaturan/cabang'
  union all select 'karyawan', 'Karyawan & teknisi', (select count(*) from public.employees where company_id = c and status = 'aktif'),
    case when (select count(*) from public.employees where company_id = c and status = 'aktif') > 0 then 'ok' else 'kosong' end,
    'Impor daftar karyawan/teknisi agar WO bisa ditugaskan.', '/pengaturan/impor?dataset=employees'
  union all select 'akun_teknisi', 'Teknisi yang sudah punya akun aplikasi',
    (select count(*) from public.employees where company_id = c and user_id is not null),
    case when (select count(*) from public.employees where company_id = c and user_id is not null) > 0 then 'ok' else 'peringatan' end,
    'Undang teknisi agar bisa login di aplikasi lapangan.', '/pengaturan/undang'
  union all select 'pelanggan', 'Pelanggan / principal', (select count(*) from public.customers where company_id = c),
    case when (select count(*) from public.customers where company_id = c) > 0 then 'ok' else 'kosong' end,
    'Minimal satu principal (pemberi kerja).', '/pengaturan/impor?dataset=customers'
  union all select 'kontrak', 'Kontrak aktif', (select count(*) from public.contracts where company_id = c and status = 'aktif'),
    case when (select count(*) from public.contracts where company_id = c and status = 'aktif') > 0 then 'ok' else 'kosong' end,
    'Kontrak adalah dasar BAST dan penagihan.', '/pengaturan/impor?dataset=contracts'
  union all select 'jenis_pekerjaan', 'Jenis pekerjaan', (select count(*) from public.job_types where company_id = c and is_active),
    case when (select count(*) from public.job_types where company_id = c and is_active) > 0 then 'ok' else 'kosong' end,
    'Katalog pekerjaan untuk poin & tarif.', '/pengaturan/impor?dataset=job_types'
  union all select 'tarif_asumsi', 'Tarif masih ASUMSI (belum dari kontrak)',
    (select count(*) from public.job_types where company_id = c and is_active and price_source = 'asumsi_sistem'),
    case when (select count(*) from public.job_types where company_id = c and is_active and price_source = 'asumsi_sistem') = 0 then 'ok' else 'peringatan' end,
    'Ganti dengan tarif kontrak sebelum dipakai membayar/menagih.', '/pengaturan/kesiapan'
  union all select 'gudang', 'Gudang & material', (select count(*) from public.warehouses where company_id = c),
    case when (select count(*) from public.warehouses where company_id = c) > 0 then 'ok' else 'kosong' end,
    'Diperlukan untuk pemakaian material & NTE.', '/pengaturan/impor?dataset=warehouses'
  union all select 'work_order', 'Work order', (select count(*) from public.work_orders where company_id = c),
    case when (select count(*) from public.work_orders where company_id = c) > 0 then 'ok' else 'kosong' end,
    'Impor WO berjalan agar dashboard langsung terisi.', '/pengaturan/impor?dataset=work_orders'
  union all select 'data_contoh', 'Data contoh (fiktif) masih ada', (select count(*) from public.demo_records where company_id = c),
    case when (select count(*) from public.demo_records where company_id = c) = 0 then 'ok' else 'peringatan' end,
    'Hapus data contoh sebelum aktivasi agar laporan tidak tercampur.', '/pengaturan/langganan';
end $$;
revoke execute on function public.fn_validasi_data_awal() from anon;

create or replace function public.fn_aktivasi_workspace()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare c uuid := public.auth_company_id();
begin
  if not public.is_super() then raise exception 'Hanya Super Admin.' using errcode = '42501'; end if;
  update public.tenant_onboarding set activated_at = coalesce(activated_at, now()), activated_by = auth.uid(),
    langkah_selesai = array['perusahaan','template','impor','validasi','pratinjau','aktivasi'], updated_at = now()
   where company_id = c;
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id)
  values (c, auth.uid(), 'aktivasi_workspace', 'companies', c);
end $$;
revoke execute on function public.fn_aktivasi_workspace() from anon;
