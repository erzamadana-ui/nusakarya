# Audit UI Input — Kelompok A (hr, hr-extended, payroll-freelance, commerce, commerce-procurement-extended, procurement)

Auditor: QA Fungsional NUSAKARYA. Lingkup: `apps/web-admin/src/modules/{hr,hr-extended,payroll-freelance,commerce,commerce-procurement-extended,procurement}`.

Ringkasan temuan utama: bertentangan dengan kesan awal ("hanya tabel dan ekspor"), mayoritas halaman transaksi di ruang lingkup ini **sudah** memiliki siklus Tambah → Ubah → Hapus/Batal → aksi alur kerja lengkap, dengan tombol tulis yang digerbangi `can(modul,'write'|'approve')`. Dashboard (3 halaman) memang read-only by design — sesuai konvensi, tidak perlu form input.

Gap konkret yang ditemukan & DIPERBAIKI pada audit ini:
1. **Roster.tsx** — sel jadwal mingguan bisa diklik & diubah oleh siapa pun tanpa gerbang `can('HR','write')` (hanya tombol "Kelola Shift" yang digerbangi, bukan grid itu sendiri). Hapus master shift langsung tanpa dialog konfirmasi.
2. **KomponenGaji.tsx** — form "Tambah/Hapus Komponen Gaji per Karyawan" di dalam drawer tidak digerbangi `can('PAYROLL','write')` sama sekali, dan hapus penetapan langsung tanpa konfirmasi.
3. **Validasi tanggal selesai ≥ tanggal mulai** belum ada di 6 form: Cuti, Perjalanan Dinas (SPPD + biaya), Kontrak (Commerce), Kontrak Vendor, SPK, dan pembuatan Kontrak dari Peluang (Pipeline).
4. **Validasi nominal tidak boleh negatif** ditambahkan di form-form yang sama plus Komponen Gaji dan Penilaian Kinerja (bobot/skor).
5. **Penilaian Kinerja** — hanya ada aksi "Setujui"; status `disanggah` ada di skema tapi tak pernah bisa dicapai dari UI. Ditambahkan aksi "Sanggah" dan tab status "Disanggah".
6. **Pesan galat RLS** pada 4 fungsi simpan/hapus di atas kini menyebut modul & hak yang kurang (mis. "hak akses Anda pada modul PAYROLL tidak mengizinkan penulisan — perlu izin write"), bukan sekadar meneruskan `e.message` mentah.

Build: `npm run build` LULUS (tsc -b && vite build, 0 error) setelah seluruh perbaikan.

## Tabel Audit Lengkap

| Path Halaman | Tambah | Ubah | Hapus/Batal | Aksi Alur | Status Sebelum | Yang Ditambahkan |
|---|---|---|---|---|---|---|
| hr/pages/Karyawan.tsx | Ya (Modal) | Ya | Ya (ConfirmDialog, nonaktifkan) | Ya (aktif/nonaktif via approve) | Lengkap | - |
| hr/pages/Cuti.tsx | Ya | - (dokumen final setelah diajukan) | - | Ya (Setujui/Tolak+alasan) | Lengkap, tanpa validasi tanggal | + validasi tanggal selesai ≥ mulai |
| hr/pages/Absensi.tsx | Tidak perlu (data dari app lapangan) | Ya (Koreksi Manual, gated `HR,approve`) | - | - (koreksi = workflow) | Lengkap by design | - |
| hr/pages/Roster.tsx | Ya (sel grid + master shift) | Ya | Ya (master shift) | Tidak perlu (tanpa status) | **Grid tak digerbangi can(write); hapus shift tanpa konfirmasi** | + gerbang `can('HR','write')` pada klik sel grid; + `ConfirmDialog` hapus shift; + pesan galat RLS |
| hr/pages/KomponenGaji.tsx | Ya (master + penetapan karyawan) | Ya (master) | Ya (penetapan) | Tidak perlu (master data) | **Drawer penetapan tak digerbangi can(write); hapus tanpa konfirmasi** | + gerbang `can('PAYROLL','write')` pada tambah/hapus penetapan; + `ConfirmDialog`; + validasi tanggal & nominal; + pesan galat RLS |
| hr/pages/Payroll.tsx | Ya (Buat Periode) | Ya | - | Ya (Verifikasi/Setujui/Tandai Dibayar/Tutup Periode) | Lengkap | - |
| hr/pages/Produktivitas.tsx | Ya (master jenis pekerjaan, gated) | Ya | Tidak perlu | Ya (Verifikasi massal) | Lengkap by design | - |
| hr/pages/Sertifikasi.tsx | Ya | Ya | - | Tidak perlu (status aktif/nonaktif via edit) | Lengkap | - |
| hr-extended/pages/Disiplin.tsx | Ya | Ya | - | Tidak perlu (status via edit form) | Lengkap | - |
| hr-extended/pages/Kasbon.tsx | Ya | Ya | - | Ya (Ajukan/Setujui/Tolak/Cair) | Lengkap | - |
| hr-extended/pages/Lembur.tsx | Ya | Ya | - | Ya (Ajukan/Setujui/Tolak) | Lengkap | - |
| hr-extended/pages/Kompetensi.tsx | Ya (matriks + training) | Ya | Tidak perlu | Tidak perlu (assessment langsung) | Lengkap by design | - |
| hr-extended/pages/Penilaian.tsx | Ya (item aspek tambah/hapus) | - | Ya (baris aspek) | **Hanya Setujui, status "disanggah" tak tercapai** | Kurang 1 aksi alur | + tombol "Sanggah" (→status disanggah) + tab status baru + validasi bobot/skor tidak negatif + pesan galat RLS |
| hr-extended/pages/Perjalanan.tsx | Ya (SPPD + biaya) | - | - | Ya (Setujui/Tolak SPPD, verifikasi biaya) | Lengkap, tanpa validasi | + validasi tanggal kembali ≥ berangkat & nominal ≥ 0 |
| hr-extended/pages/Rekrutmen.tsx | Ya (lowongan + pelamar) | Ya | - | Ya (Tolak pelamar, dsb.) | Lengkap | - |
| payroll-freelance/pages/MitraFreelance.tsx | Ya (rate card) | Ya | - | Tidak perlu | Lengkap by design | - |
| payroll-freelance/pages/PayrollFreelance.tsx | Ya (wizard hitung periode) | Ya (baris pajak) | Tidak perlu | Ya (Verifikasi/Setujui/Tandai Dibayar) | Lengkap | - |
| commerce/pages/Pelanggan.tsx | Ya | Ya | Ya (ConfirmDialog) | Tidak perlu (status via edit) | Lengkap | - |
| commerce/pages/Kontrak.tsx | Ya | Ya | Ya (ConfirmDialog, gated approve) | Tidak perlu (status via edit) | Lengkap, tanpa validasi | + validasi tanggal & nilai kontrak ≥ 0 |
| commerce/pages/Spk.tsx | Ya | Ya | Ya (ConfirmDialog) | Tidak perlu (status via edit) | Lengkap, tanpa validasi | + validasi tanggal & nilai SPK ≥ 0 |
| commerce/pages/Bast.tsx | Ya | Ya | Ya (ConfirmDialog) | Ya (Tutup) | Lengkap | - |
| commerce/pages/Klaim.tsx | Ya (item BoQ) | Ya | Ya (ConfirmDialog) | Ya (Ajukan/Setujui/Tolak/Tandai Ditagihkan/Tutup) | Lengkap | - |
| commerce/pages/Invoice.tsx | Ya | Ya | Ya (ConfirmDialog) | Ya (Tandai Bayar via update status pembayaran) | Lengkap | - |
| commerce/pages/Penalti.tsx | Ya | Ya | Ya (ConfirmDialog) | Tidak perlu (status via edit) | Lengkap | - |
| commerce/pages/PriceList.tsx | Ya (item harga) | Ya | Ya (ConfirmDialog) | Tidak perlu (master data) | Lengkap | - |
| commerce-procurement-extended/pages/Pipeline.tsx | Ya (peluang + aktivitas + "Jadikan Kontrak") | Ya | Ya (ConfirmDialog) | Ya (tahapan pipeline) | Lengkap, tanpa validasi tanggal kontrak | + validasi tanggal & nilai kontrak saat "Jadikan Kontrak" |
| commerce-procurement-extended/pages/Komplain.tsx | Ya | Ya (form disabled utk non-writer) | Tidak perlu | Tidak perlu (status via edit form) | Lengkap | - |
| commerce-procurement-extended/pages/KontrakVendor.tsx | Ya | Ya | Ya (ConfirmDialog) | Tidak perlu (status via edit) | Lengkap, tanpa validasi | + validasi tanggal & nilai plafon/terpakai ≥ 0 |
| commerce-procurement-extended/pages/Retur.tsx | Ya (item retur, tambah/hapus baris) | Ya | Tidak perlu (item sync otomatis) | Ya (Ajukan/Setujui/Tolak/Tandai Dikirim/Selesai) | Lengkap | - |
| procurement/pages/Vendor.tsx | Ya | Ya | - | Ya (blacklist/approve) | Lengkap | - |
| procurement/pages/Katalog.tsx | Ya | Ya | Tidak perlu | Tidak perlu (master data) | Lengkap | - |
| procurement/pages/PR.tsx | Ya (item, tambah/hapus baris) | Ya | Ya (sinkron item + ConfirmDialog dokumen) | Ya (Ajukan/Setujui/Tolak) | Lengkap | - |
| procurement/pages/RFQ.tsx | Ya (RFQ + penawaran vendor) | Ya (pilih pemenang) | Tidak perlu | Ya (status dikirim→dst, buat PO) | Lengkap | - |
| procurement/pages/PO.tsx | Ya (item, tambah/hapus baris) | Ya | Ya (sinkron item) | Ya (Ajukan/Setujui/Tolak/Tandai Terkirim) | Lengkap | - |
| procurement/pages/GR.tsx | Ya | Ya | Tidak perlu | Ya (update status PO diterima/sebagian) | Lengkap | - |
| procurement/pages/InvoiceVendor.tsx | Ya | Ya | Ya (ConfirmDialog) | Ya (Ajukan/Verifikasi/Setujui/Tolak) | Lengkap | - |
| procurement/pages/Scorecard.tsx | Ya | Ya | Tidak perlu | Tidak perlu (skor langsung) | Lengkap by design | - |
| hr/pages/DashboardHR.tsx | Tidak relevan (dashboard) | - | - | - | Read-only by design | - |
| commerce/pages/Dashboard.tsx | Tidak relevan (dashboard) | - | - | - | Read-only by design | - |
| procurement/pages/Dashboard.tsx | Tidak relevan (dashboard) | - | - | - | Read-only by design | - |

## Rincian perbaikan kode

- `hr/pages/Roster.tsx`: klik sel jadwal mingguan kini hanya aktif jika `can('HR','write')`; tombol hapus master shift memakai `ConfirmDialog` (bukan hapus langsung); pesan galat RLS menyebut modul HR & hak write.
- `hr/pages/KomponenGaji.tsx`: form tambah & tombol hapus penetapan komponen gaji per karyawan kini digerbangi `can('PAYROLL','write')`; hapus memakai `ConfirmDialog`; validasi tanggal berakhir ≥ tanggal berlaku dan nominal ≥ 0; pesan galat RLS menyebut modul PAYROLL.
- `hr/pages/Cuti.tsx`: validasi tanggal selesai tidak boleh mendahului tanggal mulai.
- `hr-extended/pages/Perjalanan.tsx`: validasi tanggal kembali ≥ tanggal berangkat, dan nominal uang saku/uang muka/biaya ≥ 0.
- `hr-extended/pages/Penilaian.tsx`: tombol aksi alur baru "Sanggah" (status → `disanggah`) untuk melengkapi status yang sudah ada di skema tapi belum tercapai dari UI; tab status "Disanggah" (di `hr-extended/lib/constants.ts`); validasi bobot/skor ≥ 0; pesan galat RLS.
- `commerce/pages/Kontrak.tsx`, `commerce/pages/Spk.tsx`, `commerce-procurement-extended/pages/KontrakVendor.tsx`, `commerce-procurement-extended/pages/Pipeline.tsx`: validasi tanggal berakhir ≥ tanggal mulai dan nilai uang ≥ 0.

## Catatan
- Semua perbaikan memakai komponen `@/components/ui` yang sudah ada (`ConfirmDialog`, `Field`, `Input`, dst.) — tidak ada komponen input baru dibuat.
- `npm run build` (tsc -b && vite build) LULUS tanpa galat setelah seluruh perubahan di atas.
- Sumber skema: `mcp__Supabase__list_tables` / `execute_sql` pada project `idlhsxamdkipnmyvewbp` (kolom `status` & constraint CHECK diverifikasi untuk `disciplinary_actions`, `performance_reviews`, dan tabel master lain sebelum menyimpulkan perlu/tidaknya aksi alur kerja).
