# NUSAKARYA — Operational Control & Supervision Tools

> **Status: RILIS PILOT KOMERSIAL TERBATAS.** Landing menerima permintaan demo/penawaran; penggunaan operasional produksi penuh memerlukan UAT, restore, privasi dan SLA yang disepakati. Lihat
> [`docs/AUDIT-SAAS-2026-09-24.md`](docs/AUDIT-SAAS-2026-09-24.md) untuk temuan, bukti uji, dan backlog.
> Landing dan akses pilot: https://erzamadana-ui.github.io/nusakarya/ · Daftar workspace: `#/daftar`

Aplikasi operasional untuk perusahaan **Project Deployment & Manage Service Fiber Optic**.
Multi-tenant: satu aplikasi melayani banyak perusahaan mitra kerja.

## Isi repo
| Folder | Isi |
|---|---|
| `apps/web-admin` | Web Panel Admin + Dashboard Report per Unit (React + Vite + TypeScript) |
| `apps/mobile` | Aplikasi Teknisi & Mitra Lapangan (React Native + Expo) |
| `supabase/migrations` | Skema basis data, RLS, view, trigger, dan data contoh |
| `docs` | Blueprint, konvensi kode, prototipe UI/UX, laporan QA |
| `tools` | Skrip pengujian RLS |

## Unit yang dicakup
Human Resource · Payroll & Produktivitas · Commerce · Procurement · Finance ·
Inventory Aset / Material Non-NTE / NTE ber-serial · Operations (Assurance & Maintenance) ·
Design & Deployment · Portal Eksekutif

## Menjalankan
```bash
# Panel Admin
cd apps/web-admin && npm install && cp .env.example .env   # isi kredensial Supabase
npm run dev

# Aplikasi Mobile
cd apps/mobile && npm install && cp .env.example .env
npx expo start
```

## Basis data
Skema dan kebijakan RLS ada di `supabase/migrations/`. Terapkan berurutan
(`0001` … `0054`) ke project Supabase baru. Migrasi `0009` dan `0015` berisi
**data contoh** — jangan diterapkan ke lingkungan produksi.

## Lapisan SaaS (migrasi 0050–0054)
- **Tenant & pemilik aplikasi terpisah**: `platform_admins` (pemilik NUSAKARYA) ≠ `super_admin` (admin perusahaan mitra).
- **Paket & feature flag** ditegakkan di basis data (`can_read/can_write` membaca paket); tenant ditangguhkan = hanya-baca.
- **Onboarding mandiri**: `#/daftar` → wizard 7 langkah (`/onboarding`) → template bisnis → Pusat Impor → validasi → aktivasi.
- **Skema adaptif**: field kustom (kolom `custom jsonb`), tabel kustom, label status/jabatan, transisi status, SLA, aturan persetujuan — tanpa mengubah tabel inti.
- **Impor** CSV/XLSX dengan pemetaan kolom, pratinjau, laporan galat, dan **rollback per batch**.
- **Edge Functions**: `admin-users` (kelola akun, v2) dan `saas-publik` (daftar & terima undangan). Sumber di `supabase/functions/`.

## Keamanan
- Isolasi antar-perusahaan ditegakkan Row Level Security pada seluruh tabel (`company_id`).
- Hak akses per jabatan diatur lewat tabel `role_module_access` dan bisa diubah
  dari halaman Pengaturan tanpa mengubah kode.
- Bucket berkas bersifat privat; berkas diakses lewat signed URL.
- Perubahan pada dokumen kunci tercatat di `audit_logs`.

## Catatan keterbatasan
Tarif PPh 21 (TER), iuran BPJS, dan tarif PPN/PPh 23 yang tersimpan di basis data
adalah **tabel referensi yang wajib diverifikasi** ke peraturan yang berlaku sebelum
dipakai membayar. Price list pekerjaan pada data contoh bukan tarif kontrak riil.

## Rilis 1 Oktober 2026
- Landing: manfaat per peran, harga indikatif berbasis skenario COGS, proses pilot dan formulir demo. Kontak tersimpan di `commercial_leads`, hanya untuk platform admin (tab Permintaan demo di `/platform`).
- Pendaftaran email wajib verifikasi lewat Supabase Auth; endpoint lama yang auto-confirm sudah ditutup. Setelah email terverifikasi, pengguna membuat workspace lewat RPC tenant yang terikat `auth.uid()`.
- UI Google/SMS otomatis membaca provider aktif; provider nonaktif ditampilkan belum tersedia. Google membutuhkan OAuth client dan redirect allowlist; SMS membutuhkan provider dan nomor Auth terverifikasi. Keduanya metode alternatif; belum ada enforcement MFA.
- Tenant demo dengan pengenal pribadi dikarantina; akun anggota kehilangan scope tenant, pemilik platform tetap bisa meninjau data. Tidak ada penghapusan data.
- Privileged RPC dibatasi authenticated/service; RPC dengan UUID tenant menolak tenant lain, termasuk jika caller adalah super admin perusahaan lain.
- Public invitation lookup disengaja dan hanya untuk token acak yang masih berlaku serta tenant tidak dikarantina.
- Dependensi produksi web: SheetJS 0.20.3 dari CDN resmi, React Router 7.18.4; audit produksi web 0 advisory saat build lokal.
- `release.json` pada situs memuat commit deployment untuk pengecekan setelah CI.
- Provider Google/SMS, sandi bocor, rotasi kredensial yang terekspos, pentest, restore, invoice collection dan UAT tetap perlu bukti penutupan.
