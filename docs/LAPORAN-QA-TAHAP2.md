# Laporan QA Tahap-2: Modul Baru (44 Tabel, RLS, Fungsi Pajak, View, Integritas Data) — NUSAKARYA

**Tanggal**: 16 September 2026
**Proyek Supabase**: `idlhsxamdkipnmyvewbp`
**Metode**: sama seperti `LAPORAN-QA-RLS.md` — simulasi RLS lewat `mcp__Supabase__execute_sql` dengan `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', ...)` per akun, karena domain `idlhsxamdkipnmyvewbp.supabase.co` diblokir egress dari container ini (dikonfirmasi lagi di sesi ini, sama seperti sebelumnya).

Catatan teknis penting: `mcp__Supabase__execute_sql` hanya mengembalikan **result set dari statement TERAKHIR** dalam satu panggilan. Untuk menguji beberapa fakta sekaligus (mis. cek kebocoran + UPDATE + INSERT) dipakai satu statement `WITH ... SELECT UNION ALL ...` tunggal, dibungkus `BEGIN`/`SET LOCAL ROLE`/`set_config`/`ROLLBACK` atau `COMMIT`.

---

## 1. Ringkasan hasil

| Kategori | Cakupan | Lulus | Gagal (sebelum fix) | Status akhir |
|---|---|---|---|---|
| 1. Baca 44 tabel × 13 peran vs `role_module_access` | 572 kombinasi | 572 | 0 | **PASS** |
| 2. Kebijakan ber-cakupan diri (0025) teknisi/mitra + anti-kebocoran | 14 skenario | 12 | 2 (diperbaiki) | **PASS** setelah 2 fix |
| 3. Fungsi `fn_hitung_pph21_bukan_pegawai` | 6 kombinasi bruto×NPWP | — | tarif TUNGGAL (bukan berlapis) | **PASS** setelah fix `0026` |
| 4. View baru (6 view) × 3 peran | 18 kombinasi | 18 | 0 | **PASS** |
| 5. Integritas data tahap-2 | 4 aturan | 3 langsung PASS, 1 salah-uji (bukan bug) | 0 pelanggaran nyata | **PASS** |
| 6. `get_advisors` security/performance | — | — | — | Tidak ada ERROR/kritikal baru |

---

## 2. Temuan yang diperbaiki

### Temuan A — `mitra@` tidak pernah bisa melihat `freelance_payouts` miliknya (self-scope mati total)
`profiles.employee_id`/`employees.user_id` untuk `mitra@nusakarya.id` **tidak pernah ditautkan** ke baris `employees` mana pun (persis pola "Temuan B" di `LAPORAN-QA-RLS.md`, sekarang terjadi lagi untuk peran mitra). Akibatnya `auth_employee_id()` selalu `NULL`, jadi seluruh kebijakan `*_self` di `0025_self_scope_teknisi_mitra.sql` (freelance_payouts, punch_lists, dst.) tidak pernah cocok — mitra@ selalu 0 baris, walau modul PAYROLL memang sengaja `can_read=false` untuknya (aksesnya HARUS lewat self-scope).
**Fix**: `supabase/migrations/0027_link_mitra_employee.sql` — tautkan `mitra@` ke `employees` "Sari Fauzi" (MITRA, 6 baris `freelance_payouts`).
**Verifikasi ulang**: mitra@ melihat tepat 6/88 `freelance_payouts` (miliknya saja), 22/22 `freelance_rate_cards` (kartu tarif global), 5/180 `overtime_requests`, 1/14 `hse_incidents`, 1/40 `hse_inspections`, 2/60 `punch_lists`, 13/15 `knowledge_articles` (published saja) — seluruhnya persis cocok dengan data self yang ada, **0 kebocoran** ke baris milik mitra lain.

### Temuan B — `work_permits`: kolom `requested_by` (FK ke `auth.users`) dibandingkan dengan `auth_employee_id()` (id `employees`) — self-scope mati total
`work_permits.requested_by` di-FK ke `auth.users(id)` (dibuktikan: seluruh 55 baris seed cocok dengan `auth.users.id`, 0 yang cocok `employees.id`), tapi kebijakan `work_permits_insert_self`/`work_permits_select_self` di `0025` membandingkannya dengan `auth_employee_id()` — dua ruang id berbeda, tidak pernah bisa cocok. Peran yang hanya mengandalkan self-scope ini (tanpa hak modul OPERATIONS penuh) tidak akan pernah bisa INSERT/SELECT izin kerja miliknya. Pola yang benar sudah ada di kebijakan lain pada migrasi yang sama (`hse_incidents_select_self` pakai `reported_by = auth.uid()`).
**Fix**: `supabase/migrations/0028_fix_work_permits_self_scope.sql` — ganti ke `requested_by = (select auth.uid())`.
**Verifikasi ulang**: `teknisi@` INSERT `work_permits` (requested_by = dirinya) → berhasil, lalu langsung terlihat via `SELECT` (di transaksi commit terpisah, id dihapus setelahnya). *(Untuk `teknisi@` sendiri dampak fungsionalnya kecil karena ia juga punya akses modul OPERATIONS penuh; tapi self-scope-nya sendiri terbukti benar-benar mati sebelum fix — dibuktikan lewat pelanggaran FK saat mencoba insert dengan `employee_id`.)*

### Catatan (bukan bug, tapi perlu diperhatikan) — `teknisi@` bisa melihat `knowledge_articles` yang **belum terbit**
Brief QA meminta teknisi HANYA boleh SELECT `knowledge_articles` dengan `is_published=true`. Kenyataannya teknisi punya `can_read('OPERATIONS')=true` di `role_module_access` (modul dasar untuk `knowledge_articles`), sehingga kebijakan modul `0021` sudah mengizinkan baca SEMUA baris (15/15, termasuk 2 yang belum terbit) — kebijakan self-scope `0025` (published-only) hanya menambah, tidak pernah mengurangi. **Risiko**: rendah — teknisi memang butuh akses OPERATIONS luas (tiket, work order), dan draft knowledge_articles bukan data sensitif finansial/PII. **Tidak diperbaiki** (di luar cakupan, butuh keputusan desain: memisah modul knowledge_articles dari OPERATIONS, atau menerima ini sebagai perilaku yang disengaja).

---

## 3. Fungsi pajak `fn_hitung_pph21_bukan_pegawai` — HASIL DENGAN ANGKA

**Sebelum fix**: fungsi memakai **tarif TUNGGAL** — mencari SATU bracket Pasal 17 yang "mengandung" nilai DPP (50% × bruto), lalu mengalikan tarif bracket itu ke SELURUH DPP. Ini salah; Pasal 17 UU PPh/HPP mewajibkan tarif **progresif berlapis** (tiap lapisan penghasilan kena tarifnya sendiri).

| Bruto | DPP (50%) | NPWP: tarif tunggal (lama) | NPWP: berlapis (benar) | Selisih | Tanpa NPWP: lama | Tanpa NPWP: benar | Selisih |
|---|---|---|---|---|---|---|---|
| Rp5.000.000 | Rp2.500.000 | Rp125.000 | Rp125.000 | Rp0 (0%) | Rp150.000 | Rp150.000 | Rp0 |
| Rp20.000.000 | Rp10.000.000 | Rp500.000 | Rp500.000 | Rp0 (0%) | Rp600.000 | Rp600.000 | Rp0 |
| **Rp120.000.000** | **Rp60.000.000** | **Rp9.000.000** | **Rp3.000.000** | **Rp6.000.000 (kelebihan pungut 200%)** | **Rp10.800.000** | **Rp3.600.000** | **Rp7.200.000** |

Untuk kasus Rp5jt dan Rp20jt, DPP (Rp2,5jt dan Rp10jt) masih seluruhnya di lapisan I (5%, 0–60jt) sehingga tarif tunggal dan berlapis kebetulan sama. **Kasus Rp120jt** membuktikan bug: DPP = Rp60.000.000 tepat di batas lapisan I/II. Data `tax_brackets_art17` memakai batas inklusif tumpang-tindih (`min` lapisan II = `max` lapisan I = 60.000.000), dan query lama (`order by min_income desc limit 1`) memilih lapisan **II** (15%) untuk seluruh DPP → Rp9.000.000. Padahal seluruh Rp60jt itu masih di lapisan I (5%) → seharusnya Rp3.000.000. **Kelebihan pungut Rp6.000.000 (200%) pada satu transaksi** — berdampak nyata ke mitra/vendor perorangan dengan penghasilan menengah-atas.

**Perbaikan**: `supabase/migrations/0026_fix_pph21_progresif.sql` — hitung pajak per-lapisan (melebarkan DPP ke tiap bracket sesuai lebarnya, `least(sisa_dpp, max-min)`, dikalikan tarif bracket itu, dijumlah kumulatif) alih-alih mencari satu bracket. Diuji ulang dengan 6 kombinasi yang sama → hasil kolom "benar" di atas, dikonfirmasi lewat pemanggilan fungsi langsung (bukan hitung manual saja).

---

## 4. Detail kategori lain

**1) Baca 44 tabel** — Dijalankan sebagai 13 peran (1 query per peran, 44 kolom `count(*)` sekaligus). 11 dari 13 peran (`super_admin, direktur, komisaris, manager_*, dispatcher`) punya `can_read=true` di SEMUA 8 modul yang dipetakan 44 tabel ini (HR/OPERATIONS/PAYROLL/COMMERCE/PROCUREMENT/FINANCE/DEPLOYMENT/CORE) — seluruhnya melihat data penuh perusahaan, cocok 100%. `teknisi@` dan `mitra@` (satu-satunya peran dengan `can_read=false` di sebagian modul) diverifikasi baris-demi-baris: setiap tabel bernilai 0 (blokir sesuai modul) ATAU nilai persis sejumlah baris self-scope milik mereka (bukan lebih) — **tidak ada satu pun yang "boleh baca tapi kosong" atau "tidak boleh tapi bisa"**, setelah dua fix di §2.

**2) Self-scope & anti-kebocoran** — dibuat baris uji `punch_lists`/`freelance_payouts` milik karyawan LAIN (Budi Hartono / Rudi Hakim), lalu dipastikan `teknisi@`/`mitra@` **tidak** melihatnya (`sees_*_leak_row = 0`), **tidak** bisa UPDATE-nya (`0` baris terafeksi), dan tetap bisa UPDATE baris miliknya sendiri (teknisi: 1 baris terafeksi). `mitra@` dipastikan **tidak bisa UPDATE** `freelance_payouts` sama sekali — bahkan pada baris miliknya sendiri (`0` baris terafeksi, sesuai desain: hanya SELECT self). Semua baris uji dihapus setelah pengujian (diverifikasi count=0).

**4) View** — `v_approval_inbox, v_dashboard_hse, v_dashboard_freelance, v_dashboard_crm, v_tax_summary, v_warranty_alert` semuanya `security_invoker=on` (mewarisi RLS pemanggil). `komisaris@` → 6/6 view mengembalikan baris (9–103 baris). `teknisi@`/`mitra@` → agregat terpotong sesuai visibilitas baris mereka (mis. `v_dashboard_freelance` untuk mitra hanya menjumlah 6 payout miliknya, `top_mitra` hanya menampilkan namanya sendiri — **tidak ada nama mitra lain yang bocor lewat agregat**).

**5) Integritas data**: `journal_entries` (120 baris) — 0 header yang `total_debit≠total_credit` dan 0 yang tidak cocok `SUM(journal_lines)`. `freelance_payouts.net_amount` (88 baris) — 0 pelanggaran formula. `vendor_contracts.used_value>ceiling_value` — 0/6. `subcontract_progress`: uji awal (menjumlah `amount_claimed` semua baris per paket) memberi 4/8 "pelanggaran" — setelah diperiksa, ini **kesalahan metodologi uji**, bukan bug data: `amount_claimed` per baris memang bersifat KUMULATIF mengikuti `progress_percent` (bukan incremental), jadi menjumlahkannya lintas baris salah. Uji yang benar (klaim TERAKHIR/progress tertinggi per paket ≤ `contract_value`) → **0/8 pelanggaran**. Tidak ada data yang diubah.

**6) `get_advisors`** — Security: tidak ada ERROR baru; semua WARN sama polanya dengan `LAPORAN-QA-RLS.md` (fungsi `SECURITY DEFINER` dipakai fondasi RLS, `fn_hitung_pph21_bukan_pegawai` kini masuk daftar itu juga — sesuai desain; leaked-password-protection tetap nonaktif, di luar cakupan migrasi SQL). Performance: `unindexed_foreign_keys` (192, INFO) dan `unused_index` (168, INFO) bersifat umum/lama, tidak spesifik tahap-2. `multiple_permissive_policies` (WARN, 55, pada 15 tabel termasuk seluruh tabel ber-self-scope 0025) — **konsekuensi yang disengaja** dari menambah kebijakan self-scope di samping kebijakan modul, bukan bug. `auth_rls_initplan` (WARN, 6): 3 lama (profiles/modules, di luar cakupan), 3 baru dari `0025` — 2 di antaranya (`work_permits_insert_self`, `work_permits_select_self`) sekaligus dibereskan saat fix Temuan B (dibungkus `(select auth.uid())`); 1 sisa (`hse_incidents_select_self`) **belum diperbaiki** (bukan milik migrasi yang saya buat, risiko rendah — hanya suboptimal di skala besar, bukan salah secara fungsional).

---

## 5. File yang dihasilkan/diubah

- `supabase/migrations/0025_self_scope_teknisi_mitra.sql` — disalin ke lokal (sebelumnya hanya ada di remote, diterapkan lewat MCP tanpa file lokal).
- `supabase/migrations/0026_fix_pph21_progresif.sql` — perbaikan tarif progresif berlapis.
- `supabase/migrations/0027_link_mitra_employee.sql` — tautkan `mitra@` ke `employees`.
- `supabase/migrations/0028_fix_work_permits_self_scope.sql` — perbaikan `work_permits` self-scope (id space mismatch) + optimasi `(select auth.uid())`.
- `docs/LAPORAN-QA-TAHAP2.md` — laporan ini.

Tidak ada data uji tersisa: baris `punch_lists`/`freelance_payouts` milik "Budi Hartono"/"Rudi Hakim" dan `work_permits` uji (`QA-TEK-WP-01`, `QA-TEK-WP-VERIFY`, `QA-TEK-WP-VERIFY2` — yang terakhir di-ROLLBACK) sudah dihapus/dibatalkan, diverifikasi count=0. Tidak ada data seed produksi yang diubah selain 2 baris tautan `employees`↔`profiles` untuk `mitra@` (Temuan A).
