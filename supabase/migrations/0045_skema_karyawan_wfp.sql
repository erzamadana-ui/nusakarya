-- =====================================================================
-- 0045_skema_karyawan_wfp.sql
--
-- KENAPA MIGRASI INI ADA
-- ----------------------
-- File formasi WFP Regional Sumbagteng (2020 baris) dijadikan acuan oleh
-- GM untuk struktur "Data Karyawan". Saat dianalisis, file itu TIDAK
-- berbentuk satu-baris-satu-karyawan:
--
--   * 1788 baris berisi karyawan, 232 baris adalah FORMASI KOSONG
--     (tanpa NIK dan tanpa nama). Formasi kosong ini BUKAN sampah --
--     ia adalah kursi yang masih harus diisi, jadi tetap wajib tersimpan.
--   * 52 NIK muncul lebih dari sekali; 42 di antaranya adalah ORANG YANG
--     SAMA memegang DUA POSISI sekaligus (mis. Project Manager yang juga
--     SO Project Deployment). Itu sah secara organisasi.
--
-- Kesimpulannya: satu ORANG (NIK) dapat memegang lebih dari satu POSISI
-- (OBJECT ID). Memaksa data ini masuk ke tabel `employees` saja akan
-- merusak keunikan karyawan -- orang yang memegang dua posisi akan
-- tercatat sebagai dua karyawan berbeda, sehingga payroll, absensi dan
-- seluruh 39 tabel yang menunjuk ke employees ikut ganda.
--
-- Karena itu data dipecah menjadi dua tingkat:
--   1. TINGKAT ORANG  -> kolom tambahan pada `employees` (satu baris per NIK)
--   2. TINGKAT POSISI -> tabel baru `employee_positions` (satu baris per
--      OBJECT ID; employee_id boleh NULL untuk formasi yang belum terisi)
--
-- ATURAN DARI GM: kolom hanya DITAMBAH, tidak ada yang dikurangi atau
-- diubah. Kolom lama `employees` yang tidak punya padanan di file WFP
-- (gender, birth_date, address, npwp, nik_ktp, rekening bank, BPJS,
-- ptkp_status, dsb) SENGAJA DIBIARKAN kosong -- justru kekosongan itulah
-- yang menjadi antrean kerja HR lewat view `v_inbox_kelengkapan_hr`
-- di bagian 6.
--
-- Migrasi ini HANYA SKEMA. Tidak ada satu baris data karyawan pun yang
-- dimuat atau dihapus di sini (pemuatan adalah tugas terpisah).
-- =====================================================================


-- =====================================================================
-- 1. TINGKAT ORANG -- kolom tambahan pada `employees`
--
-- Semua memakai `add column if not exists` supaya migrasi aman diulang
-- dan supaya tidak ada kolom lama yang tersentuh.
-- =====================================================================

alter table public.employees
  -- NIK Telkom (8 digit pada file WFP). SENGAJA kolom baru, bukan
  -- menumpang `nip` maupun `nik_ktp`: `nip` adalah nomor pegawai internal
  -- perusahaan yang sudah dipakai relasi lain, dan `nik_ktp` adalah NIK
  -- kependudukan 16 digit. Tiga identitas berbeda, tidak boleh dicampur.
  add column if not exists nik_telkom text,

  -- Status kemitraan orangnya (bukan posisinya): pegawai Telkom Akses,
  -- tenaga mitra, atau skema RIFO fix/variable.
  add column if not exists kemitraan text,

  -- Kelompok sumber pembiayaan formasi WFP (RKAP/MITRA/RIFO/NFO).
  -- CATATAN JUJUR: secara konseptual ini lebih melekat ke POSISI daripada
  -- ke ORANG, tetapi ditempatkan di sini sesuai permintaan. Bila nanti
  -- ada orang dengan dua posisi beda group, nilai di sini menjadi ambigu
  -- dan yang dipakai harus nilai di employee_positions.
  add column if not exists group_wfp text,

  -- Level/jabatan fungsional (Teknisi, Korlap, Helpdesk, Manager, dst).
  -- Dinamai `level_jabatan` dan bukan `level` karena `level` adalah kata
  -- yang terlalu umum dan menyulitkan pembacaan query gabungan.
  add column if not exists level_jabatan text,

  -- Keahlian teknisi. Di file ditulis sebagai teks dipisah " | "
  -- (mis. "PT1 | PT2 | ASSURANCE"). Disimpan sebagai array supaya bisa
  -- dicari dengan operator `@>` / `&&` tanpa LIKE yang rapuh.
  add column if not exists skill text[],

  -- Dasar penilaian teknisi: dibayar atas performa atau atas ketersediaan.
  add column if not exists status_teknisi text,

  -- Sifat gaji orangnya: tetap atau mengikuti volume pekerjaan.
  -- Berbeda dari `payroll_scheme` yang sudah ada (fix_salary/freelance/
  -- campuran) -- yang itu menentukan MESIN payroll mana yang dipakai,
  -- sedangkan ini adalah klasifikasi WFP dari Telkom. Keduanya disimpan
  -- terpisah supaya klasifikasi Telkom tidak mengubah perhitungan gaji.
  add column if not exists status_salary text;

-- Kumpulan nilai tetap. CHECK di Postgres otomatis LOLOS untuk NULL,
-- jadi kolom yang belum diisi tidak akan tertolak -- yang ditolak hanya
-- nilai salah ketik. Nilai di bawah diambil PERSIS dari hasil hitung
-- nilai unik pada file, bukan dikira-kira.
do $$
begin
  -- kemitraan: 4 nilai sah (TELKOM AKSES 1310, MITRA 475,
  -- RIFO VARIABLE 205, RIFO FIX 13; 17 baris kosong).
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.employees'::regclass
                   and conname = 'employees_kemitraan_check') then
    alter table public.employees add constraint employees_kemitraan_check
      check (kemitraan in ('TELKOM AKSES','MITRA','RIFO FIX','RIFO VARIABLE'));
  end if;

  -- status_teknisi: 2 nilai sah (PERFORMANCE BASED 1641, RESOURCE BASED 201).
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.employees'::regclass
                   and conname = 'employees_status_teknisi_check') then
    alter table public.employees add constraint employees_status_teknisi_check
      check (status_teknisi in ('PERFORMANCE BASED','RESOURCE BASED'));
  end if;

  -- status_salary: 2 nilai sah (FIXED 1168, VARIABLE 447).
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.employees'::regclass
                   and conname = 'employees_status_salary_check') then
    alter table public.employees add constraint employees_status_salary_check
      check (status_salary in ('FIXED','VARIABLE'));
  end if;

  -- group_wfp: 4 nilai sah (RKAP 1215, MITRA 471, RIFO 216, NFO 109).
  -- PERINGATAN UNTUK AGEN PEMUAT DATA: di file masih ada 1 (satu) baris
  -- bernilai 'TELKOM AKSES' pada kolom group_wfp. Itu nilai kolom
  -- `kemitraan` yang bocor ke kolom yang salah, bukan group WFP yang sah,
  -- sehingga TIDAK dimasukkan ke daftar. Baris tersebut harus dibetulkan
  -- sebelum dimuat, atau insert-nya akan ditolak constraint ini.
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.employees'::regclass
                   and conname = 'employees_group_wfp_check') then
    alter table public.employees add constraint employees_group_wfp_check
      check (group_wfp in ('RKAP','MITRA','RIFO','NFO'));
  end if;
end $$;

-- Satu NIK Telkom = satu orang = satu baris employees. Indeks unik ini
-- adalah penegakan teknis dari kesimpulan model data di atas: kalau agen
-- pemuat data mencoba membuat dua baris karyawan untuk orang yang sama
-- (karena ia memegang dua posisi), insert-nya akan GAGAL di sini, bukan
-- diam-diam menghasilkan karyawan ganda.
-- PERINGATAN: 10 NIK di file punya NAMA BERBEDA pada baris berbeda
-- (kesalahan input, bukan orang berposisi ganda). Konflik itu harus
-- diselesaikan lebih dulu atau indeks ini akan menolaknya.
create unique index if not exists uq_employees_nik_telkom
  on public.employees (company_id, nik_telkom)
  where nik_telkom is not null;

comment on column public.employees.nik_telkom  is 'NIK Telkom (8 digit) dari formasi WFP. Unik per perusahaan. Berbeda dari nip (nomor pegawai internal) dan nik_ktp (NIK kependudukan 16 digit).';
comment on column public.employees.kemitraan   is 'Status kemitraan orang: TELKOM AKSES / MITRA / RIFO FIX / RIFO VARIABLE.';
comment on column public.employees.group_wfp   is 'Kelompok pembiayaan formasi WFP: RKAP / MITRA / RIFO / NFO. Bila orang memegang dua posisi beda group, acuan yang sah ada di employee_positions.';
comment on column public.employees.level_jabatan is 'Level fungsional WFP (Teknisi, Korlap, Helpdesk, Officer 1-3, Manager, dst). Sengaja teks bebas: 15 nilai berbeda dan masih berkembang.';
comment on column public.employees.skill       is 'Daftar keahlian teknisi. Di file berupa teks dipisah " | "; disimpan sebagai array agar dapat dicari dengan operator array.';
comment on column public.employees.status_teknisi is 'PERFORMANCE BASED / RESOURCE BASED.';
comment on column public.employees.status_salary  is 'Klasifikasi WFP Telkom: FIXED / VARIABLE. Bukan pengganti payroll_scheme yang menentukan mesin payroll.';


-- =====================================================================
-- 2. TABEL REFERENSI -- supaya STO dan NAMA PROGRAM berhenti jadi teks bebas
--
-- Dibuat SEBELUM employee_positions karena tabel itu menunjuk ke sini.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2a. program_ref -- 14 nama program yang sah
-- ---------------------------------------------------------------------
create table if not exists public.program_ref (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  nama_program text not null,
  keterangan   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  constraint uq_program_ref_nama unique (company_id, nama_program)
);

comment on table public.program_ref is
  'Daftar nama program kerja yang sah (IOAN, PROVISIONING, OSP, dst). Menggantikan kolom teks bebas NAMA PROGRAM pada file WFP supaya laporan per program tidak pecah karena beda ejaan.';

-- ---------------------------------------------------------------------
-- 2b. program_position_ref -- peta POSITION TITLE -> NAMA PROGRAM
--
-- Isi map_program.csv: 82 position title, 72 sudah punya program,
-- 10 masih "BELUM ADA MAPPING". Peta ini disimpan sebagai tabel (bukan
-- logika di kode pemuat) supaya HR bisa melengkapi 10 sisanya sendiri
-- lewat aplikasi, tanpa perlu deploy ulang.
-- ---------------------------------------------------------------------
create table if not exists public.program_position_ref (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  position_title text not null,
  program_ref_id uuid references public.program_ref(id) on delete set null,
  -- NULL berarti "belum ada mapping" dan menjadi pekerjaan HR.
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  constraint uq_program_position_ref unique (company_id, position_title)
);

comment on table public.program_position_ref is
  'Peta POSITION TITLE -> program. program_ref_id NULL berarti mapping belum ditentukan dan menjadi antrean kerja HR.';

-- ---------------------------------------------------------------------
-- 2c. sto_ref -- daftar STO (Sentral Telepon Otomat)
--
-- PERINGATAN KERAS UNTUK AGEN PEMUAT DATA:
-- Pada file WFP, kolom `sto` dan `sto_kode` TIDAK konsisten berpasangan.
-- Terdapat 17 kode yang menunjuk ke lebih dari satu nama (mis. TLB ->
-- BANDAR BUAT / PAINAN / TELUK BAYUR) dan 13 nama yang punya lebih dari
-- satu kode (mis. PAINAN -> BLS/PNN/TLB/TPJ/TPN). Artinya salah satu dari
-- kedua kolom itu tergeser saat entri.
--
-- Tabel ini sengaja dibuat BERSIH (unik per kode) dan employee_positions
-- TIDAK diberi foreign key wajib ke sini -- lihat alasannya di bagian 3.
-- Rekonsiliasi 83 baris bermasalah itu adalah pekerjaan HR/operasi,
-- bukan sesuatu yang boleh ditebak oleh migrasi.
-- ---------------------------------------------------------------------
create table if not exists public.sto_ref (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kode       text not null,
  nama       text not null,
  psa        text,
  branch_id  uuid references public.branches(id) on delete set null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  constraint uq_sto_ref_kode unique (company_id, kode)
);

comment on table public.sto_ref is
  'Referensi STO: kode, nama, PSA dan cabang. Dibuat karena kolom STO pada file WFP berupa teks bebas yang saling bertabrakan (17 kode dengan >1 nama, 13 nama dengan >1 kode).';


-- =====================================================================
-- 3. TINGKAT POSISI -- tabel baru `employee_positions`
--
-- Satu baris = satu FORMASI/penugasan (satu OBJECT ID), bukan satu orang.
-- =====================================================================
create table if not exists public.employee_positions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,

  -- NULLABLE dengan sengaja: 232 formasi di file belum ada orangnya.
  -- ON DELETE SET NULL (bukan CASCADE) supaya ketika seorang karyawan
  -- dihapus/resign dan barisnya dibuang, FORMASINYA TIDAK IKUT HILANG --
  -- ia kembali menjadi kursi kosong yang perlu diisi. Itu justru
  -- informasi yang paling dicari GM.
  employee_id uuid references public.employees(id) on delete set null,

  -- OBJECT ID dari sistem WFP Telkom. Dua format sah yang terverifikasi:
  -- 17 digit (formasi WFP) dan MTR-#### (tenaga mitra). 221 baris di file
  -- tidak punya object_id sama sekali, jadi kolomnya NULLABLE.
  object_id     text,
  position_name text,
  position_title text,

  -- Lokasi. branch_id menunjuk master cabang; psa adalah area tugas.
  -- Keduanya disimpan karena pada 55 baris branch BERBEDA dari psa dan
  -- itu SAH: karyawan terdaftar di satu cabang tetapi bertugas di area
  -- PSA lain. Menyatukannya akan menghapus fakta penugasan silang itu.
  branch_id uuid references public.branches(id) on delete set null,
  psa       text,
  -- psa sengaja TANPA check constraint: 5 nilai yang ada sekarang
  -- (BATAM, PEKANBARU, PADANG, DUMAI, BUKITTINGGI) hanyalah cakupan
  -- Regional Sumbagteng. Mengunci nilainya akan membuat skema ini gagal
  -- begitu perusahaan memakai regional lain.

  portofolio   text,
  group_fungsi text,
  sub_group    text,

  -- Program: teks asli dipertahankan untuk jejak audit, ditambah
  -- penunjuk ke tabel referensi. Keduanya ada supaya pemuatan data tidak
  -- gagal total hanya karena satu nama program belum terdaftar.
  nama_program   text,
  program_ref_id uuid references public.program_ref(id) on delete set null,

  -- Biaya per teknisi untuk formasi ini. numeric, bukan integer:
  -- nilai di file memang bulat (mis. 3182955) tetapi tarif dapat berubah
  -- menjadi pecahan, dan numeric menghindari galat pembulatan uang.
  gaji_per_teknisi numeric(15,2),

  -- STO: sama seperti program, teks asli + penunjuk referensi.
  -- FK ke sto_ref sengaja NULLABLE dan TIDAK wajib, karena 83 baris di
  -- file punya pasangan kode/nama yang bertabrakan. Memaksa FK wajib akan
  -- membuat pemuatan data mustahil sebelum rekonsiliasi manual selesai.
  sto        text,
  sto_kode   text,
  sto_ref_id uuid references public.sto_ref(id) on delete set null,

  -- Sektor yang ditangani. Di file berupa teks dipisah " | ".
  sektor_ditangani text[],

  -- Sifat penugasan. Hanya 135 dari 2020 baris yang terisi
  -- (POH 103, DEFINITIF 26, PGS 6) -- sisanya NULL, dan itu wajar.
  status_penugasan text,

  -- Kolom TURUNAN, bukan kolom yang diisi manual. Dihitung otomatis dari
  -- employee_id supaya tidak mungkin berbohong: kalau orangnya dilepas,
  -- formasi ini otomatis kembali tercatat kosong tanpa perlu ada yang
  -- ingat memperbaruinya.
  is_formasi_kosong boolean generated always as (employee_id is null) stored,

  aktif boolean not null default true,

  -- Periode berlaku penugasan: memungkinkan riwayat mutasi tersimpan
  -- (orang pindah formasi) alih-alih menimpa baris lama.
  berlaku_mulai  date,
  berlaku_sampai date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  -- Hanya dua format object_id yang terverifikasi di data.
  constraint employee_positions_object_id_format_check
    check (object_id is null
           or object_id ~ '^[0-9]{17}$'
           or object_id ~ '^MTR-[0-9]{4}$'),

  constraint employee_positions_status_penugasan_check
    check (status_penugasan in ('DEFINITIF','PGS','POH')),

  constraint employee_positions_periode_check
    check (berlaku_sampai is null or berlaku_mulai is null
           or berlaku_sampai >= berlaku_mulai)
);

-- Keunikan object_id DIBATASI pada formasi yang SUDAH ADA ORANGNYA.
-- Alasannya konkret: di file ada 5 object_id yang muncul dua kali, dan
-- pada kelima kasus itu satu baris terisi karyawan sementara pasangannya
-- adalah formasi kosong duplikat (mis. 85103040101010002 dipegang ROBY
-- SYAHPUTRA sekaligus muncul lagi sebagai kursi kosong).
-- Unique penuh akan menolak pemuatan; unique parsial ini tetap menjamin
-- tidak ada DUA ORANG menempati satu object_id yang sama -- yang memang
-- kesalahan sesungguhnya -- sambil membiarkan duplikat formasi kosong
-- masuk untuk dibersihkan HR belakangan.
create unique index if not exists uq_employee_positions_object_id
  on public.employee_positions (company_id, object_id)
  where object_id is not null and employee_id is not null;

create index if not exists idx_employee_positions_company  on public.employee_positions (company_id);
create index if not exists idx_employee_positions_employee on public.employee_positions (employee_id);
create index if not exists idx_employee_positions_branch   on public.employee_positions (branch_id);
-- Indeks parsial khusus pertanyaan yang paling sering ditanya GM:
-- "formasi mana yang masih kosong?"
create index if not exists idx_employee_positions_kosong
  on public.employee_positions (company_id, psa)
  where is_formasi_kosong and aktif;

comment on table public.employee_positions is
  'Formasi/penugasan WFP. Satu baris = satu OBJECT ID, BUKAN satu orang: satu karyawan boleh memegang lebih dari satu posisi, dan employee_id NULL berarti formasi masih kosong dan perlu diisi.';
comment on column public.employee_positions.employee_id is
  'NULL = formasi kosong. ON DELETE SET NULL agar formasi tetap tersimpan saat karyawannya dihapus.';
comment on column public.employee_positions.is_formasi_kosong is
  'Kolom turunan otomatis (employee_id is null). Jangan diisi manual.';
comment on column public.employee_positions.psa is
  'Area PSA tempat bertugas. Boleh berbeda dari cabang tempat karyawan terdaftar -- pada 55 baris file hal itu memang terjadi dan sah.';
comment on column public.employee_positions.sto_ref_id is
  'Penunjuk STO yang sudah dibakukan. Sengaja tidak wajib: kolom sto/sto_kode pada sumber masih saling bertabrakan pada 83 baris.';


-- =====================================================================
-- 4. RLS -- mengikuti pola yang sudah dipakai repo (lihat 0039 dan 0040)
--
--   SELECT        : company_id = auth_company_id() and can_read('HR')
--   INSERT/UPDATE : can_write_master('HR')  -- master data, bukan transaksi
--   DELETE        : can_approve('HR')
--   + kebijakan mandiri: karyawan boleh MEMBACA baris posisinya sendiri.
--
-- Beberapa policy SELECT bersifat permissive sehingga di-OR-kan; itulah
-- sebabnya policy mandiri tidak perlu mengulang can_read('HR').
-- =====================================================================

alter table public.employee_positions   enable row level security;
alter table public.program_ref          enable row level security;
alter table public.program_position_ref enable row level security;
alter table public.sto_ref              enable row level security;

-- --------------------------- employee_positions ----------------------
drop policy if exists employee_positions_select on public.employee_positions;
create policy employee_positions_select on public.employee_positions for select
  using (company_id = auth_company_id() and can_read('HR'));

-- Layanan mandiri: seorang karyawan selalu boleh melihat formasi yang ia
-- pegang, walau tidak punya hak baca modul HR. Tanpa ini, teknisi tidak
-- bisa melihat penugasannya sendiri di aplikasi.
drop policy if exists employee_positions_select_self on public.employee_positions;
create policy employee_positions_select_self on public.employee_positions for select
  using (company_id = auth_company_id() and employee_id = auth_employee_id());

drop policy if exists employee_positions_insert on public.employee_positions;
create policy employee_positions_insert on public.employee_positions for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists employee_positions_update on public.employee_positions;
create policy employee_positions_update on public.employee_positions for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists employee_positions_delete on public.employee_positions;
create policy employee_positions_delete on public.employee_positions for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- --------------------------- program_ref -----------------------------
drop policy if exists program_ref_select on public.program_ref;
create policy program_ref_select on public.program_ref for select
  using (company_id = auth_company_id() and can_read('HR'));

drop policy if exists program_ref_insert on public.program_ref;
create policy program_ref_insert on public.program_ref for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists program_ref_update on public.program_ref;
create policy program_ref_update on public.program_ref for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists program_ref_delete on public.program_ref;
create policy program_ref_delete on public.program_ref for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- --------------------------- program_position_ref --------------------
drop policy if exists program_position_ref_select on public.program_position_ref;
create policy program_position_ref_select on public.program_position_ref for select
  using (company_id = auth_company_id() and can_read('HR'));

drop policy if exists program_position_ref_insert on public.program_position_ref;
create policy program_position_ref_insert on public.program_position_ref for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists program_position_ref_update on public.program_position_ref;
create policy program_position_ref_update on public.program_position_ref for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists program_position_ref_delete on public.program_position_ref;
create policy program_position_ref_delete on public.program_position_ref for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- --------------------------- sto_ref ---------------------------------
drop policy if exists sto_ref_select on public.sto_ref;
create policy sto_ref_select on public.sto_ref for select
  using (company_id = auth_company_id() and can_read('HR'));

drop policy if exists sto_ref_insert on public.sto_ref;
create policy sto_ref_insert on public.sto_ref for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists sto_ref_update on public.sto_ref;
create policy sto_ref_update on public.sto_ref for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists sto_ref_delete on public.sto_ref;
create policy sto_ref_delete on public.sto_ref for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- Hak tabel biasa; pembatasan sesungguhnya tetap dikerjakan RLS di atas.
grant select, insert, update, delete on public.employee_positions   to authenticated;
grant select, insert, update, delete on public.program_ref          to authenticated;
grant select, insert, update, delete on public.program_position_ref to authenticated;
grant select, insert, update, delete on public.sto_ref              to authenticated;


-- =====================================================================
-- 5. Trigger updated_at -- memakai fungsi set_updated_at() yang sudah ada
-- =====================================================================
drop trigger if exists trg_employee_positions_updated   on public.employee_positions;
create trigger trg_employee_positions_updated   before update on public.employee_positions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_program_ref_updated          on public.program_ref;
create trigger trg_program_ref_updated          before update on public.program_ref
  for each row execute function public.set_updated_at();

drop trigger if exists trg_program_position_ref_updated on public.program_position_ref;
create trigger trg_program_position_ref_updated before update on public.program_position_ref
  for each row execute function public.set_updated_at();

drop trigger if exists trg_sto_ref_updated              on public.sto_ref;
create trigger trg_sto_ref_updated              before update on public.sto_ref
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 6. INBOX HR -- kolom lama yang tidak terisi file WFP jadi antrean kerja
--
-- KENAPA VIEW, BUKAN KOLOM PENANDA:
-- Kalau kelengkapan disimpan sebagai kolom (mis. `data_lengkap boolean`),
-- nilainya akan basi begitu HR mengisi satu field dan lupa memperbarui
-- penandanya. View selalu menghitung ulang dari keadaan terkini, sehingga
-- sebuah baris HILANG dari inbox tepat pada saat datanya benar-benar
-- lengkap -- tidak bisa dicentang palsu.
--
-- security_invoker = true supaya view tunduk pada RLS employees milik
-- pemanggil, bukan pemiliknya. Tanpa ini view akan menjadi lubang yang
-- membocorkan data karyawan lintas perusahaan.
-- =====================================================================
create or replace view public.v_inbox_kelengkapan_hr
with (security_invoker = true) as
select
  e.id            as employee_id,
  e.company_id,
  e.nip,
  e.nik_telkom,
  e.full_name,
  e.branch_id,
  e.status,
  -- Daftar kolom yang masih kosong. Nama yang dipakai adalah istilah HR,
  -- bukan nama kolom teknis, karena isi array ini tampil langsung di UI.
  array_remove(array[
    case when e.gender      is null then 'Jenis Kelamin'   end,
    case when e.birth_date  is null then 'Tanggal Lahir'   end,
    case when e.address     is null or e.address = ''  then 'Alamat'         end,
    case when e.phone       is null or e.phone   = ''  then 'Nomor Telepon'  end,
    case when e.email       is null or e.email   = ''  then 'Email'          end,
    case when e.nik_ktp     is null or e.nik_ktp = ''  then 'NIK KTP'        end,
    case when e.npwp        is null or e.npwp    = ''  then 'NPWP'           end,
    case when e.ptkp_status is null then 'Status PTKP'    end,
    case when e.bank_name   is null or e.bank_name    = '' then 'Nama Bank'      end,
    case when e.bank_account is null or e.bank_account = '' then 'Nomor Rekening' end,
    case when e.bank_holder is null or e.bank_holder  = '' then 'Nama Pemilik Rekening' end,
    case when e.bpjs_tk_no  is null or e.bpjs_tk_no  = '' then 'BPJS Ketenagakerjaan' end,
    case when e.bpjs_kes_no is null or e.bpjs_kes_no = '' then 'BPJS Kesehatan' end,
    case when e.join_date   is null then 'Tanggal Bergabung' end,
    case when e.employment_type is null then 'Jenis Hubungan Kerja' end
  ], null) as kolom_perlu_diisi
from public.employees e
where e.status <> 'resign';

comment on view public.v_inbox_kelengkapan_hr is
  'Antrean kerja HR: karyawan beserta daftar kolom yang masih kosong. File WFP tidak memuat data pribadi/administratif (gender, alamat, NPWP, rekening, BPJS, PTKP), sehingga kekosongan itu sengaja ditampilkan sebagai pekerjaan, bukan disembunyikan. Saring dengan cardinality(kolom_perlu_diisi) > 0.';

grant select on public.v_inbox_kelengkapan_hr to authenticated;


-- =====================================================================
-- 7. Seed referensi program (BUKAN data karyawan)
--
-- 14 nama program diambil dari map_program.csv dan dari kolom
-- nama_program file WFP -- keduanya menghasilkan himpunan yang sama.
-- Disemai untuk SETIAP perusahaan yang sudah ada agar tabel referensi
-- tidak kosong saat halaman HR pertama kali dibuka.
-- `on conflict do nothing` membuat migrasi aman dijalankan ulang.
-- =====================================================================
insert into public.program_ref (company_id, nama_program)
select c.id, p.nama
from public.companies c
cross join (values
  ('IOAN'), ('MS ANPER'), ('MS EKSTERNAL'), ('MS NODE B'), ('MS SPBU'),
  ('OSP'), ('PROVISIONING'), ('PROVISIONING EBIS'), ('PROVISIONING WIBS'),
  ('PT2'), ('QE OLO'), ('QE RECOVERY'), ('SDI'), ('WAREHOUSE SERVICE')
) as p(nama)
on conflict (company_id, nama_program) do nothing;
