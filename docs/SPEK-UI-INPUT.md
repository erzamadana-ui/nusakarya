# Spesifikasi Perbaikan UI Input — NUSAKARYA

**Untuk:** enam engineer (kelompok A–F) · **Dari:** Business Analyst NUSAKARYA · **Tanggal:** 2026-09-16

Audit sebelumnya (`AUDIT-UI-INPUT-A-2026-09-16.md`) hanya memeriksa **ada/tidaknya elemen Modal**, bukan apakah form benar-benar memuat kolom yang dibutuhkan bisnis, apakah semua transisi status bisa dicapai dari UI, atau apakah tulisan ke database itu benar-benar **berhasil**. Dokumen ini dibangun dengan membandingkan struktur tabel Supabase (project `idlhsxamdkipnmyvewbp`, 152 tabel/`view` di schema `public` — kolom, nullable, default, CHECK constraint) terhadap kode form sesungguhnya di `apps/web-admin/src`.

**Metodologi:** (1) tarik seluruh kolom + CHECK constraint tiap tabel; (2) petakan tiap rute di `nav.ts` ke tabel utamanya lewat pemanggilan `insert()`/`update()` di kode; (3) bandingkan kolom bisnis vs field form, dan **nilai status yang benar-benar ditulis UI vs nilai yang diizinkan CHECK constraint**; (4) telusuri tabel yang sama sekali tidak punya rute penulis.

Kolom berikut **selalu diabaikan** dari daftar "wajib ditambahkan" karena diisi sistem: `id`, `company_id`, `created_at`, `updated_at`, `created_by`, kolom nomor dokumen (`*_no` yang dibuat via `nextDocNo()`), dan kolom hasil hitung (`amount`, `total`, `net_pay`, `book_value`, dst).

## Ringkasan Klasifikasi (105 rute)

| Klasifikasi | Jumlah rute | Keterangan |
|---|---:|---|
| CUKUP | 75 | Field form mencakup kolom bisnis; semua transisi status yang relevan konsisten dengan CHECK constraint |
| LAPORAN (aksi cepat diusulkan) | 14 | Dashboard/rekap — diberi tombol aksi cepat, bukan form penuh |
| TAMBAH-BARU | 3 | Tidak bisa membuat baris baru padahal seharusnya bisa |
| FORM-KURANG | 3 | Bisa membuat baris, tapi tabel referensi pentingnya tidak pernah terisi dari UI mana pun |
| AKSI-KURANG | 10 (**3 di antaranya kritis/blokir database**) | Transisi status tidak semua tercapai, atau tulis-baru **ditolak database** |

**Jumlah blok per kelompok kerja:** A = 15, B = 5, C = 2, D = 3, E = 0, F = 6. (Total 31 blok kerja; sisanya CUKUP.)

## 15 Halaman Paling Mendesak

1. **/ops/tiket** (kritis) — tombol "Buat Tiket" menulis `status:'baru'`; CHECK constraint `tickets` hanya mengizinkan `open/assigned/on_progress/pending/resolved/closed/cancelled`. **Insert ditolak database.**
2. **/ops/work-order** (kritis) — WO baru ditulis `status:'belum_ditugaskan'`, tidak ada di CHECK constraint `work_orders`. **Pembuatan WO manual gagal total.**
3. **/ops/dispatch** (kritis) — papan dispatch menulis `ditugaskan/dikerjakan/selesai/gagal`, semua di luar CHECK constraint. Trigger migrasi 0008 yang otomatis membuat `productivity_entries` saat WO `'done'` **tidak pernah terpicu**.
4. **/pengaturan/pengguna** — tidak ada cara membuat akun pengguna baru dari UI (hanya `update(profiles)`).
5. **/pengaturan/perusahaan** — aplikasi multi-perusahaan tapi tidak ada cara menambah perusahaan baru dari UI (hanya `update(companies)`).
6. **/finance/referensi-pajak** — tarif pajak/PTKP/TER hanya bisa diedit, tidak bisa ditambah baris baru untuk tahun pajak berikutnya (0 pemanggilan `insert`).
7. **/hr/absensi** — tidak ada input manual untuk koreksi absensi teknisi lapangan yang lupa check-in/out.
8. **/hr/payroll-freelance** — tidak ada tombol tolak (`ditolak`) untuk payout mitra freelance.
9. **/hr/kasbon** — status `dicairkan` dan `sebagian_lunas` tidak pernah ditulis; pelunasan sebagian tetap berstatus `disetujui`.
10. **/hr/produktivitas** — `productivity_targets` ditampilkan tapi tidak pernah bisa diisi/diubah dari UI mana pun.
11. **/hr/setelan-bpjs** — kelas risiko JKK (`jkk_risk_rates`) hanya tampil, tidak bisa ditambah/diubah.
12. **/procurement/vendor** — target SLA bayar mitra (`partner_payment_sla`), dipakai KPI Finance, tidak ada UI yang menulisnya.
13. **/procurement/po** — status `ditutup` (PO ditutup manual) tidak pernah tercapai dari UI.
14. **Notifikasi (temuan produk)** — tabel `notifications` tak pernah di-`insert` oleh kode maupun trigger manapun; tak ada cara mengirim notifikasi ke pengguna.
15. **/ops/alarm** — status `clear` (alarm hilang sendiri) tak pernah bisa ditandai manual dari UI.

## Yang Hilang di Tingkat Produk

- **Multi-perusahaan tanpa jalan masuk.** Tabel `companies` tidak pernah di-`insert` dari UI manapun. Tidak ada cara onboarding tenant baru tanpa turun ke SQL/Supabase Studio.
- **Tidak ada mekanisme kirim notifikasi.** Tabel `notifications` (11 kolom, termasuk `entity_type`/`entity_id`) nihil pemanggil `insert` di kode maupun trigger di migrasi. Alur persetujuan, penugasan tiket/WO, jatuh tempo dokumen — semuanya seharusnya memicu notifikasi tapi tak satu pun melakukannya.
- **Manajemen pengguna tanpa "tambah user".** `/pengaturan/pengguna` hanya `update(profiles)`; pembuatan akun staf baru kemungkinan besar dilakukan di luar aplikasi.
- **Bug sistemik kosakata status di modul Operations.** `tickets` dan `work_orders` didefinisikan dengan CHECK constraint **berbahasa Inggris** (migrasi `0005_operations.sql`), tapi tiga halaman inti (`Tiket.tsx`, `WorkOrder.tsx`, `Dispatch.tsx`) menulis status **berbahasa Indonesia** yang sama sekali tidak ada dalam constraint tersebut. Ini bukan "field kurang" — ini alur kerja inti Operations yang secara teknis gagal di database. Modul lain (Procurement, Finance, HR, Deployment) tidak punya bug sejenis; kosakata status di sana konsisten dengan CHECK constraint.
- **Tiga tabel referensi tanpa penulis:** `partner_payment_sla`, `jkk_risk_rates`, `productivity_targets` — semuanya dipakai untuk perhitungan KPI/gaji tapi tak satu pun punya halaman yang menulisnya.
- **`modules` dan `doc_sequences`** memang layak tetap sebagai tabel konfigurasi kode (bukan gap UI, tidak perlu form).

---

# Kelompok A — Dashboard & Laporan (Aksi Cepat) · 15 blok

Untuk semua rute LAPORAN di bawah: **jangan** buat form penuh. Tambahkan tombol pintas yang mengarahkan ke rute penulis sebenarnya (dengan konteks/filter terisi otomatis bila memungkinkan).

### /dashboard — LAPORAN
Tabel: `v_executive_summary` (view, read-only by design)
Aksi cepat yang diusulkan: tidak perlu — ini ringkasan lintas-unit murni, tombol aksi cepat lebih tepat ada di dashboard per-unit di bawah.

### /eksekutif — LAPORAN
Tabel: berbagai view `v_dashboard_*`
Aksi cepat yang diusulkan: tidak perlu, portal eksekutif memang murni baca.

### /commerce/dashboard — LAPORAN
Tabel: `v_dashboard_commerce`, `v_dashboard_crm`
Aksi cepat yang diusulkan: tombol "Peluang Baru" → `/commerce/pipeline`, "Kontrak Baru" → `/commerce/kontrak`.

### /deploy/dashboard — LAPORAN
Tabel: `v_dashboard_deployment`
Aksi cepat yang diusulkan: tombol "Proyek Baru" → `/deploy/proyek`, "Catat Progres Hari Ini" → `/deploy/progres`.

### /finance/dashboard — LAPORAN
Tabel: `v_dashboard_finance`, `v_project_margin`
Aksi cepat yang diusulkan: tombol "Catat Kas Masuk/Keluar" → `/finance/cashflow`, "Bayar Vendor" → `/finance/ap`.

### /hr/dashboard — LAPORAN
Tabel: `v_dashboard_hr`
Aksi cepat yang diusulkan: tombol "Karyawan Baru" → `/hr/karyawan`, "Ajukan Cuti" → `/hr/cuti`.

### /inventory/dashboard — LAPORAN
Tabel: `v_dashboard_inventory`
Aksi cepat yang diusulkan: tombol "Buat Permintaan Material" → `/inventory/permintaan`, "Mulai Stock Opname" → `/inventory/opname`.

### /k3/dashboard — LAPORAN
Tabel: `v_dashboard_hse`
Aksi cepat yang diusulkan: tombol **"Lapor Insiden"** → `/k3/insiden` (harus menonjol, bukan tersembunyi di menu).

### /ops/dashboard — LAPORAN
Tabel: `v_dashboard_operations`
Aksi cepat yang diusulkan: tombol **"Buat Tiket"** → `/ops/tiket` (contoh yang diminta Komisaris) dan "Buat Work Order" → `/ops/work-order`.

### /procurement/dashboard — LAPORAN
Tabel: `v_dashboard_procurement`
Aksi cepat yang diusulkan: tombol "PR Baru" → `/procurement/pr`, "RFQ Baru" → `/procurement/rfq`.

### /ops/bmon — LAPORAN
Tabel: agregasi dari `network_elements`, `nms_alarms`, `tickets` (tidak ada tabel BMON sendiri)
Aksi cepat yang diusulkan: tombol "Buat Tiket dari Elemen Bermasalah" langsung dari baris tabel.

### /ops/morning — LAPORAN
Tabel: agregasi dari `work_orders` (jenis `PSB`/`MIGRASI`)
Aksi cepat yang diusulkan: tombol "Buat Work Order Provisioning" → `/ops/work-order` dengan `wo_type` terprefill.

### /inventory/stok — LAPORAN
Tabel: `stock_balances`
Aksi cepat yang diusulkan: tombol "Ajukan Permintaan" dan "Mutasi Stok" langsung dari baris item bersaldo rendah.

### /pengaturan/audit — LAPORAN
Tabel: `audit_logs` (read-only by design, jangan diberi form input)
Aksi cepat yang diusulkan: tombol ekspor CSV per rentang tanggal/entitas — saat ini tidak ada.

### /ops/dispatch — AKSI-KURANG (kritis)
Tabel: `work_orders`
Aksi yang belum bisa dicapai: seluruh transisi status yang ditulis (`ditugaskan`, `dikerjakan`, `selesai`, `gagal`, `belum_ditugaskan`) **tidak ada satupun** dalam CHECK constraint `work_orders` (`draft, dispatched, accepted, on_progress, pending_material, done, failed, cancelled`). Setiap klik tombol di papan dispatch akan ditolak database.
Catatan bisnis: perbaiki bersamaan dengan `/ops/work-order` dan `/ops/tiket` (lihat blok Kelompok F) — satukan kosakata status ke satu bahasa yang sesuai CHECK constraint sesungguhnya, lalu perbarui trigger `0008_views_functions.sql` bila kosakata diubah ke Indonesia (ubah constraint + trigger, bukan cuma kode UI).

---

# Kelompok B — HR, Payroll, Mitra Freelance · 5 blok

### /hr/absensi — AKSI-KURANG
Tabel: `attendances`
Sudah ada di form: koreksi `check_in_at`, `check_out_at`, `status`, `note` untuk baris yang **sudah ada**.
Aksi yang belum bisa dicapai: `insert('attendances', …)` **tidak pernah dipanggil** — tidak ada cara HR/Admin membuat baris absensi baru secara manual untuk teknisi yang lupa check-in atau bekerja offline.
Diisi sistem: `id, company_id, created_at, updated_at, created_by`.
Catatan bisnis: sediakan form "Tambah Absensi Manual" dengan alasan wajib diisi (`note`), agar bisa diaudit terpisah dari absensi otomatis GPS.

### /hr/kasbon — AKSI-KURANG
Tabel: `employee_advances`
Sudah ada di form: `employee_id, request_date, purpose, amount, due_date, note`; transisi `diajukan → disetujui/ditolak`.
Aksi yang belum bisa dicapai: status `dicairkan` dan `sebagian_lunas` (keduanya ada di CHECK constraint) **tidak pernah ditulis**. Pelunasan sebagian saat ini mengembalikan status ke `disetujui`, membuat kasbon yang sudah dicicil terlihat sama dengan yang belum dibayar sama sekali.
Diisi sistem: `id, company_id, created_at, updated_at, created_by, settled_amount` (harus dihitung otomatis dari histori pelunasan).
Catatan bisnis: tambahkan langkah "Cairkan" eksplisit (`disetujui → dicairkan`) sebelum pelunasan dicatat, dan set `status = 'sebagian_lunas'` saat `settled_amount < amount`.

### /hr/payroll-freelance — AKSI-KURANG
Tabel: `freelance_payouts`
Sudah ada di form: transisi `draft → dihitung → diverifikasi → disetujui → dibayar`.
Aksi yang belum bisa dicapai: status `ditolak` ada di CHECK constraint tapi **tidak ada tombol** untuk menolak payout yang salah hitung/tidak sesuai sebelum dibayar.
Diisi sistem: `id, company_id, created_at, updated_at, created_by, net_amount, dpp_amount, tax_amount` (hasil hitung).
Catatan bisnis: tambahkan tombol "Tolak" di setiap tahap sebelum `dibayar`, dengan `note` alasan wajib diisi.

### /hr/produktivitas — FORM-KURANG
Tabel utama: `productivity_entries` (verifikasi entri harian — sudah CUKUP) · Tabel anak yang bolong: `productivity_targets`
Sudah ada di form: filter tanggal, verifikasi massal entri draft, kelola `job_types` (jenis pekerjaan & tarif).
Wajib ditambahkan: form "Set Target" per karyawan/posisi per periode — kolom `employee_id` (atau `position` untuk target per-jabatan), `period_code`, `target_points`. Kolom `target_points` sudah ditampilkan di tabel tapi selamanya kosong karena tak pernah diisi dari UI mana pun.
Diisi sistem: `id, company_id, created_at, updated_at, created_by`.
Catatan bisnis: tanpa target tersimpan, kolom "Pencapaian %" di `v_dashboard_productivity` tidak berarti apa-apa — ini fondasi insentif produktivitas teknisi.

### /hr/setelan-bpjs — FORM-KURANG
Tabel utama: `bpjs_config` (form CUKUP) · Tabel anak yang bolong: `jkk_risk_rates`
Sudah ada di form: seluruh tarif JHT/JKK/JKM/JP/Kesehatan perusahaan-karyawan, tanggal berlaku.
Wajib ditambahkan: form kelola `jkk_risk_rates` (`class_code`, `class_name`, `description`, `rate`, `effective_from`, `source_note`) — saat ini hanya dibaca (`list()`), tidak pernah di-`insert`/`update`. Field `jkk_risk_class` di `bpjs_config` merujuk ke tabel ini tapi kelas risikonya sendiri tidak bisa dikelola.
Diisi sistem: `id, created_at, updated_at`.
Catatan bisnis: kelas risiko JKK per Permenaker berubah berkala — tanpa form ini, perubahan tarif JKK by risk-class harus lewat SQL manual.

---

# Kelompok C — Commerce & Procurement · 2 blok

### /procurement/po — AKSI-KURANG
Tabel: `purchase_orders`
Sudah ada di form: `draft → diajukan → disetujui → dikirim`, lalu otomatis `diterima_sebagian/diterima` saat Good Receive dibuat.
Aksi yang belum bisa dicapai: status `ditutup` ada di CHECK constraint dan dipakai sebagai filter KPI, tapi **tidak ada tombol** untuk menutup PO secara manual (mis. kekurangan kirim diterima sebagai final, vendor tidak akan mengirim sisanya).
Diisi sistem: `id, company_id, subtotal, ppn, total, created_at, updated_at, created_by`.
Catatan bisnis: tambahkan tombol "Tutup PO" di status `diterima_sebagian`, dengan catatan alasan penutupan wajib diisi.

### /procurement/vendor — FORM-KURANG
Tabel utama: `vendors` (form CUKUP, 36 field vs 17 kolom bisnis) · Tabel terkait yang bolong: `partner_payment_sla`
Sudah ada di form: profil vendor lengkap, tipe, NPWP/PKP, bank, termin bayar, rating, status.
Wajib ditambahkan: form "Target SLA Bayar" per vendor — kolom `target_days` (integer, target hari bayar), `note`. Tabel `partner_payment_sla` dipakai sebagai basis perhitungan KPI hari-bayar-aktual di `/finance/dashboard` tapi **tidak ada satu halaman pun** yang menulisnya.
Diisi sistem: `id, company_id, created_at, updated_at, created_by`.
Catatan bisnis: tanpa ini, KPI "Ketepatan Bayar Mitra" di Finance memakai fallback termin default vendor, bukan target aktual yang disepakati.

---

# Kelompok D — Finance · 3 blok

### /finance/referensi-pajak — TAMBAH-BARU
Tabel: `tax_rates_ref`, `ter_rates`, `tax_brackets_art17`
Sudah ada di form: edit tarif yang sudah ada (`update`) + tandai terverifikasi, untuk ketiga tabel.
Aksi yang belum bisa dicapai: **tidak ada `insert` sama sekali** untuk ketiga tabel — hanya baris yang sudah ada (hasil seed migrasi) yang bisa diubah. Saat UU/tarif pajak berubah (mis. lapisan PPh 21 baru, kategori TER baru, tarif PPN naik), tidak ada cara menambah baris baru dari UI.
Wajib ditambahkan: tombol "Tambah Tarif Baru" pada ketiga tab, dengan field sesuai tabel masing-masing — `tax_rates_ref` (`tax_code, tax_name, rate, basis_note, legal_basis, source_url, effective_from, effective_to`), `ter_rates` (`category, min_income, max_income, rate, effective_from, source_note`), `tax_brackets_art17` (`min_income, max_income, rate, effective_from, source_note`).
Diisi sistem: `id, company_id, created_at, updated_at, created_by, is_verified, verified_by, verified_at`.
Catatan bisnis: ini rute yang sama dipakai `v_tarif_belum_terverifikasi` untuk memantau tarif yang belum diverifikasi — tanpa insert, tarif tahun berikutnya akan menimpa (overwrite) tarif tahun berjalan alih-alih ditambah sebagai baris baru dengan `effective_from` baru, merusak histori perhitungan payroll/pajak lama.

### /finance/bank — AKSI-KURANG
Tabel: `bank_reconciliations`
Sudah ada di form: `draft → selesai`, input `statement_balance`, `book_balance`, pencocokan baris mutasi bank.
Aksi yang belum bisa dicapai: status `disetujui` ada di CHECK constraint (langkah approval oleh Finance Manager setelah rekonsiliasi `selesai`) tapi **tidak ada tombol** untuk mencapainya.
Diisi sistem: `id, company_id, difference, created_at, updated_at, created_by`.
Catatan bisnis: tanpa langkah approval terpisah, staf yang menyelesaikan rekonsiliasi juga otomatis jadi yang "menyetujui" — melemahkan kontrol empat-mata pada rekonsiliasi bank.

### /finance/pajak — AKSI-KURANG
Tabel: `tax_records`
Sudah ada di form: `draft → dilaporkan`, input DPP, jenis pajak, no. faktur/bukti potong.
Aksi yang belum bisa dicapai: status `dikoreksi` ada di CHECK constraint (untuk SPT/faktur yang perlu dibetulkan setelah dilaporkan) tapi **tidak ada tombol** untuk mencapainya — satu-satunya jalan adalah mengedit baris lama secara langsung, yang menghapus jejak bahwa data pernah dikoreksi.
Diisi sistem: `id, company_id, created_at, updated_at, created_by`.
Catatan bisnis: tambahkan tombol "Tandai Dikoreksi" + field `note` alasan koreksi wajib diisi, penting untuk audit pajak.

---

# Kelompok E — Inventory & Aset · 0 blok

Seluruh 9 rute (`/inventory/gudang`, `/mutasi`, `/nte`, `/opname`, `/pemakaian`, `/permintaan`, `/aset/daftar`, `/aset/pemeliharaan`, `/aset/penugasan`) sudah **CUKUP**: field form mencakup kolom bisnis tabelnya (`warehouses`, `stock_movements`, `serials`, `stock_opnames`+`stock_opname_lines`, `material_usages`, `material_requests`+`material_request_items`, `assets`, `asset_maintenances`, `asset_assignments`), dan transisi status yang dipakai (`draft/berjalan/selesai/disetujui` untuk opname; `diajukan/disetujui/dikeluarkan/ditolak/selesai` untuk permintaan material; `tersedia/dipakai/perbaikan/dilelang/dihapus` untuk aset) konsisten dengan CHECK constraint masing-masing. `/inventory/dashboard` dan `/inventory/stok` masuk Kelompok A sebagai LAPORAN.

---

# Kelompok F — Operations, K3, Deployment, Pengaturan · 6 blok

### /ops/tiket — AKSI-KURANG (kritis, blokir database)
Tabel: `tickets`
Sudah ada di form: seluruh field pembuatan tiket (`source, ticket_type, customer_*, address, branch_id, network_element_id, category, sub_category, severity, sla_minutes, description`) — field-nya lengkap.
Aksi yang belum bisa dicapai: **tidak relevan, karena insert-nya sendiri gagal.** Kode menulis `status: 'baru'` (baris `insert('tickets', …)`), sedangkan CHECK constraint `tickets_status_check` hanya mengizinkan `open, assigned, on_progress, pending, resolved, closed, cancelled`. Update lanjutan juga menulis `ditugaskan/selesai/ditutup` — sama-sama di luar constraint (kecuali kebetulan cocok, tak ada satupun yang cocok).
Diisi sistem: `id, company_id, ticket_no, reported_at, ttr_minutes, sla_status, created_at, updated_at, created_by`.
Catatan bisnis: **perbaikan prioritas #1.** Putuskan satu kosakata status (disarankan: ubah CHECK constraint & migrasi ke Indonesia agar konsisten dengan modul lain — `open→dibuat/baru`, dst — atau sebaliknya ubah kode ke Inggris agar konsisten dengan constraint asli), lalu terapkan konsisten di `Tiket.tsx`, `WorkOrder.tsx`, `Dispatch.tsx`, dan cek ulang trigger di `0008_views_functions.sql` yang bergantung pada nilai `'done'`.

### /ops/work-order — AKSI-KURANG (kritis, blokir database)
Tabel: `work_orders`
Sudah ada di form: field lengkap (`wo_type, ticket_id, project_id, spk_id, job_type_id, title, description, customer_*, address, branch_id, scheduled_at, assigned_to`).
Aksi yang belum bisa dicapai: insert menulis `status: 'belum_ditugaskan'`, tidak ada dalam CHECK constraint `work_orders_status_check` (`draft, dispatched, accepted, on_progress, pending_material, done, failed, cancelled`).
Diisi sistem: `id, company_id, wo_no, evidence_count, points, amount, qc_status, created_at, updated_at, created_by`.
Catatan bisnis: satukan perbaikannya dengan `/ops/tiket` dan `/ops/dispatch` (Kelompok A) — ketiganya berbagi tabel/kosakata status yang sama dan harus diperbaiki dalam satu perubahan skema+kode.

### /pengaturan/pengguna — TAMBAH-BARU
Tabel: `profiles`
Sudah ada di form: edit `role`, `unit`, `branch_id`, `is_active` untuk pengguna yang sudah ada.
Aksi yang belum bisa dicapai: **tidak ada `insert(profiles)` di manapun** — tidak ada tombol "Tambah Pengguna". Karena `profiles.id` mengacu ke `auth.users`, pembuatan pengguna baru memerlukan alur undangan (invite) yang memicu Supabase Auth, bukan sekadar insert baris — perlu dirancang sebagai edge function/RPC, bukan insert langsung dari klien.
Wajib ditambahkan: form undangan pengguna — `full_name, email, role, unit, branch_id, employee_id` (opsional, untuk tautkan ke data HR).
Diisi sistem: `id (dari auth.users), company_id, created_at, updated_at, created_by, last_login_at`.
Catatan bisnis: perlu koordinasi dengan tim backend untuk edge function `invite_user` (kirim email undangan set-password) — bukan sekadar tambahan form React.

### /pengaturan/perusahaan — TAMBAH-BARU
Tabel: `companies`
Sudah ada di form: edit `name, npwp, address, phone, email, logo_url` milik perusahaan yang sedang login.
Aksi yang belum bisa dicapai: **tidak ada `insert(companies)` di manapun.** Aplikasi ini dirancang multi-perusahaan (`company_id` di hampir semua tabel, RLS berbasis `company_id`), tapi tidak ada UI apapun — bahkan untuk super_admin — untuk mendaftarkan perusahaan/tenant baru.
Wajib ditambahkan: halaman "Perusahaan Baru" (kemungkinan perlu role khusus di atas `super_admin` biasa) — `name, code, npwp, address, phone, email, plan`.
Diisi sistem: `id, created_at, updated_at, created_by, is_active, is_demo`.
Catatan bisnis: tanpa ini, onboarding klien baru NUSAKARYA sebagai SaaS **wajib** lewat SQL manual — risiko tinggi untuk kesalahan konfigurasi RLS.

### /k3/inspeksi — AKSI-KURANG
Tabel: `hse_inspections`
Sudah ada di form: seluruh field pembuatan inspeksi (`inspection_type, branch_id, inspector_id, target_ref, findings, score, result, photo_urls, follow_up, due_date`).
Aksi yang belum bisa dicapai: **tidak ada `update()` sama sekali** — insert selalu langsung `status: 'selesai'` (melompati `draft`), dan begitu tersimpan, tidak ada cara mengedit temuan atau menindaklanjuti item `follow_up`/`due_date` yang sudah dicatat (mis. menandai perbaikan sudah dilakukan).
Diisi sistem: `id, company_id, inspection_no, created_at, updated_at, created_by`.
Catatan bisnis: tambahkan drawer edit + tombol "Follow-up Selesai" agar `follow_up`/`due_date` yang dicatat inspektor benar-benar bisa ditutup, bukan sekadar catatan mati.

### /ops/alarm — AKSI-KURANG
Tabel: `nms_alarms`
Sudah ada di form: transisi `baru → diakui`, `baru → diabaikan`, `diakui → tiket_dibuat` (buat tiket dari alarm).
Aksi yang belum bisa dicapai: status `clear` ada di CHECK constraint (alarm yang hilang sendiri di sisi NMS) tapi **tidak ada tombol** untuk menandainya secara manual — hanya dipakai untuk pewarnaan tampilan, seakan-akan diisi oleh integrasi NMS otomatis yang belum ada.
Diisi sistem: `id, company_id, received_at, created_at, updated_at, created_by`.
Catatan bisnis: sampai ada integrasi NMS otomatis yang menulis `clear`, sediakan tombol manual "Tandai Clear" agar alarm lama yang sudah tidak relevan bisa dibersihkan dari antrean `baru`.

---

## Rute lain yang sudah CUKUP (untuk transparansi, ringkas)

Kelompok B: `/hr/cuti, /hr/disiplin, /hr/freelance, /hr/karyawan, /hr/kompetensi, /hr/komponen-gaji, /hr/lembur, /hr/payroll, /hr/penilaian, /hr/perjalanan, /hr/rekrutmen, /hr/roster, /hr/sertifikasi` — field dan transisi status sudah dibandingkan dan mencukupi.

Kelompok C: seluruh rute Commerce (`bast, invoice, klaim, komplain, kontrak, pelanggan, penalti, pipeline, price-list, spk`) dan Procurement lainnya (`gr, invoice-vendor, katalog, kontrak-vendor, pr, retur, rfq, scorecard`) — termasuk `/commerce/penalti` yang sudah memiliki field `breach_count` dan status bebas-pilih (`draft/diajukan/disetujui/dibayar/batal`, tanpa CHECK constraint di DB) yang seluruhnya dapat dipilih dari form.

Kelompok D: `/finance/anggaran, /ap, /ar, /cashflow, /coa, /job-costing, /jurnal, /kas-kecil`.

Kelompok F: `/ops/aset-jaringan, /ops/eskalasi, /ops/maintenance, /ops/pengetahuan, /ops/rca, /ops/sla-pelanggan, /k3/insiden, /k3/izin-kerja`, seluruh rute Deployment (`proyek, survey, drm, boq, progres, qc, dokumen, rfs, perizinan, punchlist, garansi, subkon` — termasuk status proyek 10-tahap dan status subkon/perizinan yang sudah lengkap sesuai CHECK constraint), `/pengaturan/cabang, /hak-akses` (matriks toggle, bukan form `<Field>`, tapi insert/update-nya berfungsi), `/pengaturan/master, /pengaturan/tampilan` (murni preferensi tampilan lokal, tidak terhubung tabel), `/pengaturan/kesiapan` (laporan kesiapan produksi dari view, memang read-only by design), `/notifikasi, /persetujuan`.
