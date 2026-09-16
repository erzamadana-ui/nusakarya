-- 0033_tax_reference.sql
-- Tabel referensi tarif pajak yang BISA DITINJAU & DISAHKAN tim pajak, plus
-- penanda verifikasi pada ter_rates & tax_brackets_art17. Tarif PPN dan
-- PPh 23 yang sebelumnya tertulis sebagai konstanta di
-- apps/web-admin/src/modules/commerce/lib/constants.ts (PPN_RATE, PPH23_RATE)
-- dipindahkan ke sini agar terlihat & bisa diparaf, bukan tersembunyi di kode.
--
-- Semua baris referensi dimasukkan dengan is_verified = false: tim pajak
-- WAJIB memeriksa dan menandai verifikasi sebelum angka dipakai sebagai
-- dasar resmi pemotongan/pemungutan pajak.

-- =========================================================================
-- 1) Tabel baru: tax_rates_ref
-- =========================================================================
create table public.tax_rates_ref (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tax_code text not null,
  tax_name text not null,
  rate numeric not null,
  basis_note text,
  legal_basis text,
  source_url text,
  effective_from date not null default current_date,
  effective_to date,
  is_verified boolean not null default false,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_tax_rates_ref_company on tax_rates_ref(company_id);
create index idx_tax_rates_ref_code on tax_rates_ref(tax_code);
create trigger trg_tax_rates_ref_updated_at before update on tax_rates_ref
  for each row execute function set_updated_at();

comment on table tax_rates_ref is
  'Registri tarif pajak yang benar-benar dipakai aplikasi (PPN, PPh 23, PPh 21 bukan pegawai, PPh 21 TER, Pasal 17) — sumber tunggal untuk ditinjau & disahkan tim pajak. Lihat juga ter_rates (lapisan TER) dan tax_brackets_art17 (lapisan Pasal 17).';

-- =========================================================================
-- 2) Kolom verifikasi pada ter_rates & tax_brackets_art17 (bila belum ada)
-- =========================================================================
alter table public.ter_rates
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz,
  add column if not exists source_note text;
-- source_note pada ter_rates sudah ada sejak 0013_ter_rates_pmk168.sql — IF NOT EXISTS menjaga idempoten.

alter table public.tax_brackets_art17
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz,
  add column if not exists source_note text;
-- source_note pada tax_brackets_art17 sudah ada sejak 0018_payroll_freelance.sql — IF NOT EXISTS menjaga idempoten.

-- =========================================================================
-- 3) RLS — tax_rates_ref (modul FINANCE)
--    Ubah data: can_write('FINANCE'). Menandai terverifikasi (is_verified
--    berubah jadi true): hanya can_approve('FINANCE').
-- =========================================================================
alter table tax_rates_ref enable row level security;

create policy tax_rates_ref_select on tax_rates_ref for select
  using (company_id = auth_company_id() and can_read('FINANCE'));

create policy tax_rates_ref_insert on tax_rates_ref for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));

create policy tax_rates_ref_update on tax_rates_ref for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (
    company_id = auth_company_id() and can_write('FINANCE')
    and (is_verified = false or can_approve('FINANCE'))
  );

create policy tax_rates_ref_delete on tax_rates_ref for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- =========================================================================
-- 4) RLS — perketat UPDATE ter_rates & tax_brackets_art17 (modul PAYROLL,
--    mengikuti modul yang sudah mengelola kedua tabel ini) agar menandai
--    terverifikasi hanya boleh can_approve('PAYROLL').
-- =========================================================================
alter policy ter_rates_update on ter_rates
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (
    company_id = auth_company_id() and can_write('PAYROLL')
    and (is_verified = false or can_approve('PAYROLL'))
  );

alter policy tax_brackets_art17_update on tax_brackets_art17
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (
    company_id = auth_company_id() and can_write('PAYROLL')
    and (is_verified = false or can_approve('PAYROLL'))
  );

-- =========================================================================
-- 5) Seed tax_rates_ref — tarif yang BENAR-BENAR dipakai aplikasi saat ini.
--    Semua is_verified = false (belum dikonfirmasi tim pajak).
-- =========================================================================
with t_company as (select id from companies where code = 'NKMT' limit 1)
insert into tax_rates_ref
  (company_id, tax_code, tax_name, rate, basis_note, legal_basis, source_url, effective_from, is_verified, note)
select (select id from t_company), v.tax_code, v.tax_name, v.rate, v.basis_note, v.legal_basis, v.source_url, v.effective_from, false, v.note
from (values
  (
    'PPN_JASA', 'PPN atas Penyerahan Jasa (Efektif)', 0.11::numeric,
    'DPP = Nilai Penggantian/harga jual jasa. Dipakai di apps/web-admin/src/modules/commerce/lib/constants.ts (PPN_RATE) untuk menghitung PPN pada Invoice Commerce.',
    'UU No. 7/2021 tentang Harmonisasi Peraturan Perpajakan (HPP) Pasal 7 ayat (1) huruf a jo. PP No. 44 Tahun 2022 — tarif 11% berlaku efektif 1 April 2022.',
    'https://peraturan.bpk.go.id/Details/223395/uu-no-7-tahun-2021', date '2022-04-01',
    'Dipindahkan dari konstanta kode PPN_RATE. Ada wacana kenaikan tarif PPN 12% untuk kelompok barang/jasa tertentu mulai 2025 (PMK No. 131/PMK.010/2024) yang BELUM dikonfirmasi berlaku umum untuk jasa perusahaan ini — WAJIB dicek ulang oleh tim pajak sebelum dipakai menerbitkan faktur.'
  ),
  (
    'PPH23_JASA', 'PPh Pasal 23 atas Imbalan Jasa', 0.02::numeric,
    'DPP = bruto imbalan jasa (bukan objek PPh 21). Tarif menjadi 4% (2x lipat) bila penerima jasa tidak ber-NPWP — belum diimplementasikan di kode. Dipakai di apps/web-admin/src/modules/commerce/lib/constants.ts (PPH23_RATE) pada Invoice Commerce.',
    'UU No. 36 Tahun 2008 s.t.d.t.d. UU No. 7/2021 (HPP) Pasal 23 ayat (1) huruf c angka 2 jo. PMK No. 141/PMK.03/2015 tentang Jenis Jasa Lain.',
    'https://peraturan.bpk.go.id/Details/128554/pmk-no-141pmk032015', date '2015-08-24',
    'Dipindahkan dari konstanta kode PPH23_RATE. Pengecualian tarif 4% untuk lawan transaksi tanpa NPWP BELUM diterapkan — WAJIB ditinjau tim pajak.'
  ),
  (
    'PPH21_BUKAN_PEGAWAI', 'PPh 21 Bukan Pegawai (Mitra/Freelance) — DPP 50%', 0.05::numeric,
    'DPP = 50% x penghasilan bruto berkesinambungan. Tarif = lapisan Pasal 17 pertama yang mencakup nilai DPP masa berjalan (bukan kumulatif setahun); tarif x1,2 bila tanpa NPWP. Nilai kolom "tarif" = lapisan terendah (5%) sebagai representasi; tarif aktual bergantung DPP, lihat fungsi fn_hitung_pph21_bukan_pegawai().',
    'PER-16/PJ/2016 Pasal 3 & Pasal 9 jo. UU No. 7/2021 (HPP) Pasal 17 ayat (1) huruf a dan Pasal 21 ayat (5a) (tarif tidak ber-NPWP 20% lebih tinggi).',
    'https://pajak.go.id/id/peraturan-pajak', date '2016-05-29',
    'Fungsi fn_hitung_pph21_bukan_pegawai() (migrasi 0018) adalah PENYEDERHANAAN: memakai satu lapisan Pasal 17 atas DPP masa berjalan, BUKAN perhitungan kumulatif progresif setahun pajak. WAJIB diverifikasi ulang tim pajak/payroll sebelum dipakai sebagai dasar pemotongan resmi.'
  ),
  (
    'PPH21_PEGAWAI_TETAP_TER', 'PPh 21 Pegawai Tetap — Skema Tarif Efektif Rata-rata (TER) Bulanan', 0.34::numeric,
    'BUKAN tarif tunggal: tarif efektif dicari dari tabel ter_rates (kategori A/B/C sesuai status PTKP karyawan) pada lapisan yang memuat penghasilan bruto bulanan. Nilai kolom "tarif" = tarif lapisan tertinggi (langit-langit 34%). Lihat tab "TER PPh 21" untuk 125 lapisan lengkap (A=44, B=40, C=41).',
    'PP No. 58 Tahun 2023 jo. PMK No. 168/PMK.03/2023 tentang Tarif Pemotongan PPh Pasal 21 atas Penghasilan Sehubungan dengan Pekerjaan.',
    'https://pajak.go.id/sites/default/files/2024-02/PMK%20168%20Tahun%202023%20Tentang%20PPh%20Pasal%2021%20TER.pdf', date '2024-01-01',
    'Data 125 lapisan sudah diperbaiki ke Lampiran PMK 168/2023 pada migrasi 0013_ter_rates_pmk168.sql. Tetap WAJIB dicocokkan tim pajak ke PDF resmi via tab "TER PPh 21".'
  ),
  (
    'PPH_PASAL17_ORANG_PRIBADI', 'PPh Pasal 17 — Tarif Progresif Wajib Pajak Orang Pribadi', 0.35::numeric,
    'Tarif progresif 5 lapisan (5%, 15%, 25%, 30%, 35%) atas Penghasilan Kena Pajak kumulatif setahun. Nilai kolom "tarif" = lapisan tertinggi (35%). Dipakai sebagai dasar tarif PPh 21 bukan pegawai (atas DPP) di tax_brackets_art17.',
    'UU No. 7 Tahun 2021 tentang Harmonisasi Peraturan Perpajakan (HPP) Pasal 17 ayat (1) huruf a.',
    'https://peraturan.bpk.go.id/Details/223395/uu-no-7-tahun-2021', date '2022-01-01',
    'Lihat tab "Pasal 17" untuk 5 lapisan lengkap dari tabel tax_brackets_art17.'
  )
) as v(tax_code, tax_name, rate, basis_note, legal_basis, source_url, effective_from, note);

select count(*) as n_tax_rates_ref from tax_rates_ref;
