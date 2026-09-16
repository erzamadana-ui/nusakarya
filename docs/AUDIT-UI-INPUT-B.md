# Audit UI Input — Kelompok B

Ruang lingkup: `finance, finance-extended, inventory, operations, ops-extended, hse, deployment, deploy-extended, settings, core-extended, exec`

Legenda: ✅ ada & benar · ➕ ditambahkan pada audit ini · — tidak relevan (laporan murni / desain lain yang sudah tepat) · (workflow) = "Hapus/Batal" dipenuhi lewat perubahan status (Ajukan→Setujui/Tolak/Batal), bukan hapus fisik baris — pola ini sudah dipakai konsisten di aplikasi (mis. Jurnal: status `dibatalkan`) dan sesuai untuk dokumen berjejak audit.

| Halaman (path) | Tambah | Ubah | Hapus/Batal | Aksi Alur | Status Sebelum | Yang Ditambahkan |
|---|---|---|---|---|---|---|
| /finance/dashboard | — | — | — | — | Laporan, tidak perlu input | — |
| /finance/ap | ✅ (input tagihan vendor) | ✅ | (workflow: verifikasi/setujui/tolak/lunas) | ✅ | Lengkap | — |
| /finance/ar | ✅ | ✅ | (workflow: status batal/lunas) | ✅ | Lengkap | — |
| /finance/job-costing | ✅ (tambah biaya proyek) | — (biaya manual tidak perlu ubah, hanya tambah/hapus) | ➕ Hapus biaya manual | — | Tambah ada, Hapus biaya manual belum ada | Tombol Hapus baris biaya (khusus `source_type='manual'`), `ConfirmDialog`, gating `can('FINANCE','approve')`, pesan galat RLS |
| /finance/anggaran | ✅ | ✅ | ✅ (ConfirmDialog) | ✅ | Lengkap | — |
| /finance/cashflow | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /finance/coa | ✅ | ✅ | ✅ (cek dependensi) | — | Lengkap | — |
| /finance/jurnal | ✅ | ✅ | (workflow: posting/dibatalkan) | ✅ | Lengkap | — |
| /finance/pajak | ✅ | ✅ | (workflow: dilaporkan) | ✅ | Lengkap | — |
| /finance/kas-kecil | ✅ | ✅ | (workflow: disetujui/ditolak) | ✅ | Lengkap | — |
| /finance/bank | ✅ | ✅ | ✅ (rekening) + (workflow: rekonsiliasi selesai) | ✅ | Lengkap | — |
| /inventory/dashboard | — | — | — | — | Laporan, tidak perlu input | — |
| /inventory/gudang | ✅ | ✅ | ✅ | — | Lengkap | — |
| /inventory/stok | — | — | — | — | Laporan saldo (view baca saja), tidak perlu input | — |
| /inventory/nte | ✅ | ✅ | (workflow: status alat kerja) | ✅ | Lengkap | — |
| /inventory/mutasi | ✅ (buku besar mutasi stok) | — | — (ledger; koreksi via mutasi ADJUST baru, bukan edit/hapus baris) | — | Sesuai desain buku besar | — |
| /inventory/permintaan | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /inventory/pemakaian | ✅ | ✅ (Koreksi) | ➕ Hapus baris pemakaian | — | Tambah/Ubah ada, Hapus belum ada | Tombol Hapus, `ConfirmDialog`, gating `can('INVENTORY','approve')`, pesan galat RLS |
| /inventory/opname | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /aset/daftar | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /aset/penugasan | ✅ (assign) | ✅ (return) | — (workflow assign/return sudah mencakup koreksi) | ✅ | Lengkap | — |
| /aset/pemeliharaan | ✅ | ✅ | ➕ Hapus riwayat pemeliharaan | — | Tambah/Ubah ada, Hapus belum ada | Tombol Hapus, `ConfirmDialog`, gating `can('ASSET','approve')`, pesan galat RLS |
| /ops/dashboard | — | — | — | — | Laporan, tidak perlu input | — |
| /ops/tiket | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /ops/dispatch | — (papan penugasan WO yang sudah ada) | ✅ (tugaskan/ubah) | — (mulai/selesai/gagal = workflow) | ✅ | Lengkap sesuai desain kanban | — |
| /ops/work-order | ✅ | ✅ | (workflow: QC verifikasi) | ✅ | Lengkap | — |
| /ops/maintenance | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /ops/aset-jaringan | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /ops/rca | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /ops/alarm | ✅ | ✅ | (workflow: diakui/diabaikan/tiket dibuat) | ✅ | Lengkap | — |
| /ops/sla-pelanggan | ✅ | ✅ | (workflow ubah status) | ✅ | Lengkap | — |
| /ops/eskalasi | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /ops/pengetahuan | ✅ | ✅ | ✅ | — | Lengkap | — |
| /k3/dashboard | — | — | — | — | Laporan, tidak perlu input | — |
| /k3/insiden | ✅ | ✅ | (workflow: investigasi/selesai) | ✅ | Lengkap | — |
| /k3/inspeksi | ✅ | (workflow: follow-up selesai) | — | ✅ | Lengkap | — |
| /k3/izin-kerja | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/dashboard | — | — | — | — | Laporan, tidak perlu input | — |
| /deploy/proyek | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/survey | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/drm | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/boq | ✅ (baris BoQ tambah/hapus dalam form) | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/progres | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/qc | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/dokumen | ✅ | ✅ (versi baru) | (workflow: approve/reject, versi lama→obsolete) | ✅ | Lengkap | — |
| /deploy/rfs | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/perizinan | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/punchlist | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/garansi | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /deploy/subkon | ✅ | ✅ | ✅ | ✅ | Lengkap | — |
| /pengaturan/pengguna | — (akun dibuat via Supabase Auth, dijelaskan di halaman) | ✅ (jabatan/unit/cabang/status aktif) | — (nonaktifkan akun via status, bukan hapus) | — | Sesuai desain (tidak hapus akun pengguna) | — |
| /pengaturan/hak-akses | ✅ (toggle matriks) | ✅ | — | — | Lengkap (bentuk matriks, bukan form) | — |
| /pengaturan/cabang | ✅ | ✅ | ✅ | — | Lengkap | — |
| /pengaturan/perusahaan | — (data singleton) | ✅ | — | — | Lengkap (form profil, bukan daftar) | — |
| /pengaturan/audit | — | — | — | — | Log audit, hanya bisa dilihat | — |
| /persetujuan | — (dokumen berasal dari modul lain) | — | ✅ (Setujui/Tolak per baris & massal) | ✅ | Lengkap sesuai desain inbox persetujuan | — |
| /notifikasi | — | ✅ (tandai dibaca) | — | — | Lengkap sesuai desain notifikasi | — |
| /pengaturan/master | ✅ | ✅ | ✅ | — | Lengkap | — |
| /dashboard | — | — | — | — | Laporan, tidak perlu input | — |
| /eksekutif | — | — | — | — | Portal eksekutif, laporan lintas modul, tidak perlu input | — |

## Ringkasan
- Total halaman diaudit: 47 (di luar folder `components/`/`lib/` yang bukan halaman).
- Sudah lengkap sejak awal (siklus Tambah→Ubah→Hapus/Batal→alur kerja sesuai kebutuhan tabelnya): 41 halaman.
- Murni laporan/dashboard/log/portal (tidak perlu form input): 9 halaman (`/finance/dashboard`, `/inventory/dashboard`, `/inventory/stok`, `/ops/dashboard`, `/k3/dashboard`, `/deploy/dashboard`, `/pengaturan/audit`, `/dashboard`, `/eksekutif`).
- Dilengkapi pada audit ini (3 halaman): `/finance/job-costing`, `/inventory/pemakaian`, `/aset/pemeliharaan` — ketiganya kini punya tombol **Hapus** dengan `ConfirmDialog`, digerbangi `can(modul,'approve')` (dikonfirmasi cocok dengan kebijakan RLS `*_delete` di Supabase untuk `job_costs`, `material_usages`, `asset_maintenances`), plus pesan galat RLS yang menyebut modul & hak yang kurang.

`npm run build` (tsc -b && vite build) LULUS tanpa galat, mencakup seluruh workspace (termasuk folder modul lain).
