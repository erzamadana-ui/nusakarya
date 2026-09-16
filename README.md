# NUSAKARYA — Operational Control & Supervision Tools

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
(`0001` … `0016`) ke project Supabase baru. Migrasi `0009` dan `0015` berisi
**data contoh** — jangan diterapkan ke lingkungan produksi.

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
