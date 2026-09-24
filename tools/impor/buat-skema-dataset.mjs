#!/usr/bin/env node
/**
 * NUSAKARYA — pembangkit spesifikasi dataset Pusat Impor Data.
 *
 * Masukan : tools/impor/introspeksi.json (hasil tools/impor/introspeksi.sql, SELECT-only).
 * Keluaran: apps/web-admin/src/modules/impor/lib/skema-dataset.ts
 *
 * Yang DIAMBIL OTOMATIS dari skema basis data:
 *   - daftar kolom dan urutannya                  (information_schema.columns)
 *   - tipe kolom                                   (udt_name)
 *   - wajib / tidak                                (is_nullable + column_default)
 *   - daftar nilai sah                             (pg_constraint, CHECK ... = ANY (ARRAY[...]))
 *   - kolom penunjuk (FK) dan tabel tujuannya      (pg_constraint contype='f')
 *   - kunci alami untuk upsert                     (indeks unik)
 *
 * Yang ditulis manusia di berkas ini (tidak ada di basis data):
 *   - label Bahasa Indonesia (lewat KAMUS, per nama kolom — bukan per dataset)
 *   - dataset mana yang dipakai, urutan kolomnya, dan 2 baris contoh
 *
 * Jalankan: node tools/impor/buat-skema-dataset.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const AKAR = path.resolve(DIR, '../..')
const SUMBER = path.join(DIR, 'introspeksi.json')
const TUJUAN = path.join(AKAR, 'apps/web-admin/src/modules/impor/lib/skema-dataset.ts')

/* ---------------------------------------------------------------- kamus label */
/** Label Bahasa Indonesia per NAMA KOLOM. Dipakai untuk semua dataset sekaligus. */
const KAMUS = {
  code: 'Kode', kode: 'Kode', name: 'Nama', nama: 'Nama', city: 'Kota', province: 'Provinsi',
  lat: 'Lintang (Latitude)', lng: 'Bujur (Longitude)', is_active: 'Aktif', address: 'Alamat',
  phone: 'Telepon', email: 'Email', npwp: 'NPWP', pic_name: 'Nama PIC', status: 'Status',
  payment_term_days: 'Termin Bayar (hari)', customer_type: 'Jenis Pelanggan',
  vendor_type: 'Jenis Vendor', pkp: 'PKP', bank_name: 'Nama Bank', bank_account: 'Nomor Rekening',
  bank_holder: 'Atas Nama Rekening', rating: 'Rating',
  category: 'Kategori', uom: 'Satuan', last_price: 'Harga Terakhir',
  is_serial_tracked: 'Dilacak Nomor Seri', is_consignment: 'Barang Konsinyasi',
  principal: 'Principal', min_stock: 'Stok Minimum',
  warehouse_type: 'Jenis Gudang', branch_id: 'Cabang',
  point_weight: 'Bobot Poin', standard_minutes: 'Durasi Standar (menit)',
  tariff_amount: 'Tarif (Rp)', price_source: 'Sumber Harga', price_source_ref: 'Rujukan Sumber Harga',
  contract_id: 'Kontrak', job_type_id: 'Jenis Pekerjaan', item_code: 'Kode Item',
  description: 'Keterangan', unit_price: 'Harga Satuan (Rp)',
  employee_id: 'Karyawan', vendor_id: 'Vendor', rate_amount: 'Tarif per Satuan (Rp)',
  min_qty: 'Kuantitas Minimum', effective_date: 'Berlaku Mulai', end_date: 'Berlaku Sampai',
  note: 'Catatan',
  element_type: 'Jenis Elemen', parent_id: 'Induk (kode elemen)', sto: 'STO',
  capacity: 'Kapasitas', used: 'Terpakai', install_date: 'Tanggal Pasang',
  asset_no: 'Nomor Aset', item_id: 'Item Katalog', asset_name: 'Nama Aset',
  asset_category: 'Kategori Aset', brand: 'Merek', model: 'Model', serial_no: 'Nomor Seri',
  purchase_date: 'Tanggal Beli', purchase_price: 'Harga Beli (Rp)',
  useful_life_months: 'Masa Manfaat (bulan)', depreciation_method: 'Metode Penyusutan',
  book_value: 'Nilai Buku (Rp)', condition: 'Kondisi', warehouse_id: 'Gudang',
  holder_employee_id: 'Pemegang (karyawan)',
  component_type: 'Jenis Komponen', calc_type: 'Cara Hitung', taxable: 'Kena Pajak',
  is_bpjs_base: 'Dasar BPJS', default_amount: 'Nominal Bawaan (Rp)', formula: 'Rumus',
  account_code: 'Kode Akun', account_name: 'Nama Akun', account_type: 'Jenis Akun',
  parent_code: 'Kode Induk', normal_balance: 'Saldo Normal', is_postable: 'Bisa Dijurnal',
  vacancy_id: 'Lowongan', full_name: 'Nama Lengkap', education: 'Pendidikan',
  experience_years: 'Pengalaman (tahun)', source: 'Sumber Pelamar', stage: 'Tahap Seleksi',
  score: 'Nilai',
  start_time: 'Jam Mulai', end_time: 'Jam Selesai',
  required_for_positions: 'Wajib untuk Jabatan', aspect: 'Aspek', ref_group: 'Kelompok Referensi',
  sort_order: 'Urutan Tampil', psa: 'PSA',
  object_id: 'Object ID (17 digit / MTR-0000)', nik: 'NIK Telkom', gaji: 'Gaji (Rp)',
  position_name: 'Nama Posisi', position_title: 'Jabatan', kemitraan: 'Kemitraan',
  branch: 'Cabang (nama/kode)', level_jabatan: 'Level Jabatan', group_wfp: 'Group WFP',
  sub_group: 'Sub Group', group_fungsi: 'Group Fungsi', portofolio: 'Portofolio',
  status_teknisi: 'Status Teknisi', status_salary: 'Status Gaji', nama_program: 'Nama Program',
  sto_kode: 'Kode STO', status_penugasan: 'Status Penugasan', skill: 'Skill (pisahkan dengan |)',
  sektor_ditangani: 'Sektor Ditangani (pisahkan dengan |)',
  nip: 'NIP / No. Karyawan', gender: 'Jenis Kelamin (L/P)', birth_date: 'Tanggal Lahir', position: 'Jabatan',
  unit: 'Unit', employment_type: 'Status Kerja', join_date: 'Tanggal Masuk', contract_start: 'Awal Kontrak',
  contract_end: 'Akhir Kontrak', ptkp_status: 'Status PTKP', nik_ktp: 'NIK KTP', bpjs_tk_no: 'No. BPJS Ketenagakerjaan',
  bpjs_kes_no: 'No. BPJS Kesehatan', payroll_scheme: 'Skema Payroll', nik_telkom: 'NIK Telkom',
  contract_no: 'Nomor Kontrak', contract_name: 'Nama Kontrak', customer_id: 'Pelanggan', contract_type: 'Jenis Kontrak',
  start_date: 'Tanggal Mulai', contract_value: 'Nilai Kontrak (Rp)', retention_percent: 'Retensi (%)',
  wo_no: 'Nomor WO', wo_type: 'Jenis WO', title: 'Judul Pekerjaan', customer_name: 'Nama Pelanggan',
  customer_no: 'No. Pelanggan / Layanan', scheduled_at: 'Jadwal (tanggal jam)', assigned_to: 'Teknisi (NIP/nama)',
  started_at: 'Mulai Dikerjakan', finished_at: 'Selesai Dikerjakan', fail_reason: 'Alasan Gagal', result_note: 'Catatan Hasil',
  qc_status: 'Status QC', qc_note: 'Catatan QC', amount: 'Nilai Pekerjaan (Rp)', points: 'Poin',
  inv_no: 'Nomor Invoice', invoice_date: 'Tanggal Invoice', due_date: 'Jatuh Tempo', dpp: 'DPP (Rp)', ppn: 'PPN (Rp)',
  pph23: 'PPh 23 (Rp)', total: 'Total (Rp)', paid_amount: 'Sudah Dibayar (Rp)', faktur_pajak_no: 'No. Faktur Pajak',
  qty: 'Jumlah Stok', qty_reserved: 'Stok Dipesan', avg_price: 'Harga Rata-rata (Rp)',
}
const labelKolom = (c) => KAMUS[c] ?? c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

/** Bagaimana nilai teks pada berkas dicocokkan ke baris tabel tujuan sebuah kolom FK. */
const LOOKUP = {
  branches: { kolomCari: ['name', 'code', 'city'], label: 'Cabang' },
  employees: { kolomCari: ['nip', 'nik_telkom', 'full_name'], label: 'Karyawan' },
  item_catalog: { kolomCari: ['code', 'name'], label: 'Item katalog' },
  warehouses: { kolomCari: ['code', 'name'], label: 'Gudang' },
  job_types: { kolomCari: ['code', 'name'], label: 'Jenis pekerjaan' },
  vendors: { kolomCari: ['code', 'name'], label: 'Vendor' },
  contracts: { kolomCari: ['contract_no', 'contract_name'], label: 'Kontrak' },
  job_vacancies: { kolomCari: ['vacancy_no', 'title', 'position'], label: 'Lowongan' },
  network_elements: { kolomCari: ['code', 'name'], label: 'Elemen jaringan' },
  sto_ref: { kolomCari: ['kode', 'nama'], label: 'STO' },
  program_ref: { kolomCari: ['nama_program'], label: 'Program' },
  customers: { kolomCari: ['code', 'name'], label: 'Pelanggan' },
}

/** Kolom yang selalu diisi sistem — tidak pernah muncul di template. */
const SISTEM = new Set(['id', 'company_id', 'created_at', 'updated_at', 'created_by'])

/* ------------------------------------------------------------- daftar dataset */
/** Hanya memilih dataset + urutan kolom + contoh. Sifat kolom diambil dari skema. */
const DATASET = [
  {
    kode: 'branches', tabel: 'branches', modul: 'CORE', label: 'Cabang',
    keterangan: 'Kantor cabang / area operasi. Isi ini paling dulu — banyak dataset lain merujuk nama cabang.',
    ambil: ['code', 'name', 'city', 'province', 'lat', 'lng', 'is_active'],
    contoh: [
      { code: 'PDG', name: 'Cabang Padang', city: 'Padang', province: 'Sumatera Barat', lat: '-0.947083', lng: '100.417181', is_active: 'ya' },
      { code: 'PBR', name: 'Cabang Pekanbaru', city: 'Pekanbaru', province: 'Riau', lat: '0.507068', lng: '101.447777', is_active: 'ya' },
    ],
  },
  {
    kode: 'karyawan_wfp', tabel: 'stg_wfp', modul: 'HR', khusus: 'wfp',
    label: 'Karyawan & Formasi (WFP)',
    keterangan: 'Data karyawan dan formasi jabatan dari berkas WFP. Diunggah ke tabel singgah stg_wfp, lalu diolah sistem menjadi data karyawan, formasi jabatan, dan antrean kerja HR.',
    catatan: 'Pemuatan WFP memakai tabel singgah stg_wfp yang aksesnya dibatasi di sisi basis data. Bila muncul pesan "Anda tidak berwenang mengisi data ini", mintalah Super Admin menjalankan impor ini. Satu berkas = satu angkatan: isi tabel singgah sebelumnya dibersihkan lebih dulu.',
    cekDari: ['employees', 'employee_positions'],
    nilaiSahTambahan: { group_wfp: ['TELKOM AKSES'] },
    wajibTambahan: ['nik', 'nama'],
    ambil: ['object_id', 'nik', 'nama', 'position_name', 'position_title', 'branch', 'gaji',
      'kemitraan', 'level_jabatan', 'group_wfp', 'group_fungsi', 'sub_group', 'psa', 'portofolio',
      'status_teknisi', 'status_salary', 'status_penugasan', 'nama_program', 'sto', 'sto_kode',
      'skill', 'sektor_ditangani'],
    contoh: [
      { object_id: '10000000000000123', nik: '970123', nama: 'Rizky Pratama', position_name: 'TEKNISI SDI', position_title: 'Teknisi Fiber Optic', branch: 'Cabang Padang', gaji: '4500000', kemitraan: 'TELKOM AKSES', level_jabatan: 'STAFF', group_wfp: 'RKAP', group_fungsi: 'SDI', sub_group: 'SDI PADANG', psa: 'PADANG', portofolio: 'ACCESS', status_teknisi: 'RESOURCE BASED', status_salary: 'FIXED', status_penugasan: 'DEFINITIF', nama_program: 'PSB DIGITAL', sto: 'PADANG', sto_kode: 'PDG', skill: 'SPLICING | OTDR', sektor_ditangani: 'PADANG BARAT | PADANG UTARA' },
      { object_id: 'MTR-0042', nik: '880457', nama: 'Dewi Anggraini', position_name: 'ADMIN ASSURANCE', position_title: 'Admin Assurance', branch: 'Cabang Pekanbaru', gaji: '3800000', kemitraan: 'MITRA', level_jabatan: 'STAFF', group_wfp: 'MITRA', group_fungsi: 'BUSINESS SUPPORT', sub_group: 'ASSURANCE PEKANBARU', psa: 'PEKANBARU', portofolio: 'ACCESS', status_teknisi: 'PERFORMANCE BASED', status_salary: 'VARIABLE', status_penugasan: 'PGS', nama_program: 'ASSURANCE IndiHome', sto: 'PEKANBARU KOTA', sto_kode: 'PKU', skill: 'HELPDESK', sektor_ditangani: 'PEKANBARU KOTA' },
    ],
  },
  {
    kode: 'employees', tabel: 'employees', modul: 'HR', label: 'Karyawan & Teknisi',
    keterangan: 'Data karyawan tetap, kontrak, teknisi, dan mitra perorangan. NIP dipakai sebagai kunci — impor ulang memperbarui data lama.',
    ambil: ['nip', 'full_name', 'gender', 'birth_date', 'phone', 'email', 'address', 'branch_id', 'position', 'unit',
      'employment_type', 'join_date', 'contract_start', 'contract_end', 'status', 'ptkp_status', 'npwp', 'nik_ktp',
      'bank_name', 'bank_account', 'bank_holder', 'bpjs_tk_no', 'bpjs_kes_no', 'payroll_scheme', 'nik_telkom', 'skill'],
    contoh: [
      { nip: 'TK-0001', full_name: 'Rizky Pratama', gender: 'L', birth_date: '1995-04-12', phone: '081234567890', email: 'rizky@contoh.id', address: 'Jl. Contoh No. 1, Padang', branch_id: 'Cabang Padang', position: 'Teknisi Fiber Optic', unit: 'OPERATIONS', employment_type: 'PKWT', join_date: '2025-01-06', contract_start: '2025-01-06', contract_end: '2026-12-31', status: 'aktif', ptkp_status: 'TK/0', npwp: '', nik_ktp: '', bank_name: 'Bank Mandiri', bank_account: '', bank_holder: 'Rizky Pratama', bpjs_tk_no: '', bpjs_kes_no: '', payroll_scheme: 'fix_salary', nik_telkom: '', skill: 'SPLICING | OTDR' },
      { nip: 'TK-0002', full_name: 'Dewi Anggraini', gender: 'P', birth_date: '1997-09-02', phone: '081298765432', email: '', address: 'Pekanbaru', branch_id: 'Cabang Pekanbaru', position: 'Admin Assurance', unit: 'OPERATIONS', employment_type: 'PKWTT', join_date: '2024-03-01', contract_start: '', contract_end: '', status: 'aktif', ptkp_status: 'K/1', npwp: '', nik_ktp: '', bank_name: 'Bank BRI', bank_account: '', bank_holder: 'Dewi Anggraini', bpjs_tk_no: '', bpjs_kes_no: '', payroll_scheme: 'fix_salary', nik_telkom: '', skill: 'HELPDESK' },
    ],
  },
  {
    kode: 'customers', tabel: 'customers', modul: 'COMMERCE', label: 'Pelanggan & Principal',
    keterangan: 'Pemberi kerja: principal (mis. Telkom Akses), korporat, dan retail.',
    ambil: ['code', 'name', 'customer_type', 'npwp', 'address', 'city', 'phone', 'email', 'pic_name', 'payment_term_days', 'status'],
    contoh: [
      { code: 'TA-SBT', name: 'PT Telkom Akses Witel Sumbar', customer_type: 'principal', npwp: '01.234.567.8-201.000', address: 'Jl. Khatib Sulaiman No. 47', city: 'Padang', phone: '0751-7051234', email: 'procurement.sumbar@telkomakses.co.id', pic_name: 'Bapak Hendra Gunawan', payment_term_days: '45', status: 'aktif' },
      { code: 'PLN-RIAU', name: 'PT PLN (Persero) UIW Riau', customer_type: 'korporat', npwp: '02.345.678.9-216.000', address: 'Jl. Jenderal Sudirman No. 315', city: 'Pekanbaru', phone: '0761-33333', email: 'pengadaan.riau@pln.co.id', pic_name: 'Ibu Siti Rahmawati', payment_term_days: '30', status: 'aktif' },
    ],
  },
  {
    kode: 'vendors', tabel: 'vendors', modul: 'PROCUREMENT', label: 'Vendor & Subkontraktor',
    keterangan: 'Pemasok material, penyedia jasa, subkontraktor, dan penyedia sewa.',
    ambil: ['code', 'name', 'vendor_type', 'npwp', 'pkp', 'address', 'city', 'phone', 'email', 'pic_name', 'bank_name', 'bank_account', 'bank_holder', 'payment_term_days', 'rating', 'status'],
    contoh: [
      { code: 'VND-001', name: 'CV Sinar Optik Nusantara', vendor_type: 'material', npwp: '03.456.789.0-201.000', pkp: 'ya', address: 'Jl. By Pass KM 12', city: 'Padang', phone: '0751-461200', email: 'sales@sinaroptik.co.id', pic_name: 'Bapak Andi Saputra', bank_name: 'Bank Mandiri', bank_account: '1110002223334', bank_holder: 'CV Sinar Optik Nusantara', payment_term_days: '30', rating: '4.5', status: 'aktif' },
      { code: 'VND-002', name: 'PT Karya Jaya Instalasi', vendor_type: 'subkon', npwp: '04.567.890.1-216.000', pkp: 'tidak', address: 'Jl. Soekarno Hatta No. 88', city: 'Pekanbaru', phone: '0761-882100', email: 'admin@karyajaya.id', pic_name: 'Ibu Lina Marlina', bank_name: 'Bank BRI', bank_account: '020801000123456', bank_holder: 'PT Karya Jaya Instalasi', payment_term_days: '45', rating: '4', status: 'aktif' },
    ],
  },
  {
    kode: 'item_catalog', tabel: 'item_catalog', modul: 'PROCUREMENT', label: 'Katalog Item',
    keterangan: 'Daftar material, perangkat NTE, aset, dan jasa yang dibeli atau dipakai.',
    ambil: ['code', 'name', 'category', 'uom', 'last_price', 'is_serial_tracked', 'is_consignment', 'principal', 'min_stock', 'is_active'],
    contoh: [
      { code: 'NTE-ONT-001', name: 'ONT ZTE F670L Dual Band', category: 'NTE', uom: 'unit', last_price: '525000', is_serial_tracked: 'ya', is_consignment: 'ya', principal: 'Telkom Akses', min_stock: '50', is_active: 'ya' },
      { code: 'MAT-DC12-001', name: 'Kabel Drop Core 1 Core 2FO Precon 80m', category: 'NON_NTE', uom: 'roll', last_price: '145000', is_serial_tracked: 'tidak', is_consignment: 'tidak', principal: '', min_stock: '200', is_active: 'ya' },
    ],
  },
  {
    kode: 'warehouses', tabel: 'warehouses', modul: 'INVENTORY', label: 'Gudang',
    keterangan: 'Gudang pusat, gudang cabang, gudang mobil, dan stok bawaan teknisi.',
    ambil: ['code', 'name', 'warehouse_type', 'branch_id', 'address', 'lat', 'lng', 'is_active'],
    contoh: [
      { code: 'GD-PDG-01', name: 'Gudang Pusat Padang', warehouse_type: 'pusat', branch_id: 'Cabang Padang', address: 'Jl. Raya Bypass KM 9, Padang', lat: '-0.911000', lng: '100.400000', is_active: 'ya' },
      { code: 'GD-PBR-01', name: 'Gudang Cabang Pekanbaru', warehouse_type: 'branch', branch_id: 'Cabang Pekanbaru', address: 'Jl. Riau No. 120, Pekanbaru', lat: '0.520000', lng: '101.430000', is_active: 'ya' },
    ],
  },
  {
    kode: 'job_types', tabel: 'job_types', modul: 'OPERATIONS', label: 'Jenis Pekerjaan',
    keterangan: 'Katalog pekerjaan lapangan beserta bobot poin dan tarifnya.',
    ambil: ['code', 'name', 'category', 'point_weight', 'standard_minutes', 'tariff_amount', 'is_active', 'price_source', 'price_source_ref'],
    contoh: [
      { code: 'PSB-FTTH', name: 'Pasang Baru FTTH Pelanggan', category: 'PROVISIONING', point_weight: '1', standard_minutes: '120', tariff_amount: '85000', is_active: 'ya', price_source: 'kontrak', price_source_ref: 'SPK-2026-014 Lampiran A' },
      { code: 'GGN-DROP', name: 'Perbaikan Gangguan Kabel Drop', category: 'ASSURANCE', point_weight: '0.75', standard_minutes: '90', tariff_amount: '60000', is_active: 'ya', price_source: 'kontrak', price_source_ref: 'SPK-2026-014 Lampiran B' },
    ],
  },
  {
    kode: 'contract_price_list', tabel: 'contract_price_list', modul: 'COMMERCE', label: 'Price List Kontrak',
    keterangan: 'Harga satuan per jenis pekerjaan pada sebuah kontrak pelanggan.',
    ambil: ['contract_id', 'job_type_id', 'item_code', 'description', 'uom', 'unit_price', 'is_active', 'price_source', 'price_source_ref'],
    contoh: [
      { contract_id: 'KTR-2026-001', job_type_id: 'PSB-FTTH', item_code: 'A.1.1', description: 'Instalasi FTTH pelanggan baru termasuk terminasi', uom: 'SSL', unit_price: '185000', is_active: 'ya', price_source: 'kontrak', price_source_ref: 'Lampiran A hal. 3' },
      { contract_id: 'KTR-2026-001', job_type_id: 'GGN-DROP', item_code: 'B.2.4', description: 'Penggantian kabel drop core putus', uom: 'titik', unit_price: '125000', is_active: 'ya', price_source: 'kontrak', price_source_ref: 'Lampiran B hal. 7' },
    ],
  },
  {
    kode: 'freelance_rate_cards', tabel: 'freelance_rate_cards', modul: 'PAYROLL', label: 'Rate Card Mitra Freelance',
    keterangan: 'Tarif borongan per jenis pekerjaan untuk mitra perorangan atau vendor. Isi salah satu saja: Karyawan ATAU Vendor.',
    ambil: ['employee_id', 'vendor_id', 'job_type_id', 'rate_amount', 'min_qty', 'effective_date', 'end_date', 'is_active', 'note', 'price_source', 'price_source_ref'],
    contoh: [
      { employee_id: '970123', vendor_id: '', job_type_id: 'PSB-FTTH', rate_amount: '65000', min_qty: '0', effective_date: '2026-01-01', end_date: '', is_active: 'ya', note: 'Tarif mitra perorangan area Padang', price_source: 'negosiasi', price_source_ref: 'Nota kesepakatan 12 Des 2025' },
      { employee_id: '', vendor_id: 'VND-002', job_type_id: 'GGN-DROP', rate_amount: '48000', min_qty: '10', effective_date: '2026-01-01', end_date: '2026-12-31', is_active: 'ya', note: 'Paket subkon assurance Pekanbaru', price_source: 'kontrak', price_source_ref: 'PKS-SUB-2026-003' },
    ],
  },
  {
    kode: 'network_elements', tabel: 'network_elements', modul: 'OPERATIONS', label: 'Aset Jaringan',
    keterangan: 'Elemen jaringan fiber optic: OLT, FDT, ODC, ODP, FAT, closure, tiang, dan segmen kabel.',
    ambil: ['element_type', 'code', 'name', 'parent_id', 'branch_id', 'sto', 'lat', 'lng', 'capacity', 'used', 'status', 'install_date'],
    contoh: [
      { element_type: 'ODC', code: 'ODC-PDG-001', name: 'ODC Khatib Sulaiman', parent_id: '', branch_id: 'Cabang Padang', sto: 'PDG', lat: '-0.928400', lng: '100.361200', capacity: '288', used: '196', status: 'aktif', install_date: '2024-05-12' },
      { element_type: 'ODP', code: 'ODP-PDG-001-07', name: 'ODP Jl. Ujung Gurun 07', parent_id: 'ODC-PDG-001', branch_id: 'Cabang Padang', sto: 'PDG', lat: '-0.940100', lng: '100.362800', capacity: '16', used: '14', status: 'aktif', install_date: '2024-06-03' },
    ],
  },
  {
    kode: 'assets', tabel: 'assets', modul: 'ASSET', label: 'Daftar Aset',
    keterangan: 'Kendaraan, alat ukur, tools, perangkat IT, dan aset tetap lain milik perusahaan.',
    ambil: ['asset_no', 'asset_name', 'item_id', 'asset_category', 'brand', 'model', 'serial_no',
      'purchase_date', 'purchase_price', 'useful_life_months', 'depreciation_method', 'book_value',
      'condition', 'status', 'warehouse_id', 'branch_id', 'holder_employee_id', 'note'],
    contoh: [
      { asset_no: 'AST-KND-001', asset_name: 'Mobil Operasional Daihatsu Gran Max', item_id: '', asset_category: 'kendaraan', brand: 'Daihatsu', model: 'Gran Max Blind Van', serial_no: 'BA 8123 KX', purchase_date: '2024-02-15', purchase_price: '175000000', useful_life_months: '96', depreciation_method: 'garis_lurus', book_value: '148000000', condition: 'baik', status: 'dipakai', warehouse_id: 'GD-PDG-01', branch_id: 'Cabang Padang', holder_employee_id: '970123', note: 'Kendaraan tim SDI Padang' },
      { asset_no: 'AST-ALT-004', asset_name: 'OTDR EXFO MaxTester 715D', item_id: '', asset_category: 'alat_ukur', brand: 'EXFO', model: 'MaxTester 715D', serial_no: 'EXF715D-20240912', purchase_date: '2024-09-12', purchase_price: '62000000', useful_life_months: '60', depreciation_method: 'garis_lurus', book_value: '48000000', condition: 'baik', status: 'tersedia', warehouse_id: 'GD-PBR-01', branch_id: 'Cabang Pekanbaru', holder_employee_id: '', note: 'Kalibrasi terakhir Agustus 2026' },
    ],
  },
  {
    kode: 'salary_components', tabel: 'salary_components', modul: 'PAYROLL', label: 'Komponen Gaji',
    keterangan: 'Komponen penambah dan pemotong pada slip gaji.',
    ambil: ['code', 'name', 'component_type', 'calc_type', 'taxable', 'is_bpjs_base', 'default_amount', 'formula', 'is_active'],
    contoh: [
      { code: 'GAPOK', name: 'Gaji Pokok', component_type: 'earning', calc_type: 'fixed', taxable: 'ya', is_bpjs_base: 'ya', default_amount: '4000000', formula: '', is_active: 'ya' },
      { code: 'TRANS', name: 'Tunjangan Transport Lapangan', component_type: 'earning', calc_type: 'manual', taxable: 'ya', is_bpjs_base: 'tidak', default_amount: '25000', formula: '', is_active: 'ya' },
    ],
  },
  {
    kode: 'chart_of_accounts', tabel: 'chart_of_accounts', modul: 'FINANCE', label: 'Bagan Akun (COA)',
    keterangan: 'Daftar akun buku besar beserta jenis dan saldo normalnya.',
    ambil: ['account_code', 'account_name', 'account_type', 'parent_code', 'normal_balance', 'is_postable', 'is_active'],
    contoh: [
      { account_code: '1-1200', account_name: 'Piutang Usaha', account_type: 'aset', parent_code: '1-1000', normal_balance: 'debit', is_postable: 'ya', is_active: 'ya' },
      { account_code: '5-2100', account_name: 'Beban Jasa Subkontraktor', account_type: 'beban', parent_code: '5-2000', normal_balance: 'debit', is_postable: 'ya', is_active: 'ya' },
    ],
  },
  {
    kode: 'job_applicants', tabel: 'job_applicants', modul: 'HR', label: 'Pelamar Kerja',
    keterangan: 'Daftar pelamar pada lowongan yang sedang dibuka.',
    ambil: ['vacancy_id', 'full_name', 'email', 'phone', 'education', 'experience_years', 'source', 'stage', 'score', 'note'],
    contoh: [
      { vacancy_id: 'LOW-2026-001', full_name: 'Fajar Nugroho', email: 'fajar.nugroho@email.com', phone: '081234567890', education: 'D3 Teknik Telekomunikasi', experience_years: '2', source: 'Job fair Padang', stage: 'seleksi_berkas', score: '78', note: 'Sudah punya sertifikat splicing' },
      { vacancy_id: 'LOW-2026-001', full_name: 'Nurul Hidayah', email: 'nurul.hidayah@email.com', phone: '081298765432', education: 'S1 Teknik Elektro', experience_years: '4', source: 'Referensi karyawan', stage: 'wawancara', score: '85', note: 'Pengalaman OLT dan NMS' },
    ],
  },
  {
    kode: 'shifts', tabel: 'shifts', modul: 'HR', label: 'Shift Kerja',
    keterangan: 'Pola jam kerja untuk roster teknisi dan tim assurance.',
    ambil: ['code', 'name', 'start_time', 'end_time'],
    contoh: [
      { code: 'P', name: 'Shift Pagi', start_time: '08:00', end_time: '16:00' },
      { code: 'M', name: 'Shift Malam', start_time: '22:00', end_time: '06:00' },
    ],
  },
  {
    kode: 'competencies', tabel: 'competencies', modul: 'HR', label: 'Kompetensi & Sertifikasi',
    keterangan: 'Daftar kompetensi teknis, K3, manajerial, dan sertifikasi yang dipantau HR.',
    ambil: ['code', 'name', 'category', 'description', 'required_for_positions'],
    contoh: [
      { code: 'KMP-SPL', name: 'Splicing Fiber Optic', category: 'teknis', description: 'Mampu melakukan penyambungan serat optik dengan fusion splicer dan verifikasi OTDR', required_for_positions: 'Teknisi Fiber Optic | Teknisi SDI' },
      { code: 'KMP-K3K', name: 'K3 Kerja di Ketinggian', category: 'K3', description: 'Sertifikasi kerja di ketinggian untuk penarikan kabel udara', required_for_positions: 'Teknisi Fiber Optic | Pengawas Lapangan' },
    ],
  },
  {
    kode: 'root_causes', tabel: 'root_causes', modul: 'OPERATIONS', label: 'Akar Masalah (RCA)',
    keterangan: 'Katalog akar masalah 4 aspek untuk analisis gangguan dan insiden.',
    ambil: ['code', 'name', 'aspect', 'description'],
    contoh: [
      { code: 'RC-P01', name: 'Kesalahan prosedur terminasi', aspect: 'Process', description: 'Terminasi konektor tidak mengikuti SOP sehingga redaman melebihi ambang' },
      { code: 'RC-T02', name: 'Alat ukur belum dikalibrasi', aspect: 'Tools', description: 'OTDR atau OPM melewati jadwal kalibrasi sehingga hasil ukur meragukan' },
    ],
  },
  {
    kode: 'master_references', tabel: 'master_references', modul: 'CORE', label: 'Data Master Referensi',
    keterangan: 'Daftar nilai referensi bersama: STO, area, kategori gangguan, jenis material, bank, dan satuan.',
    ambil: ['ref_group', 'code', 'name', 'parent_code', 'sort_order', 'is_active'],
    contoh: [
      { ref_group: 'KATEGORI_GANGGUAN', code: 'KBL-PUTUS', name: 'Kabel Putus', parent_code: '', sort_order: '1', is_active: 'ya' },
      { ref_group: 'SATUAN', code: 'SSL', name: 'Satuan Sambungan Layanan', parent_code: '', sort_order: '5', is_active: 'ya' },
    ],
  },
  {
    kode: 'sto_ref', tabel: 'sto_ref', modul: 'CORE', label: 'Referensi STO',
    keterangan: 'Sentral Telepon Otomat beserta PSA dan cabang pengelolanya.',
    ambil: ['kode', 'nama', 'psa', 'branch_id', 'is_active'],
    contoh: [
      { kode: 'PDG', nama: 'STO Padang', psa: 'PADANG', branch_id: 'Cabang Padang', is_active: 'ya' },
      { kode: 'PKU', nama: 'STO Pekanbaru Kota', psa: 'PEKANBARU', branch_id: 'Cabang Pekanbaru', is_active: 'ya' },
    ],
  },
  {
    kode: 'contracts', tabel: 'contracts', modul: 'COMMERCE', label: 'Kontrak',
    keterangan: 'Kontrak/PKS dengan pemberi kerja. Isi Pelanggan lebih dulu. Nomor kontrak dipakai sebagai kunci.',
    ambil: ['contract_no', 'contract_name', 'customer_id', 'contract_type', 'start_date', 'end_date', 'contract_value', 'retention_percent', 'status'],
    contoh: [
      { contract_no: 'KTR-2026-001', contract_name: 'Pekerjaan PSB & Assurance FTTH 2026', customer_id: 'TA-SBT', contract_type: 'unit_price', start_date: '2026-01-01', end_date: '2026-12-31', contract_value: '2500000000', retention_percent: '5', status: 'aktif' },
      { contract_no: 'KTR-2026-002', contract_name: 'Maintenance Jaringan Akses', customer_id: 'PLN-RIAU', contract_type: 'maintenance', start_date: '2026-03-01', end_date: '2027-02-28', contract_value: '850000000', retention_percent: '0', status: 'aktif' },
    ],
  },
  {
    kode: 'work_orders', tabel: 'work_orders', modul: 'OPERATIONS', label: 'Work Order (WO)',
    keterangan: 'WO berjalan atau historis — PSB, gangguan, maintenance, deployment. Nomor WO dipakai sebagai kunci: impor ulang memperbarui status WO lama.',
    ambil: ['wo_no', 'wo_type', 'job_type_id', 'title', 'customer_name', 'customer_no', 'address', 'lat', 'lng', 'branch_id',
      'scheduled_at', 'assigned_to', 'started_at', 'finished_at', 'status', 'fail_reason', 'result_note', 'qc_status', 'amount'],
    contoh: [
      { wo_no: 'WO-2609-0001', wo_type: 'PSB', job_type_id: 'PSB-FTTH', title: 'Pasang baru FTTH 50 Mbps', customer_name: 'Budi Santoso', customer_no: '1234567890', address: 'Jl. Sudirman 10, Padang', lat: '-0.9471', lng: '100.4172', branch_id: 'Cabang Padang', scheduled_at: '2026-09-24 09:00', assigned_to: 'TK-0001', started_at: '2026-09-24 09:40', finished_at: '2026-09-24 11:15', status: 'done', fail_reason: '', result_note: 'Redaman -19 dBm', qc_status: 'lulus', amount: '185000' },
      { wo_no: 'WO-2609-0002', wo_type: 'GANGGUAN', job_type_id: 'GGN-DROP', title: 'Gangguan LOS', customer_name: 'Siti Aminah', customer_no: '1234567891', address: 'Jl. Riau 5, Pekanbaru', lat: '', lng: '', branch_id: 'Cabang Pekanbaru', scheduled_at: '2026-09-24 13:00', assigned_to: 'TK-0002', started_at: '', finished_at: '', status: 'dispatched', fail_reason: '', result_note: '', qc_status: 'belum', amount: '' },
    ],
  },
  {
    kode: 'ar_invoices', tabel: 'ar_invoices', modul: 'FINANCE', label: 'Invoice Pelanggan (AR)',
    keterangan: 'Tagihan ke pemberi kerja yang sudah terbit — untuk memantau piutang & aging. Isi Pelanggan dan Kontrak lebih dulu.',
    ambil: ['inv_no', 'invoice_date', 'due_date', 'customer_id', 'contract_id', 'dpp', 'ppn', 'pph23', 'total', 'paid_amount', 'status', 'faktur_pajak_no'],
    contoh: [
      { inv_no: 'INV/2026/09/001', invoice_date: '2026-09-05', due_date: '2026-10-20', customer_id: 'TA-SBT', contract_id: 'KTR-2026-001', dpp: '100000000', ppn: '11000000', pph23: '2000000', total: '111000000', paid_amount: '0', status: 'terkirim', faktur_pajak_no: '' },
      { inv_no: 'INV/2026/08/014', invoice_date: '2026-08-10', due_date: '2026-09-24', customer_id: 'TA-SBT', contract_id: 'KTR-2026-001', dpp: '80000000', ppn: '8800000', pph23: '1600000', total: '88800000', paid_amount: '40000000', status: 'dibayar_sebagian', faktur_pajak_no: '' },
    ],
  },
  {
    kode: 'stock_balances', tabel: 'stock_balances', modul: 'INVENTORY', label: 'Saldo Awal Stok / Material',
    keterangan: 'Saldo material & NTE per gudang saat mulai memakai aplikasi. Isi Gudang dan Katalog Item lebih dulu. Impor ulang menimpa saldo gudang+item yang sama.',
    ambil: ['warehouse_id', 'item_id', 'qty', 'qty_reserved', 'avg_price'],
    contoh: [
      { warehouse_id: 'GD-PDG-01', item_id: 'NTE-ONT-001', qty: '120', qty_reserved: '0', avg_price: '525000' },
      { warehouse_id: 'GD-PDG-01', item_id: 'MAT-DC12-001', qty: '340', qty_reserved: '20', avg_price: '145000' },
    ],
  },
]

/* ----------------------------------------------------------------- pembangkit */
const intro = JSON.parse(fs.readFileSync(SUMBER, 'utf8'))

const kolomTabel = new Map()
for (const b of intro.kolom) {
  const [t, c, udt, nul, def] = b.split('|')
  if (!kolomTabel.has(t)) kolomTabel.set(t, new Map())
  kolomTabel.get(t).set(c, { nama: c, udt, nullable: nul === '1', punyaDefault: def === '1' })
}

/** CHECK "kolom = ANY (ARRAY['a'::text, 'b'::text])" -> { tabel.kolom: ['a','b'] } */
const cekTabel = new Map()
for (const b of intro.cek) {
  const [t, , def] = b.split('|')
  const m = /\(?([a-z_]+)\s*=\s*ANY\s*\(\s*ARRAY\[(.+?)\]\s*\)/i.exec(def)
  if (!m) continue
  const nilai = [...m[2].matchAll(/'((?:[^']|'')*)'::text/g)].map((x) => x[1].replace(/''/g, "'"))
  if (nilai.length) cekTabel.set(`${t}.${m[1]}`, nilai)
}

const fkKolom = new Map()
for (const b of intro.fk) {
  const [t, c, ft, fc] = b.split('|')
  fkKolom.set(`${t}.${c}`, { tabel: ft, kolom: fc })
}

const unikTabel = new Map()
for (const b of intro.unik) {
  const [t, cols] = b.split('|')
  if (!unikTabel.has(t)) unikTabel.set(t, cols.split(','))
}

const TIPE = {
  text: 'teks', varchar: 'teks', uuid: 'teks', numeric: 'angka', float8: 'angka', float4: 'angka',
  int2: 'bilangan', int4: 'bilangan', int8: 'bilangan', bool: 'boolean', date: 'tanggal',
  time: 'jam', timestamptz: 'waktu', timestamp: 'waktu', _text: 'daftar', jsonb: 'json', json: 'json',
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const daftar = (a) => `[${a.map(q).join(', ')}]`

const hasil = []
for (const d of DATASET) {
  const kolomDb = kolomTabel.get(d.tabel)
  if (!kolomDb) throw new Error(`Tabel ${d.tabel} tidak ada di introspeksi.json`)
  const kolom = []
  for (const nama of d.ambil) {
    const meta = kolomDb.get(nama)
    if (!meta) throw new Error(`Kolom ${d.tabel}.${nama} tidak ada di introspeksi.json`)
    if (SISTEM.has(nama)) throw new Error(`Kolom sistem ${nama} tidak boleh masuk template`)
    const fk = fkKolom.get(`${d.tabel}.${nama}`)
    const lk = fk ? LOOKUP[fk.tabel] : null
    let nilaiSah = cekTabel.get(`${d.tabel}.${nama}`)
    for (const asal of d.cekDari ?? []) nilaiSah = nilaiSah ?? cekTabel.get(`${asal}.${nama}`)
    const tambahan = d.nilaiSahTambahan?.[nama]
    if (nilaiSah && tambahan) nilaiSah = [...nilaiSah, ...tambahan]
    const wajib = (!meta.nullable && !meta.punyaDefault) || (d.wajibTambahan ?? []).includes(nama)
    kolom.push({
      nama,
      label: labelKolom(nama),
      wajib,
      tipe: fk && lk ? 'lookup' : (TIPE[meta.udt] ?? 'teks'),
      nilaiSah: nilaiSah ?? null,
      lookup: fk && lk ? { tabel: fk.tabel, kolomCari: lk.kolomCari, kolomIsi: fk.kolom, label: lk.label } : null,
    })
  }
  const unik = unikTabel.get(d.tabel)
  const kunciAlami = unik ? unik.filter((c) => c !== 'company_id') : null
  const kunciDipakai = kunciAlami && kunciAlami.every((c) => d.ambil.includes(c)) ? kunciAlami : null
  hasil.push({ ...d, kolom, kunciAlami: kunciDipakai, konflikUpsert: kunciDipakai ? unik.join(',') : null })
}

const baris = []
baris.push('/* BERKAS INI DIBANGKITKAN OTOMATIS — JANGAN DISUNTING TANGAN.')
baris.push(' *')
baris.push(' * Sumber   : skema basis data NUSAKARYA (information_schema.columns, pg_constraint, pg_index)')
baris.push(' * Pembangkit: tools/impor/buat-skema-dataset.mjs  <- tools/impor/introspeksi.json')
baris.push(' * Perbarui : ambil ulang tools/impor/introspeksi.sql lalu jalankan pembangkitnya.')
baris.push(' *')
baris.push(` * Dibangkitkan: ${new Date().toISOString().slice(0, 10)} — ${hasil.length} dataset.`)
baris.push(' */')
baris.push("import type { Dataset } from './tipe'")
baris.push('')
baris.push('export const DATASET: Dataset[] = [')
for (const d of hasil) {
  baris.push('  {')
  baris.push(`    kode: ${q(d.kode)},`)
  baris.push(`    label: ${q(d.label)},`)
  baris.push(`    keterangan: ${q(d.keterangan)},`)
  baris.push(`    tabel: ${q(d.tabel)},`)
  baris.push(`    modul: ${q(d.modul)},`)
  if (d.khusus) baris.push(`    khusus: ${q(d.khusus)},`)
  if (d.catatan) baris.push(`    catatan: ${q(d.catatan)},`)
  baris.push(`    kunciAlami: ${d.kunciAlami ? daftar(d.kunciAlami) : 'null'},`)
  baris.push(`    konflikUpsert: ${d.konflikUpsert ? q(d.konflikUpsert) : 'null'},`)
  baris.push('    kolom: [')
  for (const k of d.kolom) {
    const bagian = [`nama: ${q(k.nama)}`, `label: ${q(k.label)}`, `wajib: ${k.wajib}`, `tipe: ${q(k.tipe)}`]
    if (k.nilaiSah) bagian.push(`nilaiSah: ${daftar(k.nilaiSah)}`)
    if (k.lookup) bagian.push(`lookup: { tabel: ${q(k.lookup.tabel)}, kolomCari: ${daftar(k.lookup.kolomCari)}, kolomIsi: ${q(k.lookup.kolomIsi)}, label: ${q(k.lookup.label)} }`)
    baris.push(`      { ${bagian.join(', ')} },`)
  }
  baris.push('    ],')
  baris.push('    contoh: [')
  for (const c of d.contoh) {
    const isi = d.kolom.map((k) => `${q(k.nama)}: ${q(c[k.nama] ?? '')}`)
    baris.push(`      { ${isi.join(', ')} },`)
  }
  baris.push('    ],')
  baris.push('  },')
}
baris.push(']')
baris.push('')
baris.push('export const cariDataset = (kode: string): Dataset | undefined => DATASET.find(d => d.kode === kode)')
baris.push('')

fs.mkdirSync(path.dirname(TUJUAN), { recursive: true })
fs.writeFileSync(TUJUAN, baris.join('\n'), 'utf8')
const totalKolom = hasil.reduce((a, d) => a + d.kolom.length, 0)
console.log(`OK — ${hasil.length} dataset, ${totalKolom} kolom -> ${path.relative(AKAR, TUJUAN)}`)
for (const d of hasil) {
  console.log(`  ${d.kode.padEnd(22)} ${String(d.kolom.length).padStart(2)} kolom  wajib=${d.kolom.filter(k => k.wajib).length}  lookup=${d.kolom.filter(k => k.lookup).length}  daftarNilai=${d.kolom.filter(k => k.nilaiSah).length}  kunci=${d.kunciAlami ? d.kunciAlami.join('+') : '-'}`)
}
