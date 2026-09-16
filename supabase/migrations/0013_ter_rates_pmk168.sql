-- 0013_ter_rates_pmk168.sql
-- Perbaikan tabel ter_rates: data lama hanya berisi 20 lapisan per kategori
-- dengan tarif maksimum 16-17%, yang TIDAK SESUAI dengan ketentuan resmi.
--
-- Data benar: Tarif Efektif Rata-rata (TER) Bulanan PPh Pasal 21 sesuai
-- PP 58 Tahun 2023 jo. PMK 168/PMK.03/2023 (Lampiran huruf A/B/C).
-- - TER A : 44 lapisan (PTKP TK/0, TK/1, K/0)
-- - TER B : 40 lapisan (PTKP TK/2, TK/3, K/1, K/2)
-- - TER C : 41 lapisan (PTKP K/3)
-- Tarif terendah 0%, tarif tertinggi 34% (bruto bulanan > Rp1.400.000.000
-- untuk kategori A, > Rp1.405.000.000 kategori B, > Rp1.419.000.000 kategori C).
--
-- Sumber (diambil 2026-09-16, dicocok-silang antar 3 sumber independen):
--   1) https://pajak.go.id/sites/default/files/2024-02/PMK%20168%20Tahun%202023%20Tentang%20PPh%20Pasal%2021%20TER.pdf
--      (Lampiran PMK 168/PMK.03/2023 - sumber resmi Direktorat Jenderal Pajak)
--   2) https://www.gadjian.com/perhitungan-pph-21/tarif-pajak
--   3) https://klikpajak.id/blog/pajak-penghasilan-pasal-21-2/
-- Referensi peraturan tambahan (untuk konteks, tidak difetch langsung karena
-- format tidak dapat diekstrak tool otomatis):
--   - https://jdih.kemenkeu.go.id/dok/pmk-168-tahun-2023/summary
--   - https://peraturan.bpk.go.id/Details/286951/pmk-no-168-tahun-2023
--
-- CATATAN VALIDASI: satu sumber pembanding (kalkupro.com) menampilkan pola
-- tarif yang BERBEDA (kenaikan flat 0,25% lalu lompat 15/20/25/30/34%,
-- jumlah lapisan A=42/B=39/C=41) yang TIDAK cocok dengan 3 sumber di atas.
-- Setelah verifikasi langsung ke PDF resmi pajak.go.id dan 2 sumber payroll
-- independen (gadjian.com, klikpajak.id) yang SEPAKAT satu sama lain, data
-- kalkupro.com dinyatakan keliru/kadaluarsa dan TIDAK dipakai.
--
-- Konvensi batas lapisan: batas_bawah lapisan (n+1) = batas_atas lapisan n + 1
-- (non-overlapping, inclusive kedua sisi), sesuai logika lookup aplikasi
-- (gross >= min_income AND gross <= max_income) di
-- apps/web-admin/src/modules/hr/lib/payrollCalc.ts. Batas atas lapisan
-- terakhir diisi 999999999999 (bukan NULL) sesuai instruksi tugas.

alter table public.ter_rates
  add column if not exists source_note text,
  add column if not exists effective_from date;

delete from public.ter_rates;

-- =========================================================================
-- TER A - PTKP TK/0, TK/1, K/0 (44 lapisan)
-- =========================================================================
insert into public.ter_rates (category, min_income, max_income, rate, source_note, effective_from) values
('A', 0, 5400000, 0.0000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 5400001, 5650000, 0.0025, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 5650001, 5950000, 0.0050, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 5950001, 6300000, 0.0075, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 6300001, 6750000, 0.0100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 6750001, 7500000, 0.0125, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 7500001, 8550000, 0.0150, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 8550001, 9650000, 0.0175, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 9650001, 10050000, 0.0200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 10050001, 10350000, 0.0225, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 10350001, 10700000, 0.0250, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 10700001, 11050000, 0.0300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 11050001, 11600000, 0.0350, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 11600001, 12500000, 0.0400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 12500001, 13750000, 0.0500, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 13750001, 15100000, 0.0600, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 15100001, 16950000, 0.0700, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 16950001, 19750000, 0.0800, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 19750001, 24150000, 0.0900, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 24150001, 26450000, 0.1000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 26450001, 28000000, 0.1100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 28000001, 30050000, 0.1200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 30050001, 32400000, 0.1300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 32400001, 35400000, 0.1400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 35400001, 39100000, 0.1500, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 39100001, 43850000, 0.1600, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 43850001, 47800000, 0.1700, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 47800001, 51400000, 0.1800, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 51400001, 56300000, 0.1900, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 56300001, 62200000, 0.2000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 62200001, 68600000, 0.2100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 68600001, 77500000, 0.2200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 77500001, 89000000, 0.2300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 89000001, 103000000, 0.2400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 103000001, 125000000, 0.2500, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 125000001, 157000000, 0.2600, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 157000001, 206000000, 0.2700, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 206000001, 337000000, 0.2800, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 337000001, 454000000, 0.2900, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 454000001, 550000000, 0.3000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 550000001, 695000000, 0.3100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 695000001, 910000000, 0.3200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 910000001, 1400000000, 0.3300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01'),
('A', 1400000001, 999999999999, 0.3400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran A', '2024-01-01');

-- =========================================================================
-- TER B - PTKP TK/2, TK/3, K/1, K/2 (40 lapisan)
-- =========================================================================
insert into public.ter_rates (category, min_income, max_income, rate, source_note, effective_from) values
('B', 0, 6200000, 0.0000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 6200001, 6500000, 0.0025, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 6500001, 6850000, 0.0050, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 6850001, 7300000, 0.0075, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 7300001, 9200000, 0.0100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 9200001, 10750000, 0.0150, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 10750001, 11250000, 0.0200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 11250001, 11600000, 0.0250, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 11600001, 12600000, 0.0300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 12600001, 13600000, 0.0400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 13600001, 14950000, 0.0500, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 14950001, 16400000, 0.0600, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 16400001, 18450000, 0.0700, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 18450001, 21850000, 0.0800, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 21850001, 26000000, 0.0900, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 26000001, 27700000, 0.1000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 27700001, 29350000, 0.1100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 29350001, 31450000, 0.1200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 31450001, 33950000, 0.1300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 33950001, 37100000, 0.1400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 37100001, 41100000, 0.1500, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 41100001, 45800000, 0.1600, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 45800001, 49500000, 0.1700, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 49500001, 53800000, 0.1800, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 53800001, 58500000, 0.1900, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 58500001, 64000000, 0.2000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 64000001, 71000000, 0.2100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 71000001, 80000000, 0.2200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 80000001, 93000000, 0.2300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 93000001, 109000000, 0.2400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 109000001, 129000000, 0.2500, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 129000001, 163000000, 0.2600, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 163000001, 211000000, 0.2700, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 211000001, 374000000, 0.2800, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 374000001, 459000000, 0.2900, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 459000001, 555000000, 0.3000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 555000001, 704000000, 0.3100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 704000001, 957000000, 0.3200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 957000001, 1405000000, 0.3300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01'),
('B', 1405000001, 999999999999, 0.3400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran B', '2024-01-01');

-- =========================================================================
-- TER C - PTKP K/3 (41 lapisan)
-- =========================================================================
insert into public.ter_rates (category, min_income, max_income, rate, source_note, effective_from) values
('C', 0, 6600000, 0.0000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 6600001, 6950000, 0.0025, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 6950001, 7350000, 0.0050, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 7350001, 7800000, 0.0075, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 7800001, 8850000, 0.0100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 8850001, 9800000, 0.0125, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 9800001, 10950000, 0.0150, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 10950001, 11200000, 0.0175, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 11200001, 12050000, 0.0200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 12050001, 12950000, 0.0300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 12950001, 14150000, 0.0400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 14150001, 15550000, 0.0500, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 15550001, 17050000, 0.0600, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 17050001, 19500000, 0.0700, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 19500001, 22700000, 0.0800, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 22700001, 26600000, 0.0900, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 26600001, 28100000, 0.1000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 28100001, 30100000, 0.1100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 30100001, 32600000, 0.1200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 32600001, 35400000, 0.1300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 35400001, 38900000, 0.1400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 38900001, 43000000, 0.1500, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 43000001, 47400000, 0.1600, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 47400001, 51200000, 0.1700, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 51200001, 55800000, 0.1800, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 55800001, 60400000, 0.1900, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 60400001, 66700000, 0.2000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 66700001, 74500000, 0.2100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 74500001, 83200000, 0.2200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 83200001, 95600000, 0.2300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 95600001, 110000000, 0.2400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 110000001, 134000000, 0.2500, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 134000001, 169000000, 0.2600, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 169000001, 221000000, 0.2700, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 221000001, 390000000, 0.2800, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 390000001, 463000000, 0.2900, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 463000001, 561000000, 0.3000, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 561000001, 709000000, 0.3100, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 709000001, 965000000, 0.3200, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 965000001, 1419000000, 0.3300, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01'),
('C', 1419000001, 999999999999, 0.3400, 'PP 58/2023 jo. PMK 168/PMK.03/2023 Lampiran C', '2024-01-01');
