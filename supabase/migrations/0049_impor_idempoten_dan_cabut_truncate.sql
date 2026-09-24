-- =====================================================================
-- 0049_impor_idempoten_dan_cabut_truncate.sql
-- Tiga perbaikan yang muncul dari pengujian Pusat Impor.
-- =====================================================================

-- ---- 1. Cabut hak TRUNCATE dari pengguna aplikasi ----
-- TRUNCATE MENEMBUS Row Level Security: tidak ada kebijakan yang bisa
-- menahannya. Peran `authenticated` mewarisi hak itu atas seluruh tabel
-- public, artinya siapa pun yang berhasil login secara teknis bisa
-- mengosongkan tabel karyawan, absensi, atau penggajian. Hak ini tidak
-- pernah dibutuhkan aplikasi. (Hibah TRUNCATE pada VIEW dibiarkan karena
-- tidak bisa dieksekusi.)
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname='public' loop
    execute format('revoke truncate on public.%I from authenticated, anon', r.tablename);
  end loop;
end $$;

-- ---- 2. Impor ulang tidak boleh menggandakan formasi ----
-- Kunci alami employee_positions.object_id tidak cukup: 221 baris WFP tidak
-- punya object_id, dan formasi kosong tidak tercakup indeks parsial yang ada.
-- Terbukti pada pengujian: mengimpor berkas yang sama dua kali menggandakan
-- barisnya. Kunci yang dipakai sekarang adalah nomor baris pada berkas
-- sumber, yang stabil antar impor.
alter table employee_positions add column if not exists sumber_baris int;
comment on column employee_positions.sumber_baris is
  'Nomor baris pada berkas WFP sumber. Kunci alami agar impor ulang memperbarui, bukan menggandakan.';
create unique index if not exists uq_employee_positions_sumber
  on employee_positions (company_id, sumber_baris) where sumber_baris is not null;

-- ---- 3. Pemuat formasi memakai kunci alami itu ----
-- Sama dengan versi di 0048, dengan dua perubahan: kolom sumber_baris ikut
-- diisi, dan konflik ditangani dengan DO UPDATE, bukan DO NOTHING.
create or replace function fn_muat_karyawan_wfp(p_company_id uuid default auth_company_id())
returns table(langkah text, jumlah bigint)
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_co uuid; n bigint;
begin
  v_co := fn_jaga_impor_hr(p_company_id);

  insert into branches (company_id, code, name, city, is_active)
  select v_co, k.kode, 'Cabang '||initcap(k.kota), initcap(k.kota), true
  from (values ('BTM','batam'),('BKT','bukittinggi'),('DUM','dumai'),('PDG','padang'),('PBR','pekanbaru')) k(kode,kota)
  where not exists (select 1 from branches b where b.company_id=v_co and b.name ilike '%'||k.kota||'%');

  insert into employees (company_id, nip, nik_telkom, full_name, branch_id, position, unit,
                         employment_type, status, join_date, level_jabatan, kemitraan,
                         group_wfp, status_teknisi, status_salary, skill, payroll_scheme)
  select v_co, s.nik, s.nik, max(s.nama),
         (select b.id from branches b where b.company_id=v_co
            and b.name ilike '%'||replace(max(s.branch),'BRANCH ','')||'%' limit 1),
         max(s.position_title),
         case
           when max(s.sub_group) in ('FINANCE & BILCO') then 'FINANCE'
           when max(s.sub_group) in ('PROCUREMENT & PARTNERSHIP') then 'PROCUREMENT'
           when max(s.sub_group) in ('INVENTORY & ASSET MANAGEMENT AREA','WAREHOUSE SO','WAREHOUSE REFURBISH') then 'INVENTORY'
           when max(s.group_fungsi) in ('HCM & HSE') then 'HR'
           when max(s.group_fungsi) in ('B2B','B2C') then 'COMMERCE'
           when max(s.group_fungsi) in ('COMMERCIAL & SUPPLY CHAIN') then 'PROCUREMENT'
           when max(s.group_fungsi) in ('CONSTRUCTION','SDI') then 'DEPLOYMENT'
           when max(s.level_jabatan) in ('GM/VP/PM/PMO') then 'EXECUTIVE'
           when max(s.group_fungsi) in ('BUSINESS SUPPORT','SHARED SERVICE') then 'FINANCE'
           else 'OPERATIONS'
         end,
         case max(s.kemitraan) when 'TELKOM AKSES' then 'PKWTT' when 'MITRA' then 'MITRA' else 'OUTSOURCE' end,
         'aktif', current_date, max(s.level_jabatan),
         case when max(s.kemitraan) in ('TELKOM AKSES','MITRA','RIFO FIX','RIFO VARIABLE') then max(s.kemitraan) else null end,
         case when max(s.group_wfp) in ('RKAP','MITRA','RIFO','NFO') then max(s.group_wfp) else null end,
         case when max(s.status_teknisi) in ('PERFORMANCE BASED','RESOURCE BASED') then max(s.status_teknisi) else null end,
         case when max(s.status_salary) in ('FIXED','VARIABLE') then max(s.status_salary) else null end,
         case when max(s.skill) is null then null else string_to_array(max(s.skill), ' | ') end,
         coalesce(case max(s.status_salary) when 'FIXED' then 'fix_salary' when 'VARIABLE' then 'freelance' else null end, 'fix_salary')
  from stg_wfp s
  where s.company_id = v_co and s.nik is not null and s.nama is not null
  group by s.nik
  on conflict (company_id, nip) do update set
    nik_telkom = excluded.nik_telkom, full_name = excluded.full_name,
    branch_id = excluded.branch_id, position = excluded.position, unit = excluded.unit,
    employment_type = excluded.employment_type, level_jabatan = excluded.level_jabatan,
    kemitraan = excluded.kemitraan, group_wfp = excluded.group_wfp,
    status_teknisi = excluded.status_teknisi, status_salary = excluded.status_salary,
    skill = excluded.skill, payroll_scheme = excluded.payroll_scheme, updated_at = now();
  get diagnostics n = row_count; langkah := 'karyawan (insert/update)'; jumlah := n; return next;

  insert into employee_positions (company_id, sumber_baris, employee_id, object_id, position_name, position_title,
      branch_id, psa, portofolio, group_fungsi, sub_group, nama_program, gaji_per_teknisi,
      sto, sto_kode, sektor_ditangani, status_penugasan, aktif, berlaku_mulai)
  select v_co, s.baris, e.id,
         case when s.object_id ~ '^[0-9]{17}$' or s.object_id ~ '^MTR-[0-9]{4}$' then s.object_id else null end,
         s.position_name, s.position_title,
         (select b.id from branches b where b.company_id=v_co
            and b.name ilike '%'||replace(s.branch,'BRANCH ','')||'%' limit 1),
         s.psa, s.portofolio, s.group_fungsi, s.sub_group, s.nama_program, s.gaji,
         s.sto, s.sto_kode,
         case when s.sektor_ditangani is null then null else string_to_array(s.sektor_ditangani, ' | ') end,
         case when s.status_penugasan in ('DEFINITIF','PGS','POH') then s.status_penugasan else null end,
         true, current_date
  from stg_wfp s
  left join employees e on e.company_id = v_co and e.nik_telkom = s.nik
  where s.company_id = v_co
  on conflict (company_id, sumber_baris) where sumber_baris is not null do update set
    employee_id = excluded.employee_id, object_id = excluded.object_id,
    position_name = excluded.position_name, position_title = excluded.position_title,
    branch_id = excluded.branch_id, psa = excluded.psa, portofolio = excluded.portofolio,
    group_fungsi = excluded.group_fungsi, sub_group = excluded.sub_group,
    nama_program = excluded.nama_program, gaji_per_teknisi = excluded.gaji_per_teknisi,
    sto = excluded.sto, sto_kode = excluded.sto_kode,
    sektor_ditangani = excluded.sektor_ditangani, status_penugasan = excluded.status_penugasan,
    updated_at = now();
  get diagnostics n = row_count; langkah := 'formasi (insert/update)'; jumlah := n; return next;

  insert into sto_ref (company_id, kode, nama, psa)
  select v_co, t.sto_kode, min(t.sto), min(t.psa)
  from (select distinct sto, sto_kode, psa from stg_wfp
        where company_id = v_co and sto is not null and sto_kode is not null) t
  group by t.sto_kode having count(distinct t.sto) = 1
  on conflict do nothing;
  get diagnostics n = row_count; langkah := 'sto_ref konsisten'; jumlah := n; return next;

  langkah := 'total formasi'; select count(*) into jumlah from employee_positions where company_id=v_co; return next;
  langkah := 'formasi kosong'; select count(*) into jumlah from employee_positions where company_id=v_co and employee_id is null; return next;
  langkah := 'karyawan total'; select count(*) into jumlah from employees where company_id=v_co and nik_telkom is not null; return next;
  langkah := 'orang dengan >1 posisi';
    select count(*) into jumlah from (select employee_id from employee_positions
      where company_id=v_co and employee_id is not null group by employee_id having count(*)>1) z; return next;
end $fn$;
