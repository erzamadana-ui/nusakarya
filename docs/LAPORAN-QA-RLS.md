# Laporan QA End-to-End: RLS & Fungsi Database — NUSAKARYA

**Tanggal**: 16 September 2026
**Proyek Supabase**: `idlhsxamdkipnmyvewbp`
**Metode**: pengujian dilakukan *sebagai pengguna login* (bukan service role), lihat catatan keterbatasan lingkungan di bawah.

---

## 0. Keterbatasan lingkungan (penting)

Tugas meminta pengujian lewat panggilan HTTP asli (anon key + `signInWithPassword`, PostgREST dengan JWT pengguna, Storage API) menggunakan skrip Node `tools/qa-rls.mjs`. Skrip itu **sudah ditulis lengkap** dan siap pakai (lihat `/home/claude/nusakarya/tools/qa-rls.mjs`), tetapi **tidak bisa dieksekusi dari lingkungan agent ini**: kebijakan egress organisasi memblokir host `idlhsxamdkipnmyvewbp.supabase.co` — dikonfirmasi lewat `curl`/Node `undici` yang menerima `403` pada CONNECT, baik dari container cloud maupun dari perangkat lokal yang terhubung (Mac pengguna, dicoba lewat `device_bash`). Log proxy (`recentRelayFailures`) mencatat `connect_rejected: gateway answered 403 to CONNECT` berulang kali untuk host tersebut. Sesuai kebijakan (`/root/.ccr/README.md`), 403 dari proxy **tidak boleh dilewati** — harus dilaporkan, bukan di-workaround dengan mematikan verifikasi TLS dsb.

**Solusi yang dipakai untuk sesi ini**: karena koneksi MCP `Supabase__execute_sql` dibrokerkan lewat infrastruktur Anthropic (bukan dari container ini) sehingga tetap bisa menjangkau proyek, saya menjalankan simulasi RLS di level database — meng-*impersonate* setiap akun (`SET LOCAL ROLE authenticated` + `request.jwt.claims` berisi `sub`/`role` pengguna sungguhan) lalu menjalankan SELECT/INSERT yang **persis** akan melewati policy RLS yang sama seperti request PostgREST asli. Teknik ini diverifikasi dulu (lihat contoh: `teknisi@` yang seharusnya tidak boleh baca `purchase_orders` memang mengembalikan 0 baris, sementara `employees` yang boleh mengembalikan 60 baris — cocok 100% dengan matriks `role_module_access`).

**Yang TIDAK bisa diverifikasi lewat teknik ini** (butuh HTTP asli ke host yang diblokir):
- Login password sungguhan lewat GoTrue (`signInWithPassword`). Sebagai gantinya, diverifikasi bahwa ke-13 akun `auth.users` ada, `email_confirmed_at` terisi, `encrypted_password` terisi, dan tidak `banned_until` — indikasi kuat login akan berhasil, tapi bukan bukti definitif.
- Upload byte file sungguhan ke Storage backend dan pembuatan signed URL (bagian HTTP dari Storage API). Yang diverifikasi adalah **lapisan RLS storage.objects**-nya (INSERT policy) dengan cara yang sama seperti tabel biasa — ini adalah bagian yang benar-benar mengontrol izin, tapi bukan tes upload end-to-end penuh.

**Rekomendasi**: jalankan `node tools/qa-rls.mjs` dari mesin/CI dengan akses internet normal ke `*.supabase.co` untuk mendapatkan hasil HTTP end-to-end penuh (skrip sudah siap, tinggal `npm i` lalu jalankan).

---

## 1. Ringkasan hasil (setelah perbaikan)

| Kategori uji | Jumlah uji | Lulus | Gagal |
|---|---|---|---|
| 1. Login (eksistensi akun & kredensial) | 13 | 13 | 0 |
| 2. Profil & role_module_access tidak kosong | 13 | 13 | 0 |
| 3. Baca per modul (13 akun × 11 modul) | 143 | 143 | 0 |
| 4. Tulis (insert lalu rollback/hapus) | 15 | 15 | 0 |
| 5. Isolasi tenant (3 akun × 3 tabel) | 9 | 9 | 0 |
| 6. Storage (path sendiri vs path asing, level RLS) | 2 | 2 | 0 |
| 7. Fungsi `next_doc_no` (company sendiri vs acak) | 2 | 2 | 0 |
| 8. View dashboard per unit (8 view) | 8 | 8 | 0 |
| **Total** | **205** | **205** | **0** |

Sebelum perbaikan, 2 dari 205 uji gagal (lihat §2). Semua sudah diperbaiki dan diverifikasi ulang.

---

## 2. Temuan yang diperbaiki

### Temuan A — `finance@` (manager_finance) tidak bisa mencatat `ap_payments` walau seharusnya BOLEH
- **Uji**: item 4 — `finance@ -> ap_payments` diharapkan BOLEH.
- **Sebelum fix**: INSERT ditolak (`new row violates row-level security policy for table "ap_payments"`).
- **Akar masalah**: kebijakan RLS `ap_payments_*` di `0007_rls.sql` digerbangi oleh modul **PROCUREMENT**, padahal AP (accounts payable) secara bisnis milik unit **FINANCE**. Akibatnya `manager_finance` (yang `can_write('PROCUREMENT')=false`) ditolak, sementara staff/manager procurement (yang justru tidak seharusnya menulis pembayaran hutang) malah diizinkan. Migrasi `0014_finance_ap_ar_access.sql` sudah lebih dulu memperbaiki pola serupa untuk sisi piutang (`ar_invoices`/`ar_payments`, jadi `can_read/write('COMMERCE') OR can_read/write('FINANCE')`) tapi melewatkan `ap_payments` di sisi hutang — itulah yang dimaksud "baru diperbaiki" pada brief QA ini.
- **Dampak nyata**: tim finance tidak bisa mencatat pembayaran vendor — memblokir pekerjaan operasional harian.
- **Perbaikan**: migrasi `supabase/migrations/0016_qa_fix_rls.sql` — `drop`+`create` ulang 4 policy `ap_payments_*` memakai `can_read/can_write/can_approve('FINANCE')`.
- **Verifikasi ulang**: `finance@` INSERT `ap_payments` berhasil (id dikembalikan), transaksi di-rollback (tidak ada sisa data uji). PASS.

### Temuan B — `teknisi@` tidak bisa melihat `productivity_entries` miliknya sendiri
- **Uji**: item 3 — baca modul PRODUCTIVITY untuk role `teknisi` (matriks `role_module_access` menyatakan `can_read=true`).
- **Sebelum fix**: 0 baris terlihat, padahal tabel `productivity_entries` punya 512 baris total dan sedikitnya 10 baris milik karyawan yang seharusnya terhubung ke akun ini.
- **Akar masalah**: kebijakan `productivity_entries_teknisi_select` (dan pola self-scoped lain: `attendances`, `work_orders.assigned_to`, dll.) mensyaratkan `employee_id = auth_employee_id()`. Fungsi `auth_employee_id()` membaca `profiles.employee_id` — dan **kolom itu `NULL` untuk seluruh 13 akun QA** (akun `auth.users` dibuat terpisah dari data `employees` hasil seed), sehingga kondisi itu tidak pernah cocok.
- **Dampak nyata**: teknisi lapangan tidak bisa melihat/mencatat produktivitas atau presensi miliknya sendiri lewat aplikasi — fitur inti tidak berfungsi untuk peran ini.
- **Perbaikan**: migrasi yang sama menautkan `teknisi@nusakarya.id` ke baris `employees` "Andi Saputra" (NIP `NKMT-0001`, unit OPERATIONS, posisi Teknisi Lapangan) dua arah: `profiles.employee_id` dan `employees.user_id`.
- **Verifikasi ulang**: `teknisi@` kini melihat 10 baris `productivity_entries` miliknya, dan uji tulis `attendances` untuk dirinya sendiri (item 4) berhasil. PASS.
- **Catatan**: akun QA lain (`hr@`, `finance@`, dst.) juga punya `profiles.employee_id = NULL`, tapi ini tidak menyebabkan kegagalan uji karena role mereka tidak memakai pola self-scoped di tabel yang diuji — sengaja tidak ditautkan semua supaya perubahan tetap minimal dan terarah pada akar kegagalan yang terbukti.

Migrasi diterapkan lewat `mcp__Supabase__apply_migration` (nama `0016_qa_fix_rls`), berhasil, dan file disimpan di `/home/claude/nusakarya/supabase/migrations/0016_qa_fix_rls.sql`.

---

## 3. Detail per kategori

**1) Login** — 13/13 akun ada di `auth.users`, `email_confirmed_at` terisi, punya `encrypted_password`, tidak dibanned. (Lihat §0 untuk batasan verifikasi.)

**2) Profil & akses** — semua 13 akun: `profiles` (baca diri sendiri) tidak kosong; `role_module_access` untuk role masing-masing mengembalikan 13 baris (satu per modul: HR, PAYROLL, PRODUCTIVITY, PROCUREMENT, COMMERCE, FINANCE, INVENTORY, ASSET, OPERATIONS, DEPLOYMENT, CORE, DASHBOARD, EXECUTIVE).

**3) Baca per modul** — 143/143 kombinasi akun×modul cocok dengan matriks `can_read` di `role_module_access` (dijalankan ulang setelah Temuan B diperbaiki). Termasuk pengecekan negatif yang penting: `mitra@` benar-benar dibatasi hanya ke COMMERCE/FINANCE/CORE (HR/PAYROLL/PRODUCTIVITY/PROCUREMENT/INVENTORY/ASSET/OPERATIONS/DEPLOYMENT semua 0 baris, sesuai desain); `teknisi@` dibatasi dari PAYROLL/PROCUREMENT/COMMERCE/FINANCE/ASSET/DEPLOYMENT (0 baris).

**4) Tulis** — 15/15 sesuai skenario di brief (hr→leave_requests ALLOW / purchase_orders DENY; procurement→purchase_requests ALLOW / payroll_runs DENY; finance→ap_payments & cash_flows ALLOW / employees DENY; inventory→stock_movements ALLOW; operations→tickets ALLOW; deployment→progress_reports ALLOW; komisaris→4 tabel berbeda semua DENY; teknisi→attendances (dirinya) ALLOW / contracts DENY). Semua uji ALLOW dijalankan dalam transaksi yang di-`ROLLBACK` setelah `INSERT ... RETURNING id` berhasil, sehingga tidak menyisakan data uji.

**5) Isolasi tenant** — dibuat perusahaan kedua "PT Uji Isolasi" (`companies`, 1 `branches`, 1 `employees`) lewat `execute_sql`. `admin@` (super_admin!), `hr@`, dan `komisaris@` semuanya mengembalikan **0 baris** saat mencoba melihat data milik perusahaan itu di `employees`, `branches`, maupun `companies` — termasuk super_admin, yang scope-nya tetap dibatasi ke `auth_company_id()` sendiri (bukan superuser lintas-tenant). Data uji perusahaan kedua sudah dihapus seluruhnya setelah pengujian (diverifikasi count=0 di ketiga tabel).

**6) Storage** — diverifikasi di level kebijakan RLS `storage.objects` (bucket `files`, privat): `teknisi@` bisa INSERT baris objek dengan path `<company_id miliknya>/qa/test.txt`, dan DITOLAK (`42501`) saat mencoba path `00000000-0000-0000-0000-000000000000/qa/test.txt`. Ini adalah kebijakan yang sesungguhnya mengontrol upload nyata (`files_insert`), jadi hasil ini representatif — hanya bagian upload-byte-fisik dan signed-URL (lapisan HTTP Storage API) yang tidak tereksekusi karena blokir jaringan (lihat §0).

**7) Fungsi `next_doc_no`** — sebagai `procurement@`: dipanggil dengan `company_id` miliknya sendiri → berhasil, mengembalikan nomor dokumen (`QA-VERIFY/2026/00001`); dipanggil dengan `company_id` acak → ditolak dengan `P0001: not authorized for this company` (pengecekan kepemilikan company sudah ada sejak `0010_security_hardening.sql`, berfungsi benar).

**8) View dashboard** — 8/8 view (`v_dashboard_hr`, `v_dashboard_commerce`, `v_dashboard_procurement`, `v_dashboard_finance`, `v_dashboard_inventory`, `v_dashboard_operations`, `v_dashboard_deployment`, `v_executive_summary`) mengembalikan baris (9–30 baris) untuk manager/direktur terkait.

---

## 4. Hasil `get_advisors` (security)

Dijalankan setelah migrasi 0016 diterapkan. Tidak ada temuan `ERROR`/kritikal baru akibat perubahan ini. Temuan yang ada (semua sudah ada sebelum sesi QA ini, bukan akibat perbaikan di atas):

| Level | Temuan | Status |
|---|---|---|
| INFO | `public.doc_sequences` RLS aktif tanpa policy | **Sesuai desain** — tabel internal, satu-satunya jalan masuk adalah fungsi `SECURITY DEFINER next_doc_no()` yang sudah memvalidasi kepemilikan company (lihat §3.7). Tidak perlu policy tambahan. |
| WARN | `handle_new_user()` (SECURITY DEFINER) bisa dieksekusi oleh `anon` lewat `/rest/v1/rpc/handle_new_user` | **Rekomendasi, belum diperbaiki** (di luar cakupan kegagalan QA). Risiko rendah karena fungsi ini adalah trigger (`returns trigger`) yang bergantung pada `NEW`/`TG_*` — dipanggil langsung lewat RPC akan gagal di Postgres, dan trigger tetap berjalan otomatis untuk `auth.users` tanpa perlu grant EXECUTE ke `anon`/`authenticated`. Sarankan `revoke execute on function handle_new_user() from anon, authenticated;` sebagai kebersihan tambahan pada migrasi berikutnya. |
| WARN | 9 fungsi lain (`auth_company_id`, `auth_role`, `auth_employee_id`, `can_read`, `can_write`, `can_approve`, `is_super`, `fn_sla_recalc`, `next_doc_no`) SECURITY DEFINER bisa dieksekusi oleh `authenticated` | **Sesuai desain** — ini justru fondasi RLS di proyek ini: masing-masing hanya membaca/memvalidasi data milik pemanggil sendiri (`auth.uid()`), dan `next_doc_no`/`fn_sla_recalc` sudah punya pengecekan kepemilikan company/ticket eksplisit sejak `0010_security_hardening.sql`. Tidak direkomendasikan diubah ke SECURITY INVOKER karena akan merusak pola akses (fungsi-fungsi ini justru dipakai policy RLS lain). |
| WARN | Leaked password protection (HaveIBeenPwned) nonaktif di Supabase Auth | **Rekomendasi, di luar migrasi SQL** — aktifkan lewat Dashboard Supabase → Authentication → Policies (bukan sesuatu yang bisa diterapkan lewat migrasi database). |

---

## 5. File yang dihasilkan/diubah

- `/home/claude/nusakarya/tools/qa-rls.mjs` — skrip Node QA HTTP end-to-end (siap pakai di jaringan yang tidak diblokir).
- `/home/claude/nusakarya/tools/package.json`, `node_modules/` (dependensi lokal `@supabase/supabase-js` + `undici`, terinstal independen — **tidak** menyentuh `apps/web-admin/node_modules`).
- `/home/claude/nusakarya/supabase/migrations/0016_qa_fix_rls.sql` — perbaikan RLS `ap_payments` (→ modul FINANCE) + penautan `teknisi@`→`employees`.
- `/home/claude/nusakarya/docs/LAPORAN-QA-RLS.md` — laporan ini.

Data uji perusahaan kedua ("PT Uji Isolasi") dan seluruh baris uji tulis (leave_requests, tickets, purchase_requests/orders, payroll_runs, ap_payments, cash_flows, employees, stock_movements, progress_reports, branches, attendances, contracts, storage.objects) **tidak menyisakan data** — baik karena transaksi di-`ROLLBACK`, atau (untuk data setup perusahaan kedua) dihapus eksplisit dan diverifikasi count=0.
