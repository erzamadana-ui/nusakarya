# NUSAKARYA — Konvensi Pengembangan Panel Admin
Wajib dibaca sebelum menulis kode modul apa pun.

## 1. Lokasi & pola berkas
- Root app: `/home/claude/nusakarya/apps/web-admin`
- Modul Anda: `src/modules/<modul>/` — HANYA tulis di dalam folder ini.
- Setiap modul WAJIB punya `src/modules/<modul>/routes.tsx` yang mengekspor default array:
  ```tsx
  import type { AppRoute } from '@/App'
  const routes: AppRoute[] = [
    { path: '/hr/karyawan', module: 'HR', element: <Karyawan /> },
  ]
  export default routes
  ```
  `path` dan `module` HARUS sama persis dengan yang tercantum di `src/lib/nav.ts`. Jangan ubah `nav.ts`, `App.tsx`, `lib/auth.tsx`, `components/ui/index.tsx`, atau modul lain.
- Halaman diletakkan di `src/modules/<modul>/pages/NamaHalaman.tsx`.
- Import pakai alias `@/…`.

## 2. Data
```ts
import supabase from '@/lib/supabase'
import { list, getOne, insert, update, remove, count, nextDocNo, uploadFile, signedUrl } from '@/lib/db'
```
- RLS sudah menyaring `company_id` di server. **Tetap** isi `company_id: profile.company_id` saat INSERT (kolom NOT NULL).
- Nomor dokumen: `await nextDocNo(profile.company_id, 'PR')` → `PR/2026/0001`. Prefix: PR, RFQ, PO, GR, INV, AP, SPK, BA, BAST, TKT, WO, MR, OPN, PRJ, SRV, DRM, RFS, CLM, AST.
- Upload: `const path = await uploadFile(profile.company_id, 'bast', file)` lalu simpan `path` ke kolom `*_url`. Tampilkan dengan `await signedUrl(path)`. JANGAN pakai public URL.
- Untuk daftar besar gunakan `select` kolom seperlunya + `order` + `limit`.

## 3. Hak akses
```tsx
const { profile, company, can } = useAuth()
can('HR')            // read
can('HR','write')    // tombol Tambah/Simpan
can('HR','approve')  // tombol Setujui/Tolak/Hapus
```
- Tombol aksi WAJIB disembunyikan (bukan sekadar disabled) kalau `can(...,'write')` false.
- Jangan pernah menganggap role tertentu = boleh. Selalu lewat `can()`.

## 4. Komponen bersama (dari `@/components/ui`)
`Button, Input, Textarea, Select, Money, Checkbox, Field, Card, CardHeader, PageHeader, Badge, StatusBadge, KpiCard, Tabs, Modal, Drawer, ConfirmDialog, useToast, EmptyState, Skeleton, TableSkeleton, DataTable, Stepper, Timeline, Progress, FilterBar, Section, Desc, cx`

`DataTable` props: `columns` (`{key, header, render?, align?, width?, sortable?}`), `rows`, `loading`, `onRowClick`, `searchable`, `searchKeys`, `exportName`, `toolbar`, `pageSize`, `dense`, `selectable`, `onSelect`.

`Badge` mewarnai otomatis dari teks status (draft/diajukan/disetujui/ditolak/lunas/overdue/breach/…). Cukup `<Badge>{row.status}</Badge>`.

Format: `import { rupiah, num, pct, tgl, tglJam, durasi, periodCode, todayISO, exportCSV } from '@/lib/format'`.
Grafik: `recharts` sudah terpasang. Warna utama `#1B8A92`, aksen `#F5A524`, pendukung `#3AA3AA #F59E0B #64748B #E11D48 #16A34A`.

## 5. Pola halaman wajib
Setiap halaman daftar: `PageHeader` (judul + tombol aksi) → `FilterBar` (bila perlu) → baris `KpiCard` ringkas (opsional) → `DataTable` → `Modal`/`Drawer` untuk tambah/ubah → `ConfirmDialog` untuk hapus/approve.
Halaman detail dokumen: `PageHeader` + `Stepper` status + `Tabs` (Ringkasan / Item / Lampiran / Riwayat) + `Timeline` aktivitas.

## 6. Bahasa & angka
- Seluruh label, tombol, pesan, header kolom: **Bahasa Indonesia**, register korporat formal.
- Uang selalu lewat `rupiah()`. Tanggal lewat `tgl()`/`tglJam()`. Angka lewat `num()`.
- Kolom angka pakai `align: 'right'`.
- Setiap laporan/dashboard yang memakai angka asumsi WAJIB memberi catatan kecil di bawah kartu: sumber data + tanggal tarik.

## 7. Mutu
- Tangani error: `try { … } catch (e:any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') }`.
- Selalu ada state `loading` (pakai `TableSkeleton`) dan `EmptyState` yang kontekstual.
- Responsif sampai lebar 360px; tabel boleh discroll horizontal.
- Dark mode WAJIB jalan — gunakan hanya kelas warna yang sudah dipakai di `components/ui`.
- Jangan pakai `localStorage` untuk data bisnis.
- Jangan membuat berkas README, tes, atau dokumentasi tambahan.

## 8. Basis data
Project Supabase `idlhsxamdkipnmyvewbp`. Gunakan tool `mcp__Supabase__list_tables` (schema `public`) untuk membaca kolom persis sebelum menulis query — JANGAN menebak nama kolom.
Sudah tersedia view siap pakai: `v_dashboard_hr, v_dashboard_productivity, v_dashboard_procurement, v_dashboard_commerce, v_dashboard_finance, v_project_margin, v_dashboard_inventory, v_stock_opname_variance, v_dashboard_operations, v_dashboard_deployment, v_project_scurve, v_boq_plan_vs_actual, v_executive_summary`.

## 9. Selesai
Jalankan `cd /home/claude/nusakarya/apps/web-admin && npm run build` sampai LULUS sebelum melapor. Kalau build gagal karena modul lain (folder di luar milik Anda), abaikan dan laporkan.
