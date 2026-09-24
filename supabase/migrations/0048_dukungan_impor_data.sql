-- 0048_dukungan_impor_data.sql
-- Dukungan basis data untuk "Pusat Impor" di panel admin.
--
-- Tujuan: staf HR (dan peran lain yang berwenang) dapat mengunggah CSV/Excel
-- lewat aplikasi tanpa perlu menyentuh Supabase secara langsung.
--
-- Isi:
--   BAGIAN 1 - Tabel singgah (stg_*) dibuat sadar-perusahaan + RLS dibuka
--              untuk pemegang can_write_master('HR').
--   BAGIAN 2 - RPC impor diberi p_company_id, penjagaan hak akses internal,
--              dan grant execute ke authenticated.
--   BAGIAN 3 - Referensi dataset impor (impor_dataset_ref).
--   BAGIAN 4 - Jejak audit impor (impor_log) + fn_catat_impor().
--   BAGIAN 5 - Verifikasi kunci alami tabel master (tanpa menghapus data).


-- ===========================================================================
-- BAGIAN 1 - TABEL SINGGAH SADAR-PERUSAHAAN
-- ===========================================================================
-- Sebelumnya stg_wfp/stg_kamus/stg_blob sama sekali tidak punya company_id dan
-- hanya bisa diakses is_super(). Begitu tabel ini dibuka untuk staf HR, tanpa
-- company_id staf HR perusahaan B bisa membaca dan menghapus data impor yang
-- sedang berjalan milik perusahaan A. Karena itu company_id ditambahkan dan
-- dimasukkan ke dalam primary key: dua perusahaan boleh mengimpor bersamaan
-- tanpa saling menimpa.

alter table stg_wfp   add column if not exists company_id uuid;
alter table stg_kamus add column if not exists company_id uuid;
alter table stg_blob  add column if not exists company_id uuid;

-- Isi data lama dengan perusahaan tertua (data singgah warisan impor Sumbagteng).
update stg_wfp   set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update stg_kamus set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update stg_blob  set company_id = (select id from companies order by created_at limit 1) where company_id is null;

alter table stg_wfp
  alter column company_id set not null,
  alter column company_id set default auth_company_id();
alter table stg_kamus
  alter column company_id set not null,
  alter column company_id set default auth_company_id();
alter table stg_blob
  alter column company_id set not null,
  alter column company_id set default auth_company_id();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stg_wfp_company_id_fkey') then
    alter table stg_wfp add constraint stg_wfp_company_id_fkey
      foreign key (company_id) references companies(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stg_kamus_company_id_fkey') then
    alter table stg_kamus add constraint stg_kamus_company_id_fkey
      foreign key (company_id) references companies(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stg_blob_company_id_fkey') then
    alter table stg_blob add constraint stg_blob_company_id_fkey
      foreign key (company_id) references companies(id) on delete cascade;
  end if;
end $$;

-- Primary key diperluas dengan company_id.
alter table stg_wfp   drop constraint if exists stg_wfp_pkey;
alter table stg_kamus drop constraint if exists stg_kamus_pkey;
alter table stg_blob  drop constraint if exists stg_blob_pkey;

alter table stg_wfp   add constraint stg_wfp_pkey   primary key (company_id, baris);
alter table stg_kamus add constraint stg_kamus_pkey primary key (company_id, kolom, kode);
alter table stg_blob  add constraint stg_blob_pkey  primary key (company_id, bagian, urut);

-- --- RLS ------------------------------------------------------------------
-- Kebijakan lama hanya is_super() sehingga staf HR tidak bisa mengimpor.
drop policy if exists stg_wfp_super   on stg_wfp;
drop policy if exists stg_kamus_super on stg_kamus;
drop policy if exists stg_blob_super  on stg_blob;

drop policy if exists stg_wfp_impor_hr   on stg_wfp;
drop policy if exists stg_kamus_impor_hr on stg_kamus;
drop policy if exists stg_blob_impor_hr  on stg_blob;

-- can_write_master('HR') dipakai, BUKAN can_write('HR'):
-- peran lapangan (teknisi, mitra) justru memiliki can_write('HR') = true pada
-- basis data ini, sehingga can_write saja akan membuka impor master karyawan
-- untuk teknisi. can_write_master = can_write AND NOT is_peran_lapangan().
create policy stg_wfp_impor_hr on stg_wfp for all
  using      (is_super() or (company_id = auth_company_id() and can_write_master('HR')))
  with check (is_super() or (company_id = auth_company_id() and can_write_master('HR')));

create policy stg_kamus_impor_hr on stg_kamus for all
  using      (is_super() or (company_id = auth_company_id() and can_write_master('HR')))
  with check (is_super() or (company_id = auth_company_id() and can_write_master('HR')));

-- stg_blob SENGAJA dibuka setara stg_wfp, tidak dibiarkan super-only.
-- Alasan: stg_blob adalah tempat berkas mentah didaratkan sebelum
-- fn_bongkar_wfp memecahnya menjadi stg_wfp. Bila stg_blob tetap super-only,
-- alur "unggah -> bongkar -> muat" putus di langkah pertama dan Pusat Impor
-- tidak bisa dipakai staf HR sama sekali. Isinya pun bukan data yang lebih
-- sensitif daripada stg_wfp - persis data yang sama, hanya belum diurai -
-- sehingga menguncinya sementara stg_wfp terbuka hanya akan jadi penghalang
-- semu tanpa tambahan keamanan nyata.
create policy stg_blob_impor_hr on stg_blob for all
  using      (is_super() or (company_id = auth_company_id() and can_write_master('HR')))
  with check (is_super() or (company_id = auth_company_id() and can_write_master('HR')));

-- Hak tabel untuk anon adalah sisa warisan; RLS memang sudah menutupnya,
-- tetapi tidak ada alasan anon memegang grant atas tabel singgah.
revoke all on stg_wfp, stg_kamus, stg_blob from anon;
grant select, insert, update, delete on stg_wfp, stg_kamus, stg_blob to authenticated;
-- TRUNCATE MENEMBUS RLS. Tidak ada policy yang bisa membendungnya dan aplikasi
-- tidak pernah membutuhkannya, jadi hak itu dicabut dari authenticated.
revoke truncate on stg_wfp, stg_kamus, stg_blob from authenticated;

-- ===========================================================================
-- BAGIAN 2 - RPC IMPOR: PENJAGAAN INTERNAL + SCOPE PERUSAHAAN
-- ===========================================================================
-- Ketiga fungsi ini SECURITY DEFINER. Memberi grant execute ke authenticated
-- tanpa penjagaan di dalam badan fungsi berarti siapa pun yang berhasil login
-- - termasuk teknisi - bisa menulis ulang master karyawan. Karena itu setiap
-- fungsi memeriksa can_write_master('HR') sendiri dan menolak dengan 42501.
--
-- Selain itu `select id from companies order by created_at limit 1` diganti
-- p_company_id default auth_company_id(). Pola lama adalah bug multi-tenant:
-- impor dari perusahaan mana pun selalu menulis ke perusahaan pertama.

create or replace function fn_jaga_impor_hr(p_company_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not can_write_master('HR') then
    raise exception 'Akses ditolak: impor data karyawan memerlukan hak tulis master modul HR.'
      using errcode = '42501';
  end if;

  if p_company_id is null then
    raise exception 'Perusahaan tidak diketahui: profil pemanggil tidak punya company_id dan p_company_id tidak diisi.'
      using errcode = '22023';
  end if;

  -- Tanpa pemeriksaan ini, pemegang hak HR di perusahaan A bisa mengoper
  -- p_company_id milik perusahaan B dan menulis ke sana.
  if not is_super() and p_company_id is distinct from auth_company_id() then
    raise exception 'Akses ditolak: tidak boleh mengimpor untuk perusahaan lain.'
      using errcode = '42501';
  end if;

  return p_company_id;
end $$;

revoke execute on function fn_jaga_impor_hr(uuid) from public, anon;
grant execute on function fn_jaga_impor_hr(uuid) to authenticated;

-- --- fn_bongkar_wfp -------------------------------------------------------
drop function if exists fn_bongkar_wfp();

create or replace function fn_bongkar_wfp(p_company_id uuid default auth_company_id())
returns table(kamus_baris bigint, data_baris bigint, md5_kamus text, md5_data text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_co uuid; v_kamus text; v_data text; r text; f text[]; i int; c text; k int;
begin
  v_co := fn_jaga_impor_hr(p_company_id);

  select string_agg(isi, chr(10) order by urut) into v_kamus
    from stg_blob where bagian = 'kamus' and company_id = v_co;
  select string_agg(isi, chr(10) order by urut) into v_data
    from stg_blob where bagian = 'data'  and company_id = v_co;

  delete from stg_kamus where company_id = v_co;
  delete from stg_wfp   where company_id = v_co;

  foreach r in array coalesce(string_to_array(v_kamus, chr(10)), array[]::text[]) loop
    if r is null or r = '' then continue; end if;
    f := string_to_array(r, '^'); c := f[1];
    for i in 2 .. array_length(f, 1) loop
      insert into stg_kamus(company_id, kolom, kode, nilai) values (v_co, c, i - 1, f[i])
      on conflict do nothing;
    end loop;
  end loop;

  k := 0;
  foreach r in array coalesce(string_to_array(v_data, chr(10)), array[]::text[]) loop
    if r is null or r = '' then continue; end if;
    k := k + 1; f := string_to_array(r, '^');
    insert into stg_wfp(company_id, baris, object_id, nik, nama, gaji,
      position_name, position_title, kemitraan, branch, level_jabatan, group_wfp, sub_group,
      group_fungsi, psa, portofolio, status_teknisi, status_salary, nama_program, sto, sto_kode,
      status_penugasan, skill, sektor_ditangani)
    values (v_co, k, nullif(f[1],''), nullif(f[2],''), nullif(f[3],''), nullif(f[4],'')::numeric,
      (select nilai from stg_kamus where company_id=v_co and kolom='position_name'    and kode = nullif(f[5],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='position_title'   and kode = nullif(f[6],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='kemitraan'        and kode = nullif(f[7],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='branch'           and kode = nullif(f[8],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='level'            and kode = nullif(f[9],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='group_wfp'        and kode = nullif(f[10],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='sub_group'        and kode = nullif(f[11],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='group_fungsi'     and kode = nullif(f[12],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='psa'              and kode = nullif(f[13],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='portofolio'       and kode = nullif(f[14],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='status_teknisi'   and kode = nullif(f[15],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='status_salary'    and kode = nullif(f[16],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='nama_program'     and kode = nullif(f[17],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='sto'              and kode = nullif(f[18],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='sto_kode'         and kode = nullif(f[19],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='status_penugasan' and kode = nullif(f[20],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='skill'            and kode = nullif(f[21],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='sektor_ditangani' and kode = nullif(f[22],'')::int));
  end loop;

  return query select
    (select count(*) from stg_kamus where company_id = v_co),
    (select count(*) from stg_wfp   where company_id = v_co),
    md5(coalesce(v_kamus, '')), md5(coalesce(v_data, ''));
end $$;

revoke execute on function fn_bongkar_wfp(uuid) from public, anon;
grant execute on function fn_bongkar_wfp(uuid) to authenticated;

-- --- fn_muat_karyawan_wfp -------------------------------------------------
drop function if exists fn_muat_karyawan_wfp();

create or replace function fn_muat_karyawan_wfp(p_company_id uuid default auth_company_id())
returns table(langkah text, jumlah bigint)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_co uuid; n bigint;
begin
  v_co := fn_jaga_impor_hr(p_company_id);

  -- 1. Cabang: pastikan kelima cabang ada, cocokkan lewat kata kunci kota.
  insert into branches (company_id, code, name, city, is_active)
  select v_co, k.kode, 'Cabang '||initcap(k.kota), initcap(k.kota), true
  from (values ('BTM','batam'),('BKT','bukittinggi'),('DUM','dumai'),('PDG','padang'),('PBR','pekanbaru')) k(kode,kota)
  where not exists (select 1 from branches b where b.company_id=v_co and b.name ilike '%'||k.kota||'%');

  -- 2. Karyawan: satu baris per NIK. Kolom identitas pribadi (KTP, NPWP, bank,
  --    BPJS, tanggal lahir, PTKP) sengaja dibiarkan kosong -> jadi antrean HR.
  insert into employees (company_id, nip, nik_telkom, full_name, branch_id, position, unit,
                         employment_type, status, join_date, level_jabatan, kemitraan,
                         group_wfp, status_teknisi, status_salary, skill, payroll_scheme)
  select v_co,
         s.nik,
         s.nik,
         max(s.nama),
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
         'aktif',
         current_date,
         max(s.level_jabatan),
         -- Kolom-kolom di bawah ini punya CHECK constraint. Nilai WFP yang di luar
         -- daftar sah DIKOSONGKAN, bukan dibiarkan menggagalkan seluruh impor:
         -- satu sel kotor tidak boleh membatalkan ribuan baris. Sel yang
         -- dikosongkan tetap terjaring sebagai antrean pelengkapan data HR.
         case when max(s.kemitraan) in ('TELKOM AKSES','MITRA','RIFO FIX','RIFO VARIABLE')
              then max(s.kemitraan) else null end,
         case when max(s.group_wfp) in ('RKAP','MITRA','RIFO','NFO')
              then max(s.group_wfp) else null end,
         case when max(s.status_teknisi) in ('PERFORMANCE BASED','RESOURCE BASED')
              then max(s.status_teknisi) else null end,
         case when max(s.status_salary) in ('FIXED','VARIABLE')
              then max(s.status_salary) else null end,
         case when max(s.skill) is null then null else string_to_array(max(s.skill), ' | ') end,
         -- payroll_scheme NOT NULL: NULL eksplisit mengalahkan default kolom dan
         -- membuat seluruh impor gagal bila STATUS SALARY kosong. Jatuh balik ke
         -- 'fix_salary', sama dengan default kolomnya.
         coalesce(case max(s.status_salary) when 'FIXED' then 'fix_salary'
                                            when 'VARIABLE' then 'freelance' else null end,
                  'fix_salary')
  from stg_wfp s
  where s.company_id = v_co and s.nik is not null and s.nama is not null
  group by s.nik
  on conflict (company_id, nip) do update set
    nik_telkom = excluded.nik_telkom,
    full_name = excluded.full_name,
    branch_id = excluded.branch_id,
    position = excluded.position,
    unit = excluded.unit,
    employment_type = excluded.employment_type,
    level_jabatan = excluded.level_jabatan,
    kemitraan = excluded.kemitraan,
    group_wfp = excluded.group_wfp,
    status_teknisi = excluded.status_teknisi,
    status_salary = excluded.status_salary,
    skill = excluded.skill,
    payroll_scheme = excluded.payroll_scheme,
    updated_at = now();
  get diagnostics n = row_count; langkah := 'karyawan (insert/update)'; jumlah := n; return next;

  -- 3. Formasi: satu baris per baris WFP, termasuk formasi kosong.
  insert into employee_positions (company_id, employee_id, object_id, position_name, position_title,
      branch_id, psa, portofolio, group_fungsi, sub_group, nama_program, gaji_per_teknisi,
      sto, sto_kode, sektor_ditangani, status_penugasan, aktif, berlaku_mulai)
  select v_co,
         e.id,
         -- object_id punya CHECK format (17 digit, atau MTR-9999). Fallback lama
         -- 'BARIS-<n>' TIDAK PERNAH memenuhi format itu, sehingga setiap baris WFP
         -- tanpa OBJECT ID membatalkan seluruh impor. Nilai tak sah -> NULL.
         case when s.object_id ~ '^[0-9]{17}$' or s.object_id ~ '^MTR-[0-9]{4}$'
              then s.object_id else null end,
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
  on conflict do nothing;
  get diagnostics n = row_count; langkah := 'formasi (employee_positions)'; jumlah := n; return next;

  -- 4. Referensi STO: hanya pasangan kode-nama yang KONSISTEN.
  insert into sto_ref (company_id, kode, nama, psa)
  select v_co, t.sto_kode, min(t.sto), min(t.psa)
  from (select distinct sto, sto_kode, psa from stg_wfp
        where company_id = v_co and sto is not null and sto_kode is not null) t
  group by t.sto_kode
  having count(distinct t.sto) = 1
  on conflict do nothing;
  get diagnostics n = row_count; langkah := 'sto_ref konsisten'; jumlah := n; return next;

  langkah := 'total formasi';
    select count(*) into jumlah from employee_positions where company_id = v_co; return next;
  langkah := 'formasi kosong';
    select count(*) into jumlah from employee_positions where company_id = v_co and employee_id is null; return next;
  langkah := 'karyawan total';
    select count(*) into jumlah from employees where company_id = v_co and nik_telkom is not null; return next;
  langkah := 'orang dengan >1 posisi';
    select count(*) into jumlah from (
      select employee_id from employee_positions
      where company_id = v_co and employee_id is not null
      group by employee_id having count(*) > 1) z; return next;
end $$;

revoke execute on function fn_muat_karyawan_wfp(uuid) from public, anon;
grant execute on function fn_muat_karyawan_wfp(uuid) to authenticated;

-- --- fn_inbox_konflik_wfp -------------------------------------------------
drop function if exists fn_inbox_konflik_wfp();

create or replace function fn_inbox_konflik_wfp(p_company_id uuid default auth_company_id())
returns table(jenis_konflik text, jumlah bigint)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_co uuid; n bigint;
begin
  v_co := fn_jaga_impor_hr(p_company_id);

  -- a. Satu NIK dipakai dua nama berbeda -> pasti salah input, wajib manusia.
  insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan, route_path,
       pic_role, eskalasi_role, jatuh_tempo, prioritas, status, sumber, kunci_unik)
  select v_co, 'HR', 'tugas_manual', 'employees',
         'NIK ganda dengan nama berbeda: '||t.nik,
         'NIK '||t.nik||' dipakai oleh nama yang berbeda: '||t.nama_list||
         '. Sistem tidak menebak mana yang benar. Tentukan NIK yang sah, perbaiki di sumber WFP, lalu muat ulang.',
         '/hr/karyawan', 'staff_hr', 'manager_hr', current_date + 7, 'tinggi', 'terbuka', 'manual',
         'konflik_nik_'||t.nik
  from (select nik, string_agg(distinct nama, ' | ') nama_list
        from stg_wfp where company_id = v_co and nik is not null and nama is not null
        group by nik having count(distinct nama) > 1) t
  on conflict (company_id, kunci_unik) do nothing;
  get diagnostics n = row_count; jenis_konflik := 'NIK ganda beda nama'; jumlah := n; return next;

  -- b. Kode STO menunjuk lebih dari satu nama STO.
  insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan, route_path,
       pic_role, eskalasi_role, jatuh_tempo, prioritas, status, sumber, kunci_unik)
  select v_co, 'OPERATIONS', 'tugas_manual', 'sto_ref',
         'Kode STO '||t.kode||' menunjuk '||t.n||' nama berbeda',
         'Kode '||t.kode||' dipakai untuk: '||t.nama_list||
         '. Referensi STO tidak dimuat untuk kode ini sampai dipastikan. Tentukan pasangan kode-nama yang benar.',
         '/ops/elemen', 'spv_operations', 'manager_operations', current_date + 14, 'sedang', 'terbuka', 'manual',
         'konflik_sto_'||t.kode
  from (select sto_kode kode, count(distinct sto) n, string_agg(distinct sto, ' | ') nama_list
        from stg_wfp where company_id = v_co and sto is not null and sto_kode is not null
        group by sto_kode having count(distinct sto) > 1) t
  on conflict (company_id, kunci_unik) do nothing;
  get diagnostics n = row_count; jenis_konflik := 'kode STO bertabrakan'; jumlah := n; return next;

  -- c. Formasi kosong per cabang (satu tugas per cabang, bukan per kursi).
  insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan, route_path,
       pic_role, eskalasi_role, branch_id, jatuh_tempo, prioritas, status, sumber, kunci_unik)
  select v_co, 'HR', 'tugas_manual', 'employee_positions',
         'Formasi kosong '||t.branch||': '||t.n||' kursi',
         'Ada '||t.n||' formasi tanpa karyawan di '||t.branch||
         '. Perlu diisi lewat rekrutmen atau mutasi, atau dinonaktifkan bila formasinya memang dihapus.',
         '/hr/karyawan', 'staff_hr', 'manager_hr',
         (select b.id from branches b where b.company_id=v_co and b.name ilike '%'||replace(t.branch,'BRANCH ','')||'%' limit 1),
         current_date + 30, 'sedang', 'terbuka', 'manual',
         'formasi_kosong_'||t.branch
  from (select branch, count(*) n from stg_wfp
        where company_id = v_co and nik is null and nama is null group by branch) t
  on conflict (company_id, kunci_unik) do nothing;
  get diagnostics n = row_count; jenis_konflik := 'formasi kosong per cabang'; jumlah := n; return next;

  -- d. Nilai group_wfp yang tidak sah (kolom kemitraan bocor ke kolom group).
  insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan, route_path,
       pic_role, eskalasi_role, jatuh_tempo, prioritas, status, sumber, kunci_unik)
  select v_co, 'HR', 'tugas_manual', 'employees',
         'Nilai GROUP tidak sah pada '||coalesce(s.nama,'formasi '||s.object_id),
         'Baris WFP ke-'||s.baris||' memiliki GROUP = '||s.group_wfp||
         ', padahal nilai yang sah hanya RKAP, MITRA, RIFO, NFO. Nilai itu tampak berasal dari kolom KEMITRAAN. Kolom dikosongkan sampai dibetulkan.',
         '/hr/karyawan', 'staff_hr', 'manager_hr', current_date + 7, 'sedang', 'terbuka', 'manual',
         'group_wfp_salah_'||s.baris
  from stg_wfp s where s.company_id = v_co and s.group_wfp = 'TELKOM AKSES'
  on conflict (company_id, kunci_unik) do nothing;
  get diagnostics n = row_count; jenis_konflik := 'GROUP tidak sah'; jumlah := n; return next;

  -- e. Ejaan sub_group yang kembar (OPERATION/Operation, MIGRASI/MIGRATION).
  insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan, route_path,
       pic_role, eskalasi_role, jatuh_tempo, prioritas, status, sumber, kunci_unik)
  select v_co, 'HR', 'tugas_manual', 'employee_positions',
    'Ejaan SUB GROUP kembar di data WFP',
    'Ditemukan pasangan ejaan yang merujuk hal sama: OPERATION vs Operation, dan PROVISIONING & MIGRASI vs PROVISIONING & MIGRATION. Samakan di sumber WFP agar laporan per sub group tidak terpecah.',
    '/hr/karyawan', 'staff_hr', 'manager_hr', current_date + 14, 'rendah', 'terbuka', 'manual',
    'ejaan_sub_group_kembar'
  where exists (
    select 1 from stg_wfp where company_id = v_co
      and sub_group in ('OPERATION','Operation','PROVISIONING & MIGRASI','PROVISIONING & MIGRATION'))
  on conflict (company_id, kunci_unik) do nothing;
  get diagnostics n = row_count; jenis_konflik := 'ejaan sub group kembar'; jumlah := n; return next;
end $$;

revoke execute on function fn_inbox_konflik_wfp(uuid) from public, anon;
grant execute on function fn_inbox_konflik_wfp(uuid) to authenticated;

-- ===========================================================================
-- BAGIAN 3 - REFERENSI DATASET IMPOR
-- ===========================================================================
-- Pemetaan dataset -> modul dibuat sebagai tabel referensi, bukan kolom bebas
-- di impor_log. Alasannya: RLS impor_log harus menentukan "hak baca modul
-- dataset tersebut". Kalau modul disimpan sebagai kolom yang diisi pemanggil,
-- pemanggil bisa menuliskan modul palsu agar barisnya tersembunyi dari
-- pengawas modul yang sebenarnya. Dengan tabel referensi, pemetaan bersifat
-- otoritatif. Tabel ini juga menjadi daftar dataset yang bisa ditampilkan
-- Pusat Impor di UI.

create table if not exists impor_dataset_ref (
  kode        text primary key,
  nama        text not null,
  modul       text not null references modules(code),
  tabel_tujuan text,
  keterangan  text,
  aktif       boolean not null default true,
  urut        int not null default 100
);

insert into impor_dataset_ref (kode, nama, modul, tabel_tujuan, keterangan, urut) values
  ('karyawan_wfp',     'Karyawan & Formasi (WFP)',   'HR',          'employees',         'Unggahan WFP: mengisi employees, employee_positions, sto_ref, branches.', 10),
  ('employees',        'Karyawan',                   'HR',          'employees',         'Impor langsung master karyawan.',       20),
  ('shifts',           'Shift Kerja',                'HR',          'shifts',            null, 30),
  ('competencies',     'Kompetensi',                 'HR',          'competencies',      null, 40),
  ('salary_components','Komponen Gaji',              'PAYROLL',     'salary_components', null, 50),
  ('customers',        'Pelanggan',                  'COMMERCE',    'customers',         null, 60),
  ('vendors',          'Vendor / Mitra',             'PROCUREMENT', 'vendors',           null, 70),
  ('item_catalog',     'Katalog Material',           'INVENTORY',   'item_catalog',      null, 80),
  ('warehouses',       'Gudang',                     'INVENTORY',   'warehouses',        null, 90),
  ('assets',           'Aset',                       'ASSET',       'assets',            null, 100),
  ('chart_of_accounts','Bagan Akun (COA)',           'FINANCE',     'chart_of_accounts', null, 110),
  ('job_types',        'Jenis Pekerjaan',            'OPERATIONS',  'job_types',         null, 120),
  ('root_causes',      'Akar Masalah (RCA)',         'OPERATIONS',  'root_causes',       null, 130),
  ('network_elements', 'Elemen Jaringan',            'OPERATIONS',  'network_elements',  null, 140),
  ('sto_ref',          'Referensi STO',              'OPERATIONS',  'sto_ref',           null, 150),
  ('branches',         'Cabang',                     'CORE',        'branches',          null, 160),
  ('master_references','Referensi Master Umum',      'CORE',        'master_references', null, 170)
on conflict (kode) do update set
  nama = excluded.nama, modul = excluded.modul,
  tabel_tujuan = excluded.tabel_tujuan, urut = excluded.urut;

alter table impor_dataset_ref enable row level security;

-- Metadata non-sensitif: semua pengguna yang login boleh membacanya, supaya
-- subquery di RLS impor_log tidak ikut terpangkas dan UI bisa menampilkan
-- daftar dataset. Penulisan hanya super_admin.
drop policy if exists impor_dataset_ref_baca on impor_dataset_ref;
create policy impor_dataset_ref_baca on impor_dataset_ref for select using (true);

drop policy if exists impor_dataset_ref_kelola on impor_dataset_ref;
create policy impor_dataset_ref_kelola on impor_dataset_ref for all
  using (is_super()) with check (is_super());

revoke all on impor_dataset_ref from anon;
grant select on impor_dataset_ref to authenticated;
-- INSERT/UPDATE/DELETE sengaja TIDAK dicabut: di Supabase super_admin pun
-- memakai peran basis data `authenticated`, sehingga pencabutan akan mematikan
-- policy impor_dataset_ref_kelola. Hanya TRUNCATE yang dicabut.
revoke truncate on impor_dataset_ref from authenticated;

-- ===========================================================================
-- BAGIAN 4 - JEJAK AUDIT IMPOR
-- ===========================================================================

create table if not exists impor_log (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  dataset          text not null references impor_dataset_ref(kode),
  nama_berkas      text,
  jumlah_baris     integer not null default 0 check (jumlah_baris     >= 0),
  jumlah_berhasil  integer not null default 0 check (jumlah_berhasil  >= 0),
  jumlah_gagal     integer not null default 0 check (jumlah_gagal     >= 0),
  jumlah_dilewati  integer not null default 0 check (jumlah_dilewati  >= 0),
  catatan          jsonb   not null default '{}'::jsonb,
  -- on delete set null, bukan cascade: baris audit harus bertahan walaupun
  -- akun pelakunya kelak dihapus.
  dijalankan_oleh  uuid references profiles(id) on delete set null,
  dijalankan_at    timestamptz not null default now(),
  durasi_ms        integer check (durasi_ms >= 0)
);

create index if not exists idx_impor_log_company_waktu
  on impor_log (company_id, dijalankan_at desc);
create index if not exists idx_impor_log_company_dataset_waktu
  on impor_log (company_id, dataset, dijalankan_at desc);
create index if not exists idx_impor_log_pelaku
  on impor_log (dijalankan_oleh);
-- Untuk menyaring impor yang bermasalah tanpa memindai seluruh tabel.
create index if not exists idx_impor_log_gagal
  on impor_log (company_id, dijalankan_at desc) where jumlah_gagal > 0;

alter table impor_log enable row level security;

-- BACA: pemilik hak baca modul dari dataset yang bersangkutan, atau super.
drop policy if exists impor_log_baca on impor_log;
create policy impor_log_baca on impor_log for select using (
  is_super() or (
    company_id = auth_company_id()
    and can_read((select r.modul from impor_dataset_ref r where r.kode = impor_log.dataset))
  )
);

-- TULIS: hanya untuk diri sendiri, di perusahaan sendiri, dan hanya pada modul
-- yang memang boleh ditulis oleh peran pemanggil.
drop policy if exists impor_log_tulis on impor_log;
create policy impor_log_tulis on impor_log for insert with check (
  dijalankan_oleh = auth.uid()
  and (
    is_super() or (
      company_id = auth_company_id()
      and can_write_master((select r.modul from impor_dataset_ref r where r.kode = impor_log.dataset))
    )
  )
);

-- Sengaja TIDAK ada policy UPDATE/DELETE: jejak audit bersifat append-only.
-- Koreksi dilakukan dengan menambah baris baru, bukan menyunting yang lama.

revoke all on impor_log from anon;
grant select, insert on impor_log to authenticated;
-- Append-only ditegakkan juga di lapis hak akses, bukan hanya lewat ketiadaan
-- policy: UPDATE/DELETE dicabut, dan TRUNCATE dicabut karena menembus RLS.
revoke update, delete, truncate on impor_log from authenticated;

-- --- fn_catat_impor -------------------------------------------------------
-- SECURITY INVOKER (bukan DEFINER): dengan begitu RLS impor_log di atas yang
-- menjadi penjaga sesungguhnya, dan fungsi ini tidak bisa dipakai untuk
-- menembus batas perusahaan. Penjagaan eksplisit di bawah hanya untuk memberi
-- pesan galat yang jelas dalam Bahasa Indonesia.
create or replace function fn_catat_impor(
  p_dataset         text,
  p_nama_berkas     text    default null,
  p_jumlah_baris    integer default 0,
  p_jumlah_berhasil integer default 0,
  p_jumlah_gagal    integer default 0,
  p_jumlah_dilewati integer default 0,
  p_catatan         jsonb   default '{}'::jsonb,
  p_durasi_ms       integer default null,
  p_company_id      uuid    default auth_company_id()
) returns uuid
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare v_modul text; v_id uuid;
begin
  select r.modul into v_modul from impor_dataset_ref r where r.kode = p_dataset and r.aktif;
  if v_modul is null then
    raise exception 'Dataset impor tidak dikenal atau tidak aktif: %', p_dataset
      using errcode = '22023';
  end if;

  if auth.uid() is null then
    raise exception 'Akses ditolak: pencatatan impor memerlukan sesi pengguna.'
      using errcode = '42501';
  end if;

  if not (is_super() or (p_company_id = auth_company_id() and can_write_master(v_modul))) then
    raise exception 'Akses ditolak: tidak punya hak tulis modul % untuk mencatat impor.', v_modul
      using errcode = '42501';
  end if;

  insert into impor_log (company_id, dataset, nama_berkas, jumlah_baris, jumlah_berhasil,
                         jumlah_gagal, jumlah_dilewati, catatan, dijalankan_oleh, durasi_ms)
  values (p_company_id, p_dataset, p_nama_berkas, coalesce(p_jumlah_baris,0),
          coalesce(p_jumlah_berhasil,0), coalesce(p_jumlah_gagal,0),
          coalesce(p_jumlah_dilewati,0), coalesce(p_catatan,'{}'::jsonb),
          auth.uid(), p_durasi_ms)
  returning id into v_id;

  return v_id;
end $$;

revoke execute on function fn_catat_impor(text,text,integer,integer,integer,integer,jsonb,integer,uuid) from public, anon;
grant execute on function fn_catat_impor(text,text,integer,integer,integer,integer,jsonb,integer,uuid) to authenticated;

-- ===========================================================================
-- BAGIAN 5 - KEAMANAN KUNCI ALAMI TABEL MASTER
-- ===========================================================================
-- Supaya impor ulang tidak menggandakan data, setiap tabel master butuh unique
-- constraint per perusahaan atas kunci alaminya.
--
-- PENTING: indeks TIDAK dibuat membabi buta. `create unique index if not
-- exists <nama_baru>` hanya memeriksa NAMA, bukan kolom - kalau indeks yang
-- setara sudah ada dengan nama lain (mis. customers_company_id_code_key), pola
-- itu justru membuat indeks kembar. Blok di bawah memeriksa keberadaan indeks
-- unik yang MENCAKUP kolom yang dimaksud, lalu hanya membuat yang benar-benar
-- belum ada. Bila pembuatan gagal karena data sudah terlanjur ganda, data
-- TIDAK dihapus: jumlah duplikat dilaporkan dan sebuah tugas dibuat di
-- inbox_tugas agar dibereskan manusia.

do $$
declare
  t record;
  v_sudah_ada boolean;
  v_dup bigint;
  v_co uuid;
  v_nama_idx text;
  v_kolom_list text;
begin
  select id into v_co from companies order by created_at limit 1;

  for t in
    select * from (values
      ('customers',         'code',         'COMMERCE',    'staff_commerce',    'manager_commerce'),
      ('vendors',           'code',         'PROCUREMENT', 'staff_procurement', 'manager_procurement'),
      ('item_catalog',      'code',         'INVENTORY',   'staff_inventory',   'manager_inventory'),
      ('warehouses',        'code',         'INVENTORY',   'staff_inventory',   'manager_inventory'),
      ('job_types',         'code',         'OPERATIONS',  'spv_operations',    'manager_operations'),
      ('salary_components', 'code',         'PAYROLL',     'staff_hr',          'manager_hr'),
      ('chart_of_accounts', 'account_code', 'FINANCE',     'staff_finance',     'manager_finance'),
      ('shifts',            'code',         'HR',          'staff_hr',          'manager_hr'),
      ('competencies',      'code',         'HR',          'staff_hr',          'manager_hr'),
      ('root_causes',       'code',         'OPERATIONS',  'spv_operations',    'manager_operations'),
      ('network_elements',  'code',         'OPERATIONS',  'spv_operations',    'manager_operations'),
      ('branches',          'code',         'CORE',        'staff_hr',          'manager_hr'),
      ('sto_ref',           'kode',         'OPERATIONS',  'spv_operations',    'manager_operations'),
      ('master_references', 'ref_group,code','CORE',       'staff_hr',          'manager_hr'),
      ('assets',            'asset_no',     'ASSET',       'staff_inventory',   'manager_inventory')
    ) as x(tabel, kolom, modul, pic, eskalasi)
  loop
    -- Lewati tabel yang tidak ada di basis data ini.
    if not exists (select 1 from information_schema.tables
                   where table_schema='public' and table_name=t.tabel) then
      raise notice 'Tabel % tidak ada, dilewati.', t.tabel;
      continue;
    end if;

    v_kolom_list := 'company_id,' || t.kolom;

    -- Apakah sudah ada indeks unik yang tepat mencakup (company_id, <kolom>)?
    select exists (
      select 1
      from pg_index ix
      join pg_class c on c.oid = ix.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t.tabel and ix.indisunique
        and (
          select string_agg(a.attname, ',' order by k.ord)
          from unnest(ix.indkey::smallint[]) with ordinality as k(attnum, ord)
          join pg_attribute a on a.attrelid = ix.indrelid and a.attnum = k.attnum
        ) = v_kolom_list
    ) into v_sudah_ada;

    if v_sudah_ada then
      raise notice 'OK: % sudah punya unique index atas (%).', t.tabel, v_kolom_list;
      continue;
    end if;

    -- Hitung duplikat sebelum mencoba membuat indeks.
    execute format(
      'select count(*) from (select company_id, %s from %I group by company_id, %s having count(*) > 1) z',
      t.kolom, t.tabel, t.kolom) into v_dup;

    if v_dup > 0 then
      raise warning 'DUPLIKAT: % punya % kunci ganda atas (%). Indeks TIDAK dibuat, data TIDAK dihapus.',
        t.tabel, v_dup, v_kolom_list;

      insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan,
             pic_role, eskalasi_role, jatuh_tempo, prioritas, status, sumber, kunci_unik)
      values (v_co, t.modul, 'tugas_manual', t.tabel,
        'Kunci ganda di tabel ' || t.tabel || ': ' || v_dup || ' kelompok',
        'Tabel ' || t.tabel || ' memiliki ' || v_dup || ' kelompok baris dengan kunci alami (' ||
        v_kolom_list || ') yang sama, sehingga unique index tidak dapat dibuat dan impor ulang ' ||
        'berisiko menggandakan data. Data sengaja TIDAK dihapus otomatis. Tinjau baris kembar, ' ||
        'gabungkan atau perbaiki kodenya, lalu minta indeks dibuat ulang.',
        t.pic, t.eskalasi, current_date + 14, 'tinggi', 'terbuka', 'manual',
        'kunci_ganda_' || t.tabel)
      on conflict (company_id, kunci_unik) do nothing;
      continue;
    end if;

    v_nama_idx := 'uq_' || t.tabel || '_kunci_alami';
    execute format('create unique index if not exists %I on public.%I (company_id, %s)',
                   v_nama_idx, t.tabel, t.kolom);
    raise notice 'DIBUAT: % atas (%).', v_nama_idx, v_kolom_list;
  end loop;
end $$;


-- ===========================================================================
-- BAGIAN 6 - KEBERSIHAN SISA TABEL SINGGAH MIGRASI 0047
-- ===========================================================================
-- _kamus_teks dan _kamus_arr adalah tabel coretan sekali pakai dari migrasi
-- 0047. RLS-nya tidak pernah dinyalakan, sehingga keduanya terbaca oleh peran
-- `anon` lewat PostgREST - termasuk 25 nilai gaji yang ada di dalamnya.
-- Penelusuran repo menunjukkan keduanya HANYA dirujuk di dalam 0047 sendiri dan
-- tidak pernah dibaca aplikasi, jadi menyalakan RLS tanpa policy aman: isinya
-- tetap utuh (tidak ada data yang dihapus) tetapi tidak lagi terekspos.
-- Menghapus tabelnya sama sekali diserahkan ke keputusan manusia.
alter table if exists _kamus_teks enable row level security;
alter table if exists _kamus_arr  enable row level security;
revoke all on _kamus_teks, _kamus_arr from anon, authenticated;
