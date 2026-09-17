-- =====================================================================
-- 0038_sinkron_skema_repo_dengan_db.sql
-- =====================================================================
-- KENAPA FILE INI ADA
-- -------------------
-- Riwayat migrasi di basis data Supabase (tabel supabase_migrations.
-- schema_migrations) berisi beberapa migrasi yang TIDAK PERNAH ada
-- berkasnya di repositori ini. Akibatnya skema produksi tidak bisa
-- direproduksi hanya dengan menjalankan isi folder supabase/migrations
-- dari nol: hasilnya akan berbeda dengan basis data yang berjalan.
--
-- Berkas ini menutup selisih itu. Isinya adalah rekonstruksi objek
-- yang benar-benar ADA DI BASIS DATA SEKARANG (dibaca langsung dari
-- pg_proc, pg_trigger, pg_policies, information_schema, storage.buckets
-- pada 16 September 2026), BUKAN tebakan atau rancangan ulang.
--
-- Migrasi basis data yang diwakili berkas ini:
--   1. 0012_auth_bootstrap_and_storage      -> Bagian B & C
--   2. 0014_finance_ap_ar_access            -> Bagian D
--   3. 0028b_fix_work_permits_self_scope_perf -> Bagian E (penegasan ulang)
--   4. 0031_profiles_read_by_module         -> Bagian F
--   5. kesiapan_produksi_revoke_anon        -> Bagian G
--   6. kesiapan_performa_fix_ambiguous_column -> Bagian H (catatan saja)
-- Ditambah satu temuan di luar daftar itu:
--   7. kolom companies.is_demo yang hilang  -> Bagian A
--
-- SIFAT BERKAS: IDEMPOTEN. Aman dijalankan berulang kali, baik di atas
-- basis data yang sudah berisi objek-objek ini maupun di atas basis data
-- kosong yang baru saja menjalankan 0001..0037.
--
-- TIDAK ADA DATA AKUN DI SINI. Tidak ada baris auth.users, tidak ada kata
-- sandi, tidak ada kunci/token. Akun demo (super_admin@, teknisi@, dst.)
-- dibuat MANUAL lewat Supabase Auth (Dashboard / Admin API), bukan lewat
-- migrasi — lihat Bagian C untuk penjelasan lengkapnya.
-- =====================================================================


-- =====================================================================
-- BAGIAN A — kolom companies.is_demo
-- =====================================================================
-- PERINGATAN PENTING:
-- Kolom companies.is_demo ADA di basis data tapi TIDAK PERNAH dibuat oleh
-- satu pun berkas di repositori ini. Padahal kolom itu DIPAKAI oleh
-- 0035_kesiapan_produksi.sql, 0036_kesiapan_performa.sql dan
-- 0037_tambah_perusahaan.sql. Artinya: menjalankan folder migrasi ini
-- dari nol akan GAGAL di 0035, jauh sebelum sampai ke berkas 0038 ini.
--
-- Perintah di bawah membuat repo cocok dengan basis data, tapi TIDAK
-- memperbaiki urutannya. Perbaikan yang benar adalah memindahkan baris
-- ini ke 0001_core.sql (definisi tabel companies) atau ke bagian paling
-- atas 0035_kesiapan_produksi.sql. Keputusan itu sengaja TIDAK diambil
-- di sini karena mengubah berkas migrasi yang sudah tercatat di riwayat
-- basis data punya risiko tersendiri — silakan diputuskan oleh pemilik repo.
alter table public.companies
  add column if not exists is_demo boolean default false;

comment on column public.companies.is_demo is
  'Penanda bahwa perusahaan ini masih berisi data peragaan/contoh. Dipakai halaman Kesiapan Produksi (0035/0036) dan fn_tambah_perusahaan (0037).';


-- =====================================================================
-- BAGIAN B — handle_new_user() + pemicu on_auth_user_created
-- (dari migrasi basis data: 0012_auth_bootstrap_and_storage)
-- =====================================================================
-- Setiap pengguna baru di auth.users otomatis mendapat baris di
-- public.profiles. company_id, role, unit, branch_id dan employee_id
-- diambil dari raw_user_meta_data yang dikirim saat pembuatan akun; bila
-- company_id tidak dikirim, dipakai perusahaan pertama (mode satu tenant).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_company uuid;
  v_role    text;
begin
  v_company := nullif(new.raw_user_meta_data->>'company_id','')::uuid;
  v_role    := coalesce(nullif(new.raw_user_meta_data->>'role',''), 'viewer');

  -- Kalau company tidak dikirim, pakai company pertama (mode single-tenant awal)
  if v_company is null then
    select id into v_company from public.companies order by created_at limit 1;
  end if;

  insert into public.profiles (id, company_id, full_name, email, phone, role, unit, branch_id, employee_id, is_active)
  values (
    new.id,
    v_company,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)),
    new.email,
    nullif(new.raw_user_meta_data->>'phone',''),
    v_role,
    nullif(new.raw_user_meta_data->>'unit',''),
    nullif(new.raw_user_meta_data->>'branch_id','')::uuid,
    nullif(new.raw_user_meta_data->>'employee_id','')::uuid,
    true
  )
  on conflict (id) do nothing;

  -- Tautkan balik ke employee bila employee_id dikirim
  if nullif(new.raw_user_meta_data->>'employee_id','') is not null then
    update public.employees
       set user_id = new.id
     where id = (new.raw_user_meta_data->>'employee_id')::uuid;
  end if;

  return new;
end $function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =====================================================================
-- BAGIAN C — akun demo: SENGAJA TIDAK ADA DI MIGRASI
-- =====================================================================
-- Migrasi 0012_auth_bootstrap_and_storage di basis data juga menyiapkan
-- akun-akun peragaan (super_admin@, direktur@, manager_*@, staff_*@,
-- teknisi@, mitra@, viewer@ ... di domain nusakarya.id). Akun-akun itu
-- TIDAK direkonstruksi di sini, dan itu disengaja:
--
--   * baris auth.users berisi kata sandi ter-hash, token pemulihan dan
--     metadata sesi — tidak boleh masuk ke repositori dalam bentuk apa pun;
--   * membuat pengguna lewat INSERT langsung ke auth.users adalah praktik
--     yang tidak didukung Supabase dan mudah rusak antar versi GoTrue.
--
-- Cara yang benar untuk menyiapkan akun di lingkungan baru:
--   1. buat akun lewat Supabase Dashboard (Authentication > Users) atau
--      Admin API (auth.admin.createUser), satu per satu;
--   2. isi user_metadata dengan { "company_id", "role", "full_name",
--      "unit", "branch_id", "employee_id" } sesuai kebutuhan;
--   3. pemicu on_auth_user_created di Bagian B akan otomatis membuat
--      baris public.profiles yang bersesuaian.
--
-- Kata sandi ditetapkan saat pembuatan akun dan disimpan di pengelola
-- rahasia tim — BUKAN di repositori ini.
--
-- Catatan tambahan: 0016_qa_fix_rls.sql sudah menautkan akun
-- teknisi@nusakarya.id ke baris employees miliknya. Tautan itu hanya
-- berlaku bila akun tersebut memang sudah dibuat lebih dulu.


-- =====================================================================
-- BAGIAN C2 — bucket penyimpanan berkas + kebijakan storage.objects
-- (dari migrasi basis data: 0012_auth_bootstrap_and_storage)
-- =====================================================================
-- Satu bucket privat bernama 'files'. Berkas disimpan dengan prefix
-- folder = company_id, sehingga pengurungan antar tenant dilakukan oleh
-- kebijakan di bawah: (storage.foldername(name))[1] = auth_company_id().
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files',
  'files',
  false,
  26214400,                        -- 25 MiB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'application/zip',
    'image/svg+xml'
  ]
)
on conflict (id) do nothing;

-- SELECT: hanya berkas milik perusahaan sendiri.
drop policy if exists files_select on storage.objects;
create policy files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (public.auth_company_id())::text
  );

-- INSERT: wajib menaruh berkas di folder perusahaan sendiri.
drop policy if exists files_insert on storage.objects;
create policy files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (public.auth_company_id())::text
  );

-- UPDATE: hanya berkas milik perusahaan sendiri, dan tetap di folder itu.
drop policy if exists files_update on storage.objects;
create policy files_update on storage.objects for update to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (public.auth_company_id())::text
  )
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (public.auth_company_id())::text
  );

-- DELETE: hanya super_admin, direktur dan para manager unit.
drop policy if exists files_delete on storage.objects;
create policy files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (public.auth_company_id())::text
    and public.auth_role() = any (array[
      'super_admin',
      'direktur',
      'manager_hr',
      'manager_commerce',
      'manager_procurement',
      'manager_finance',
      'manager_inventory',
      'manager_operations',
      'manager_deployment'
    ])
  );


-- =====================================================================
-- BAGIAN D — akses Finance ke AR/AP
-- (dari migrasi basis data: 0014_finance_ap_ar_access)
-- =====================================================================
-- 0007_rls.sql memberi label modul tunggal pada tiga tabel penagihan:
--   ar_invoices, ar_payments   -> COMMERCE saja
--   vendor_invoices            -> PROCUREMENT saja
-- Akibatnya unit FINANCE (yang justru memegang piutang & hutang) tidak
-- bisa membaca atau mencatat apa pun di sana. Perbaikannya: modul asal
-- DIPERTAHANKAN, modul FINANCE DITAMBAHKAN dengan OR. Ketiga tabel juga
-- dipersempit ke peran `authenticated` (bukan PUBLIC seperti sebelumnya).
--
-- Bandingkan dengan 0016_qa_fix_rls.sql yang menangani ap_payments:
-- di sana modulnya DIGANTI (PROCUREMENT -> FINANCE), di sini DITAMBAH.

-- ---- ar_invoices (COMMERCE atau FINANCE) ----
drop policy if exists ar_invoices_select on public.ar_invoices;
create policy ar_invoices_select on public.ar_invoices for select to authenticated
  using (
    company_id = public.auth_company_id()
    and (public.can_read('COMMERCE') or public.can_read('FINANCE'))
  );

drop policy if exists ar_invoices_insert on public.ar_invoices;
create policy ar_invoices_insert on public.ar_invoices for insert to authenticated
  with check (
    company_id = public.auth_company_id()
    and (public.can_write('COMMERCE') or public.can_write('FINANCE'))
  );

drop policy if exists ar_invoices_update on public.ar_invoices;
create policy ar_invoices_update on public.ar_invoices for update to authenticated
  using (
    company_id = public.auth_company_id()
    and (public.can_write('COMMERCE') or public.can_write('FINANCE'))
  )
  with check (
    company_id = public.auth_company_id()
    and (public.can_write('COMMERCE') or public.can_write('FINANCE'))
  );

drop policy if exists ar_invoices_delete on public.ar_invoices;
create policy ar_invoices_delete on public.ar_invoices for delete to authenticated
  using (
    company_id = public.auth_company_id()
    and (public.can_approve('COMMERCE') or public.can_approve('FINANCE'))
  );

-- ---- ar_payments (COMMERCE atau FINANCE) ----
drop policy if exists ar_payments_select on public.ar_payments;
create policy ar_payments_select on public.ar_payments for select to authenticated
  using (
    company_id = public.auth_company_id()
    and (public.can_read('COMMERCE') or public.can_read('FINANCE'))
  );

drop policy if exists ar_payments_insert on public.ar_payments;
create policy ar_payments_insert on public.ar_payments for insert to authenticated
  with check (
    company_id = public.auth_company_id()
    and (public.can_write('COMMERCE') or public.can_write('FINANCE'))
  );

drop policy if exists ar_payments_update on public.ar_payments;
create policy ar_payments_update on public.ar_payments for update to authenticated
  using (
    company_id = public.auth_company_id()
    and (public.can_write('COMMERCE') or public.can_write('FINANCE'))
  )
  with check (
    company_id = public.auth_company_id()
    and (public.can_write('COMMERCE') or public.can_write('FINANCE'))
  );

drop policy if exists ar_payments_delete on public.ar_payments;
create policy ar_payments_delete on public.ar_payments for delete to authenticated
  using (
    company_id = public.auth_company_id()
    and (public.can_approve('COMMERCE') or public.can_approve('FINANCE'))
  );

-- ---- vendor_invoices (PROCUREMENT atau FINANCE) ----
drop policy if exists vendor_invoices_select on public.vendor_invoices;
create policy vendor_invoices_select on public.vendor_invoices for select to authenticated
  using (
    company_id = public.auth_company_id()
    and (public.can_read('PROCUREMENT') or public.can_read('FINANCE'))
  );

drop policy if exists vendor_invoices_insert on public.vendor_invoices;
create policy vendor_invoices_insert on public.vendor_invoices for insert to authenticated
  with check (
    company_id = public.auth_company_id()
    and (public.can_write('PROCUREMENT') or public.can_write('FINANCE'))
  );

drop policy if exists vendor_invoices_update on public.vendor_invoices;
create policy vendor_invoices_update on public.vendor_invoices for update to authenticated
  using (
    company_id = public.auth_company_id()
    and (public.can_write('PROCUREMENT') or public.can_write('FINANCE'))
  )
  with check (
    company_id = public.auth_company_id()
    and (public.can_write('PROCUREMENT') or public.can_write('FINANCE'))
  );

drop policy if exists vendor_invoices_delete on public.vendor_invoices;
create policy vendor_invoices_delete on public.vendor_invoices for delete to authenticated
  using (
    company_id = public.auth_company_id()
    and (public.can_approve('PROCUREMENT') or public.can_approve('FINANCE'))
  );


-- =====================================================================
-- BAGIAN E — work_permits lingkup-sendiri (penegasan ulang)
-- (dari migrasi basis data: 0028b_fix_work_permits_self_scope_perf)
-- =====================================================================
-- CATATAN JUJUR: isi migrasi 0028b ternyata SUDAH tercermin di berkas
-- 0028_fix_work_permits_self_scope.sql yang ada di repo — berkas itu
-- sudah memakai (select auth.uid()) sehingga fungsi auth dievaluasi
-- sekali per query, bukan per baris (advisory performa auth_rls_initplan).
-- Definisi di bawah SAMA PERSIS dengan yang terpasang di basis data;
-- ditulis ulang di sini semata-mata supaya berkas ini lengkap sebagai
-- cermin dari migrasi yang hilang. Menjalankannya tidak mengubah apa pun.
drop policy if exists work_permits_insert_self on public.work_permits;
create policy work_permits_insert_self on public.work_permits for insert to authenticated
  with check (
    company_id = public.auth_company_id()
    and requested_by = (select auth.uid())
  );

drop policy if exists work_permits_select_self on public.work_permits;
create policy work_permits_select_self on public.work_permits for select to authenticated
  using (
    company_id = public.auth_company_id()
    and requested_by = (select auth.uid())
  );


-- =====================================================================
-- BAGIAN F — profiles dibaca lewat hak modul CORE
-- (dari migrasi basis data: 0031_profiles_read_by_module)
-- =====================================================================
-- 0007_rls.sql mengunci pembacaan profiles ke daftar peran keras
-- ('manager_hr','super_admin'). Itu membuat setiap halaman yang perlu
-- menampilkan nama orang lain (pemohon approval, PIC gudang, penanggung
-- jawab tiket, dsb.) kosong untuk hampir semua peran.
--
-- Perbaikan: ganti daftar peran keras dengan hak modul CORE
-- (can_read('CORE') / can_write('CORE')) yang sudah diisi untuk seluruh
-- 23 peran di 0009_seed.sql — sehingga pengaturan akses cukup lewat
-- matriks role_module_access, bukan lewat daftar peran yang ditanam di
-- dalam kebijakan. Baris milik sendiri (id = auth.uid()) tetap selalu
-- bisa dibaca & diperbarui. Kedua kebijakan juga dipersempit ke peran
-- `authenticated` dan memakai (select auth.uid()) demi performa.
--
-- profiles_insert dan profiles_delete TIDAK diubah — keduanya masih
-- sesuai dengan 0007_rls.sql dan dengan basis data sekarang.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (company_id = public.auth_company_id() and public.can_read('CORE'))
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or (company_id = public.auth_company_id() and public.can_write('CORE'))
  )
  with check (
    id = (select auth.uid())
    or (company_id = public.auth_company_id() and public.can_write('CORE'))
  );


-- =====================================================================
-- BAGIAN G — cabut hak anon atas fn_bersihkan_data_contoh
-- (dari migrasi basis data: kesiapan_produksi_revoke_anon)
-- =====================================================================
-- fn_bersihkan_data_contoh() adalah SECURITY DEFINER yang MENGHAPUS data
-- dari 117 tabel. 0035_kesiapan_produksi.sql membuatnya tanpa mengatur
-- hak eksekusi, sehingga fungsi itu terbuka untuk PUBLIC (dan dengan
-- demikian untuk anon, alias pemanggil tanpa login lewat PostgREST).
-- Migrasi ini menutupnya: hanya pengguna yang sudah login yang boleh
-- memanggilnya, dan di dalam fungsinya sendiri masih ada pemeriksaan
-- is_super() serta kata konfirmasi 'HAPUS DATA CONTOH'.
revoke execute on function public.fn_bersihkan_data_contoh(uuid, text) from public;
revoke execute on function public.fn_bersihkan_data_contoh(uuid, text) from anon;
grant  execute on function public.fn_bersihkan_data_contoh(uuid, text) to authenticated;


-- =====================================================================
-- BAGIAN H — kesiapan_performa_fix_ambiguous_column: tidak ada SQL
-- =====================================================================
-- Migrasi basis data `kesiapan_performa_fix_ambiguous_column` memperbaiki
-- galat "column reference company_id is ambiguous" pada
-- fn_kesiapan_produksi(): nama kolom keluaran fungsi (company_id, dari
-- RETURNS TABLE) bentrok dengan kolom company_id pada tabel-tabel yang
-- dipindai, sehingga setiap referensi tak berawalan dianggap ambigu oleh
-- PL/pgSQL. Perbaikannya adalah memberi alias tabel pada seluruh query
-- (e., ct., w., j., pr., x.).
--
-- Perbaikan itu SUDAH ada di berkas 0036_kesiapan_performa.sql di repo:
-- definisi di berkas tersebut sudah identik — baris demi baris — dengan
-- pg_get_functiondef() dari basis data sekarang (diperiksa 16 Sep 2026).
-- Karena itu tidak ada satu pun perintah yang perlu diulang di sini.
-- Bagian ini sengaja ditulis agar jelas bahwa migrasi tersebut sudah
-- ditelusuri dan bukan sekadar terlewat.
