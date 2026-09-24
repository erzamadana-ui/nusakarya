-- =====================================================================
-- 0050_keamanan_tenant_dan_platform_admin.sql
-- Menutup temuan KRITIS audit 24 Sep 2026 sebelum lapisan SaaS dibangun.
--
--  K1  Pengguna mana pun bisa UPDATE baris profiles miliknya sendiri, termasuk
--      kolom role dan company_id  -> naik jadi super_admin & pindah tenant.
--  K2  handle_new_user() mempercayai raw_user_meta_data (diisi KLIEN saat signUp)
--      untuk company_id & role, dan jatuh ke "perusahaan pertama" bila kosong.
--  K3  super_admin milik SATU tenant bisa melihat/membuat seluruh perusahaan dan
--      mengubah tabel global (modules, peran_lapangan, impor_dataset_ref).
--  K4  fn_bangun_inbox_kerja(NULL) bisa dipanggil siapa saja dan menulis inbox
--      seluruh tenant.
--
-- Konsep baru: PLATFORM ADMIN (pemilik aplikasi NUSAKARYA) terpisah dari
-- super_admin (admin milik satu perusahaan mitra / tenant).
-- Idempoten.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Platform admin
-- ---------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  catatan    text,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
drop policy if exists platform_admins_self on public.platform_admins;
create policy platform_admins_self on public.platform_admins
  for select using (user_id = (select auth.uid()));
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
revoke execute on function public.is_platform_admin() from anon;

-- Akun administrator sistem bawaan menjadi platform admin pertama.
insert into public.platform_admins (user_id, catatan)
select id, 'Administrator sistem bawaan (migrasi 0050)'
from auth.users where lower(email) = 'admin@nusakarya.id'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. K1 — penjaga perubahan kolom sensitif pada profiles
-- ---------------------------------------------------------------------
create or replace function public.fn_jaga_profil()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_company uuid;
begin
  -- Tanpa JWT pengguna = service role / SQL editor / trigger auth -> dipercaya.
  if v_uid is null or public.is_platform_admin() then
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

  -- UPDATE
  if new.id is distinct from old.id or new.company_id is distinct from old.company_id then
    raise exception 'Perpindahan akun antar-perusahaan tidak diizinkan.' using errcode = '42501';
  end if;

  if new.role      is distinct from old.role
  or new.is_active is distinct from old.is_active
  or new.employee_id is distinct from old.employee_id
  or new.branch_id is distinct from old.branch_id
  or new.unit      is distinct from old.unit then
    if old.company_id is distinct from v_company then
      raise exception 'Akun ini bukan milik perusahaan Anda.' using errcode = '42501';
    end if;
    if new.id = v_uid and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
      raise exception 'Anda tidak dapat mengubah jabatan atau status akun Anda sendiri.' using errcode = '42501';
    end if;
    if v_role = 'super_admin' then
      return new;
    end if;
    if v_role = 'manager_hr' and old.role <> 'super_admin' and new.role <> 'super_admin' then
      return new;
    end if;
    raise exception 'Hanya Super Admin (atau Manager HR untuk akun non-admin) yang boleh mengubah jabatan, status, cabang, atau tautan karyawan.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_jaga on public.profiles;
create trigger trg_profiles_jaga before insert or update on public.profiles
  for each row execute function public.fn_jaga_profil();

-- ---------------------------------------------------------------------
-- 3. K2 — handle_new_user hanya percaya app_metadata (diisi server)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, auth, pg_temp as $$
declare
  v_company uuid;
  v_role    text;
begin
  -- app_metadata HANYA bisa diisi service role (Edge Function admin-users / saas-publik).
  v_company := nullif(new.raw_app_meta_data->>'company_id','')::uuid;
  v_role    := coalesce(nullif(new.raw_app_meta_data->>'role',''), 'viewer');

  -- Pendaftar mandiri (tanpa company di app_metadata) TIDAK otomatis masuk tenant
  -- mana pun. Ia akan diarahkan ke wizard "Buat Workspace" atau menerima undangan.
  if v_company is null or not exists (select 1 from public.companies where id = v_company) then
    return new;
  end if;

  insert into public.profiles (id, company_id, full_name, email, phone, role, unit, branch_id, employee_id, is_active)
  values (
    new.id, v_company,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)),
    new.email,
    nullif(new.raw_user_meta_data->>'phone',''),
    v_role,
    nullif(new.raw_app_meta_data->>'unit',''),
    nullif(new.raw_app_meta_data->>'branch_id','')::uuid,
    nullif(new.raw_app_meta_data->>'employee_id','')::uuid,
    true)
  on conflict (id) do nothing;

  if nullif(new.raw_app_meta_data->>'employee_id','') is not null then
    update public.employees set user_id = new.id
     where id = (new.raw_app_meta_data->>'employee_id')::uuid and company_id = v_company;
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.fn_hitung_pph21_bukan_pegawai(numeric, boolean) from anon;

-- ---------------------------------------------------------------------
-- 4. K3 — fungsi & tabel global hanya untuk platform admin
-- ---------------------------------------------------------------------
do $$
declare d text;
begin
  foreach d in array array['fn_daftar_perusahaan()', 'fn_tambah_perusahaan(text,text,text,text,text,text)'] loop
    execute replace(pg_get_functiondef(d::regprocedure), 'if not is_super() then', 'if not is_platform_admin() then');
  end loop;
end $$;

drop policy if exists modules_update on public.modules;
create policy modules_update on public.modules for update using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists modules_delete on public.modules;
create policy modules_delete on public.modules for delete using (public.is_platform_admin());
drop policy if exists peran_lapangan_write on public.peran_lapangan;
create policy peran_lapangan_write on public.peran_lapangan for all using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists impor_dataset_ref_kelola on public.impor_dataset_ref;
create policy impor_dataset_ref_kelola on public.impor_dataset_ref for all using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists inbox_tugas_delete on public.inbox_tugas;
create policy inbox_tugas_delete on public.inbox_tugas for delete
  using (company_id = public.auth_company_id() and public.is_super());

-- ---------------------------------------------------------------------
-- 5. K4 — inbox kerja: pengguna biasa hanya memindai tenant-nya sendiri
-- ---------------------------------------------------------------------
do $$
declare d text := pg_get_functiondef('public.fn_bangun_inbox_kerja(uuid)'::regprocedure);
begin
  if position('is_platform_admin()' in d) = 0 then
    execute replace(d, 'v_company uuid := p_company_id;',
      'v_company uuid := case when auth.uid() is null or public.is_platform_admin() then p_company_id else public.auth_company_id() end;');
  end if;
end $$;
