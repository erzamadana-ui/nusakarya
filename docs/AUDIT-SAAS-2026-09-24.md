# NUSAKARYA — Audit SaaS, Implementasi, dan Backlog (24 Sep 2026)

**Status lingkungan: STAGING / PROTOTYPE LANJUT — BELUM PRODUCTION-READY.**
Live: https://erzamadana-ui.github.io/nusakarya/ · Backend: Supabase `idlhsxamdkipnmyvewbp` (ap-southeast-1, Singapura).

## 1. Ringkasan audit

| Area | Kondisi sebelum iterasi ini | Kondisi sesudah |
|---|---|---|
| Cakupan fungsi | Sangat luas: 144 tabel, ±100 halaman, 13 modul, mobile teknisi, payroll 2 jalur | Tetap + lapisan SaaS |
| Multi-tenant | `company_id` + RLS di semua tabel, TAPI ada jalan keluar tenant (lihat K1–K4) | Jalan keluar ditutup; diuji lintas-tenant di SQL |
| Onboarding | Tidak ada. Tenant baru hanya bisa dibuat developer; pengguna tanpa profil "hubungi admin" | Daftar mandiri + wizard 7 langkah + template bisnis |
| Impor data | Pusat Impor 19 dataset, tanpa rollback, tanpa WO/kontrak/invoice/stok/karyawan umum | 24 dataset + field kustom + tabel kustom, batch tercatat & bisa di-rollback |
| Adaptasi per mitra | Hanya matriks hak akses & data master | Field kustom, tabel kustom, label status/jabatan, transisi status, SLA, aturan persetujuan, preferensi |
| Komersial SaaS | Kolom `companies.plan` tak terpakai | Paket, langganan, feature flag & batas pemakaian ditegakkan di basis data, draft tagihan, panel pemilik, skor kesehatan tenant |
| Audit trail | Trigger audit hanya di 7 dari 144 tabel | 36 tabel (konfigurasi + master + transaksi utama) + event impor/rollback/ekspor/aktivasi |
| Uji | `tsc` + `vite build` + simulasi SQL; belum pernah E2E di peramban | Sama + simulasi SQL lintas-tenant untuk fitur SaaS; E2E peramban = backlog P0 |

## 2. Temuan berprioritas

### CRITICAL
| # | Temuan | Status |
|---|---|---|
| K1 | Kebijakan `profiles_update` mengizinkan pengguna mengubah baris profilnya sendiri **termasuk `role` dan `company_id`** → teknisi mana pun bisa menjadi `super_admin` atau pindah ke tenant lain. | **Ditutup** (0050, trigger `fn_jaga_profil`; diuji: teknisi ditolak) |
| K2 | `handle_new_user()` mempercayai `raw_user_meta_data` (diisi klien saat signUp) untuk `company_id`/`role`, dan jatuh ke "perusahaan pertama" bila kosong → siapa pun yang bisa signUp bisa masuk tenant mana pun sebagai admin. | **Ditutup** (0050: hanya `app_metadata` dari service role; diuji) |
| K3 | Data pribadi NYATA (±1.700 NIK Telkom, 2.020 formasi WFP Regional Sumbagteng) dimuat ke tenant bertanda `is_demo` yang punya 24 akun peragaan berkata sandi seragam; berkas seed-nya berada di jalur menuju repo **publik**. Risiko UU PDP No. 27/2022. | **Sebagian**: berkas `0047_data_karyawan_sumbagteng.sql` dikeluarkan dari repo (.gitignore). **Belum**: data masih di basis data; sandi akun peragaan belum dirotasi. Keputusan GM diperlukan. |
| K4 | Token GitHub tersimpan polos di URL remote salinan lokal (`repo-live`). | **Belum** — wajib dirotasi di GitHub; jangan dipakai lagi di URL. |

### HIGH
| # | Temuan | Status |
|---|---|---|
| H1 | `super_admin` tenant bisa melihat & membuat seluruh perusahaan (`fn_daftar_perusahaan`, `fn_tambah_perusahaan`) dan mengubah tabel global (`modules`, `peran_lapangan`, `impor_dataset_ref`). | **Ditutup** — kini hanya platform admin (0050) |
| H2 | `fn_bangun_inbox_kerja(NULL)` bisa dipanggil pengguna mana pun dan menulis inbox SELURUH tenant; `inbox_tugas_delete` tanpa batas tenant. | **Ditutup** (0050) |
| H3 | Manager HR bisa membuat akun Super Admin lewat Edge Function `admin-users`. | **Ditutup** (admin-users v2) |
| H4 | Tidak ada konsep paket/langganan → tidak bisa membatasi modul, pengguna, atau menangguhkan tenant yang tidak bayar. | **Ditutup** (0051; ditegakkan di `can_read/can_write`) |
| H5 | Tidak ada pemisahan pemilik aplikasi vs admin tenant. | **Ditutup** (`platform_admins`, `/platform`) |
| H6 | Belum ada uji E2E di peramban, UAT dengan mitra, uji restore backup, pentest eksternal. | **Terbuka** (gate NO-GO) |
| H7 | Tarif pajak/BPJS dan price list masih asumsi (`asumsi_sistem`). | **Terbuka** — wajib validasi finance/pajak |

### MEDIUM
| # | Temuan | Status |
|---|---|---|
| M1 | Pendaftaran mandiri tanpa verifikasi email (akun dibuat via service role `email_confirm: true`). | Terbuka — mitigasi: batas 30 workspace/hari, 2 per akun, honeypot, trial. Aktifkan verifikasi email + CAPTCHA sebelum publik. |
| M2 | Leaked-password protection Supabase Auth nonaktif; Site URL/redirect belum diarahkan → reset sandi via email belum jalan. | Terbuka (pengaturan dashboard Supabase) |
| M3 | `can_read/can_write` dipanggil per baris dalam kebijakan RLS; kini ada 2 lookup tambahan (paket). Aman di skala saat ini, perlu dibungkus `(select …)` sebelum tenant >20 ribu WO/bulan. | Backlog P1 |
| M4 | Aplikasi mobile belum punya antrean sinkron offline — sinyal lemah di lapangan = evidence gagal terkirim. | Backlog P1 |
| M5 | Bundel utama web 1,36 MB (322 KB gzip). | Backlog P2 (code-split per modul) |
| M6 | Hosting GitHub Pages: tanpa SLA, tanpa header keamanan (CSP/HSTS custom), tanpa domain kustom. | Backlog P1 (Cloudflare Pages/Vercel + domain) |

### LOW
- L1 Migrasi `0012`, `0013`, `0035–0038` tercatat di DB dengan nama berbeda dari berkas repo; `0048b–f` hanya ada di DB. Konsolidasikan riwayat migrasi sebelum environment produksi dibuat dari nol.
- L2 Teknisi masih bisa membaca artikel basis pengetahuan yang belum terbit.
- L3 Beberapa halaman dashboard belum memakai label status kustom (hanya Work Order).

## 3. Fitur yang diimplementasikan di iterasi ini

**Keamanan (0050, admin-users v2)** — platform admin terpisah; penjaga profil; signup aman; fungsi global hanya pemilik; inbox per tenant.

**Fondasi SaaS (0051)** — `saas_plans` (Starter/Professional/Enterprise/Managed, harga ASUMSI), `tenant_subscriptions` (trial/active/past_due/suspended/cancelled), `tenant_feature_overrides`, modul & fitur per paket ditegakkan di basis data, status hanya-baca saat ditangguhkan/trial habis, `fn_pemakaian`/`fn_cek_kuota` (pengguna = batas keras; teknisi & WO = overage), `saas_invoices` + `fn_buat_draft_tagihan`, `tenant_settings`, `tenant_onboarding`, `business_templates` (Mitra Fiber Optic Telkom Akses, Kontraktor Umum), `fn_buat_workspace`, undangan tim (`tenant_invites`, `fn_info_undangan`, `fn_terima_undangan`), data contoh terlacak (`fn_isi_data_contoh`/`fn_hapus_data_contoh`), `fn_platform_tenant` (skor kesehatan), `fn_validasi_data_awal`, `fn_aktivasi_workspace`.

**Skema adaptif (0052)** — `custom_field_defs` + kolom `custom jsonb` pada 10 entitas inti + trigger validasi; `custom_tables`/`custom_records`; `tenant_status_labels` (status & nama jabatan); `tenant_status_transitions` (ditegakkan trigger); `tenant_sla_rules` (otomatis mengisi SLA tiket); `tenant_approval_rules` + `fn_penyetuju`; audit trail di 36 tabel.

**Impor (0053 + UI)** — batch impor tercatat, pelacakan baris via header `x-nk-import-batch`, `fn_rollback_impor` (hapus baris baru, kembalikan baris yang diubah), mode "semua atau batal" dengan rollback otomatis, Riwayat Impor, dataset baru: Karyawan & Teknisi, Kontrak, Work Order, Invoice AR, Saldo Awal Stok; kolom field kustom & tabel kustom otomatis masuk template.

**Edge Function `saas-publik`** — daftar workspace & terima undangan tanpa login.

**UI** — `/daftar`, `/undangan/:token`, wizard `/onboarding` (7 langkah), Paket & Pemakaian, Undang Tim, Field Kustom, Status-SLA-Alur, Tabel Kustom + halaman data `/data/:kode`, Pengaturan Perusahaan, Ekspor & Cadangan (XLSX/JSON), Panel Pemilik Aplikasi `/platform`, banner trial/hanya-baca/onboarding, kartu "Mulai di sini" di dashboard, gerbang upgrade per modul, field kustom di Work Order/Karyawan/Pelanggan, label status kustom di Work Order.

## 4. Bukti uji yang sudah ada (dan yang belum)
Sudah (simulasi SQL dengan JWT pengguna, transaksi di-rollback):
- signUp dengan metadata palsu → 0 profil tercipta.
- Teknisi mengubah role sendiri → ditolak.
- Workspace baru (Starter): hanya melihat 30 WO miliknya (bukan 800 milik tenant lain), 1 perusahaan, FINANCE tertutup, OPERATIONS terbuka, lintas-tenant `fn_pemakaian` & `fn_daftar_perusahaan` ditolak, field kustom pilihan tak sah ditolak, impor ke modul di luar paket ditolak.
- Workspace Enterprise: 2 baris impor terlacak, rollback memulihkan nilai lama & menghapus baris baru, transisi status tak terdaftar ditolak, SLA tiket kritis otomatis 180 menit, perubahan konfigurasi masuk audit.
- Tenant peragaan lama tetap berfungsi (manager operations: 800 WO, 350 tiket, bisa menulis).
- `tsc --noEmit` bersih; `vite build` sukses.

Belum: E2E peramban menyeluruh, uji beban, pentest, restore drill, UAT mitra, review legal (UU PDP, perjanjian pemrosesan data), validasi pajak/finance.

## 5. Backlog teknis (urut prioritas)
| P | Item | Perkiraan |
|---|---|---|
| P0 | Rotasi token GitHub; keputusan & tindakan atas data NIK nyata di tenant peragaan; rotasi sandi 24 akun peragaan | 1 hari |
| P0 | E2E peramban (Playwright) untuk daftar → onboarding → impor → rollback → dashboard → undangan → login teknisi | 3–4 hari |
| P0 | Verifikasi email + CAPTCHA (Turnstile) untuk pendaftaran; Site URL & reset sandi; leaked-password protection | 1–2 hari |
| P0 | Restore drill (PITR/backup Supabase Pro) + runbook insiden | 2 hari |
| P1 | Penerapan `fn_penyetuju` ke alur PR/PO/AP/lembur/kasbon (saat ini aturan tersimpan tapi alur lama memakai hak approve modul) | 3 hari |
| P1 | Label status kustom di seluruh halaman (tiket, proyek, invoice, kontrak) + filter field kustom | 2 hari |
| P1 | Antrean sinkron offline di aplikasi teknisi (evidence & status WO) | 5 hari |
| P1 | Pemakaian otomatis preferensi (radius absensi, minimal foto) di mobile & QC | 2 hari |
| P1 | Optimasi RLS (initplan), indeks FK, uji beban 20 ribu WO/bulan/tenant | 3 hari |
| P1 | Hosting produksi: domain, CDN dengan header keamanan, environment staging vs produksi terpisah, CI migrasi | 3 hari |
| P2 | Payment gateway (Xendit/Midtrans) + e-Faktur untuk tagihan langganan | 5 hari |
| P2 | API publik + webhook (feature flag `api_integrasi`), SSO (Google Workspace/Azure AD) | 8 hari |
| P2 | Code-split bundel web; PWA offline-first untuk panel | 3 hari |
| P2 | Impor dari format ekspor sistem principal (template pemetaan tersimpan per tenant) | 3 hari |

_Catatan keterbatasan: seluruh harga paket, batas pemakaian, SLA bawaan, dan tarif pada template adalah ASUMSI 24 Sep 2026 — belum divalidasi pasar, finance, pajak, maupun legal._
