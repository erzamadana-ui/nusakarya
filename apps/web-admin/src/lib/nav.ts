export type NavItem = { path: string; label: string; module: string; badge?: string }
export type NavGroup = { key: string; label: string; icon: string; unit: string; items: NavItem[] }

/** Struktur menu Panel Admin NUSAKARYA.
 *  `module` dipakai untuk penyaringan hak akses (role_module_access). */
export const NAV: NavGroup[] = [
  { key: 'exec', label: 'Eksekutif', icon: 'LayoutDashboard', unit: 'EXECUTIVE', items: [
    { path: '/dashboard', label: 'Ringkasan Perusahaan', module: 'DASHBOARD' },
    { path: '/eksekutif', label: 'Portal Eksekutif', module: 'EXECUTIVE' },
  ]},
  { key: 'hr', label: 'Human Resource', icon: 'Users', unit: 'HR', items: [
    { path: '/hr/dashboard', label: 'Dashboard HR', module: 'HR' },
    { path: '/hr/karyawan', label: 'Data Karyawan', module: 'HR' },
    { path: '/hr/sertifikasi', label: 'Kontrak & Sertifikasi', module: 'HR' },
    { path: '/hr/absensi', label: 'Absensi Lapangan', module: 'HR' },
    { path: '/hr/roster', label: 'Roster & Shift', module: 'HR' },
    { path: '/hr/cuti', label: 'Cuti & Izin', module: 'HR' },
    { path: '/hr/komponen-gaji', label: 'Komponen Gaji', module: 'PAYROLL' },
    { path: '/hr/payroll', label: 'Payroll & Slip Gaji', module: 'PAYROLL' },
    { path: '/hr/produktivitas', label: 'Produktivitas Teknisi', module: 'PRODUCTIVITY' },
  ]},
  { key: 'commerce', label: 'Commerce', icon: 'Handshake', unit: 'COMMERCE', items: [
    { path: '/commerce/dashboard', label: 'Dashboard Commerce', module: 'COMMERCE' },
    { path: '/commerce/pelanggan', label: 'Pelanggan & Principal', module: 'COMMERCE' },
    { path: '/commerce/kontrak', label: 'Kontrak', module: 'COMMERCE' },
    { path: '/commerce/price-list', label: 'Price List Kontrak', module: 'COMMERCE' },
    { path: '/commerce/spk', label: 'SPK', module: 'COMMERCE' },
    { path: '/commerce/klaim', label: 'Klaim Progres / BA', module: 'COMMERCE' },
    { path: '/commerce/bast', label: 'BAST', module: 'COMMERCE' },
    { path: '/commerce/invoice', label: 'Invoice Pelanggan (AR)', module: 'COMMERCE' },
    { path: '/commerce/penalti', label: 'Penalti SLA', module: 'COMMERCE' },
  ]},
  { key: 'procurement', label: 'Procurement', icon: 'ShoppingCart', unit: 'PROCUREMENT', items: [
    { path: '/procurement/dashboard', label: 'Dashboard Procurement', module: 'PROCUREMENT' },
    { path: '/procurement/vendor', label: 'Vendor', module: 'PROCUREMENT' },
    { path: '/procurement/katalog', label: 'Katalog Item', module: 'PROCUREMENT' },
    { path: '/procurement/pr', label: 'Purchase Request', module: 'PROCUREMENT' },
    { path: '/procurement/rfq', label: 'RFQ & Penawaran', module: 'PROCUREMENT' },
    { path: '/procurement/po', label: 'Purchase Order', module: 'PROCUREMENT' },
    { path: '/procurement/gr', label: 'Good Receive', module: 'PROCUREMENT' },
    { path: '/procurement/invoice-vendor', label: 'Invoice Vendor (3-way)', module: 'PROCUREMENT' },
    { path: '/procurement/scorecard', label: 'Vendor Scorecard', module: 'PROCUREMENT' },
  ]},
  { key: 'finance', label: 'Finance', icon: 'Wallet', unit: 'FINANCE', items: [
    { path: '/finance/dashboard', label: 'Dashboard Finance', module: 'FINANCE' },
    { path: '/finance/ap', label: 'Hutang & Bayar Mitra (AP)', module: 'FINANCE' },
    { path: '/finance/ar', label: 'Piutang (AR)', module: 'FINANCE' },
    { path: '/finance/job-costing', label: 'Job Costing & Margin', module: 'FINANCE' },
    { path: '/finance/anggaran', label: 'Anggaran', module: 'FINANCE' },
    { path: '/finance/cashflow', label: 'Arus Kas', module: 'FINANCE' },
  ]},
  { key: 'inventory', label: 'Inventory', icon: 'Boxes', unit: 'INVENTORY', items: [
    { path: '/inventory/dashboard', label: 'Dashboard Inventory', module: 'INVENTORY' },
    { path: '/inventory/gudang', label: 'Gudang', module: 'INVENTORY' },
    { path: '/inventory/stok', label: 'Saldo Stok', module: 'INVENTORY' },
    { path: '/inventory/nte', label: 'Inventory NTE (Serial)', module: 'INVENTORY' },
    { path: '/inventory/mutasi', label: 'Mutasi Stok', module: 'INVENTORY' },
    { path: '/inventory/permintaan', label: 'Permintaan Material', module: 'INVENTORY' },
    { path: '/inventory/pemakaian', label: 'Pemakaian vs BoQ', module: 'INVENTORY' },
    { path: '/inventory/opname', label: 'Stock Opname', module: 'INVENTORY' },
  ]},
  { key: 'asset', label: 'Inventory Aset', icon: 'Truck', unit: 'INVENTORY', items: [
    { path: '/aset/daftar', label: 'Daftar Aset', module: 'ASSET' },
    { path: '/aset/penugasan', label: 'Penugasan Aset', module: 'ASSET' },
    { path: '/aset/pemeliharaan', label: 'Pemeliharaan Aset', module: 'ASSET' },
  ]},
  { key: 'ops', label: 'Operations', icon: 'Wrench', unit: 'OPERATIONS', items: [
    { path: '/ops/dashboard', label: 'Dashboard Operations', module: 'OPERATIONS' },
    { path: '/ops/tiket', label: 'Tiket Gangguan', module: 'OPERATIONS' },
    { path: '/ops/dispatch', label: 'Papan Dispatch', module: 'OPERATIONS' },
    { path: '/ops/work-order', label: 'Work Order', module: 'OPERATIONS' },
    { path: '/ops/maintenance', label: 'Maintenance & Patroli', module: 'OPERATIONS' },
    { path: '/ops/aset-jaringan', label: 'Aset Jaringan', module: 'OPERATIONS' },
    { path: '/ops/rca', label: 'RCA 4 Aspek', module: 'OPERATIONS' },
  ]},
  { key: 'deploy', label: 'Design & Deployment', icon: 'Map', unit: 'DEPLOYMENT', items: [
    { path: '/deploy/dashboard', label: 'Dashboard Deployment', module: 'DEPLOYMENT' },
    { path: '/deploy/proyek', label: 'Proyek', module: 'DEPLOYMENT' },
    { path: '/deploy/survey', label: 'Survey', module: 'DEPLOYMENT' },
    { path: '/deploy/drm', label: 'DRM', module: 'DEPLOYMENT' },
    { path: '/deploy/boq', label: 'BoQ Plan vs Actual', module: 'DEPLOYMENT' },
    { path: '/deploy/progres', label: 'Progres & Kurva S', module: 'DEPLOYMENT' },
    { path: '/deploy/qc', label: 'Quality Control', module: 'DEPLOYMENT' },
    { path: '/deploy/dokumen', label: 'Dokumen & ABD', module: 'DEPLOYMENT' },
    { path: '/deploy/rfs', label: 'BAST & RFS', module: 'DEPLOYMENT' },
  ]},
  { key: 'setting', label: 'Pengaturan', icon: 'Settings', unit: 'CORE', items: [
    { path: '/pengaturan/pengguna', label: 'Pengguna', module: 'CORE' },
    { path: '/pengaturan/hak-akses', label: 'Hak Akses Jabatan', module: 'CORE' },
    { path: '/pengaturan/cabang', label: 'Cabang', module: 'CORE' },
    { path: '/pengaturan/perusahaan', label: 'Profil Perusahaan', module: 'CORE' },
    { path: '/pengaturan/audit', label: 'Log Audit', module: 'CORE' },
  ]},
]

export const ALL_ITEMS: (NavItem & { group: string })[] =
  NAV.flatMap(g => g.items.map(i => ({ ...i, group: g.label })))
