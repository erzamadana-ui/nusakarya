import React, { useState, useEffect, useMemo } from 'react'
import { NavLink, useNavigate, useLocation, Outlet, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, Handshake, ShoppingCart, Wallet, Boxes, Truck, Wrench, Map, HardHat,
  Settings, Circle, ChevronsLeft, ChevronsRight, Menu, Search, Sun, Moon, Bell, LogOut,
  CornerDownLeft, AlertTriangle, Rocket, Facebook, Instagram, Youtube, Linkedin, X as XIcon,
  Gauge, BadgeCheck, CalendarClock, CalendarDays, PlaneTakeoff, Coins, UserPlus, GraduationCap,
  Gavel, Star, Receipt, FileText, FileSignature, ClipboardList, ClipboardCheck, PackageSearch,
  Warehouse, ScanBarcode, ArrowLeftRight, PackageCheck, ClipboardPen, Car, Hammer, Ticket,
  LayoutList, CalendarCheck, Network, Siren, ShieldAlert, BookOpen, Sunrise, Activity, Radar,
  MapPinned, ListChecks, ShieldCheck, Handshake as HandshakeIcon, Building2, History, Palette,
  Database, Inbox, BellRing, Landmark, BookOpenCheck, Percent, PiggyBank, Banknote, Calculator,
  TrendingUp, MessageSquareWarning, FileWarning, Undo2, FileBox, Ruler, CircleDollarSign,
  UserCog, KeySquare, Store, Target, Layers, Blocks,
} from 'lucide-react'
import { useAuth, ROLE_LABEL } from '@/lib/auth'
import { NAV, ALL_ITEMS } from '@/lib/nav'
import { inisial } from '@/lib/format'
import { getMode, setMode } from '@/lib/theme'
import { cx, Badge } from '@/components/ui'

const ICONS: Record<string, any> = {
  LayoutDashboard, Users, Handshake, ShoppingCart, Wallet, Boxes, Truck, Wrench, Map, HardHat,
  Settings, ChevronsLeft, ChevronsRight, Circle,
}
const Icon = ({ name, ...p }: any) => {
  const C = ICONS[name] ?? Circle
  return <C {...p} />
}

/** Ikon per menu, dipetakan dari path. Referensi memberi tiap menu ikonnya sendiri,
 *  bukan ikon kelompok yang berulang. */
const ITEM_ICON: Record<string, any> = {
  '/dashboard': Gauge, '/eksekutif': TrendingUp, '/persetujuan': Inbox, '/notifikasi': BellRing,
  '/hr/dashboard': Gauge, '/hr/karyawan': Users, '/hr/sertifikasi': BadgeCheck,
  '/hr/absensi': CalendarCheck, '/hr/roster': CalendarDays, '/hr/cuti': CalendarClock,
  '/hr/komponen-gaji': Coins, '/hr/payroll': Banknote, '/hr/produktivitas': Target,
  '/hr/freelance': UserCog, '/hr/payroll-freelance': CircleDollarSign, '/hr/lembur': CalendarClock,
  '/hr/perjalanan': PlaneTakeoff, '/hr/kasbon': PiggyBank, '/hr/rekrutmen': UserPlus,
  '/hr/kompetensi': GraduationCap, '/hr/penilaian': Star, '/hr/disiplin': Gavel,
  '/commerce/dashboard': Gauge, '/commerce/pelanggan': Store, '/commerce/kontrak': FileSignature,
  '/commerce/price-list': Ruler, '/commerce/spk': FileText, '/commerce/klaim': ClipboardPen,
  '/commerce/bast': ClipboardCheck, '/commerce/invoice': Receipt, '/commerce/penalti': FileWarning,
  '/commerce/pipeline': Target, '/commerce/komplain': MessageSquareWarning,
  '/procurement/dashboard': Gauge, '/procurement/vendor': Building2, '/procurement/katalog': LayoutList,
  '/procurement/pr': ClipboardList, '/procurement/rfq': Layers, '/procurement/po': ShoppingCart,
  '/procurement/gr': PackageCheck, '/procurement/invoice-vendor': Receipt,
  '/procurement/scorecard': Star, '/procurement/kontrak-vendor': FileSignature, '/procurement/retur': Undo2,
  '/finance/dashboard': Gauge, '/finance/ap': Banknote, '/finance/ar': Receipt,
  '/finance/job-costing': Calculator, '/finance/anggaran': PiggyBank, '/finance/cashflow': TrendingUp,
  '/finance/coa': BookOpenCheck, '/finance/jurnal': BookOpen, '/finance/pajak': Percent,
  '/finance/kas-kecil': Coins, '/finance/bank': Landmark,
  '/inventory/dashboard': Gauge, '/inventory/gudang': Warehouse, '/inventory/stok': Boxes,
  '/inventory/nte': ScanBarcode, '/inventory/mutasi': ArrowLeftRight,
  '/inventory/permintaan': PackageSearch, '/inventory/pemakaian': ClipboardCheck,
  '/inventory/opname': ListChecks,
  '/aset/daftar': Car, '/aset/penugasan': UserCog, '/aset/pemeliharaan': Hammer,
  '/ops/dashboard': Gauge, '/ops/tiket': Ticket, '/ops/dispatch': LayoutList,
  '/ops/work-order': ClipboardList, '/ops/maintenance': CalendarCheck, '/ops/aset-jaringan': Network,
  '/ops/rca': Radar, '/ops/alarm': Siren, '/ops/sla-pelanggan': ShieldCheck,
  '/ops/eskalasi': ShieldAlert, '/ops/pengetahuan': BookOpen, '/ops/morning': Sunrise, '/ops/bmon': Activity,
  '/k3/dashboard': Gauge, '/k3/insiden': ShieldAlert, '/k3/inspeksi': ClipboardCheck, '/k3/izin-kerja': KeySquare,
  '/deploy/dashboard': Gauge, '/deploy/proyek': Blocks, '/deploy/survey': MapPinned,
  '/deploy/drm': HandshakeIcon, '/deploy/boq': Calculator, '/deploy/progres': TrendingUp,
  '/deploy/qc': BadgeCheck, '/deploy/dokumen': FileBox, '/deploy/rfs': ClipboardCheck,
  '/deploy/perizinan': FileSignature, '/deploy/punchlist': ListChecks, '/deploy/garansi': ShieldCheck,
  '/deploy/subkon': HandshakeIcon,
  '/pengaturan/pengguna': Users, '/pengaturan/hak-akses': KeySquare, '/pengaturan/cabang': MapPinned,
  '/pengaturan/perusahaan': Building2, '/pengaturan/tampilan': Palette,
  '/pengaturan/master': Database, '/pengaturan/audit': History,
}

function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-5 text-caption text-ink-400">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="font-medium text-ink-500">© {year} NUSAKARYA</span>
        <Link to="/pengaturan/perusahaan" className="hover:text-primary-500">Profil Perusahaan</Link>
        <Link to="/pengaturan/audit" className="hover:text-primary-500">Log Audit</Link>
        <Link to="/pengaturan/hak-akses" className="hover:text-primary-500">Hak Akses</Link>
      </div>
      <div className="flex items-center gap-3 text-ink-300">
        {[Facebook, XIcon, Instagram, Youtube, Linkedin].map((I, i) => (
          <I key={i} size={15} className="hover:text-primary-500 cursor-default" />
        ))}
      </div>
    </footer>
  )
}

export default function AppShell() {
  const { profile, company, signOut, can } = useAuth()
  const nav = useNavigate(); const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [cmd, setCmd] = useState(false)
  const [q, setQ] = useState('')
  const [dark, setDark] = useState(() => getMode() === 'dark')

  useEffect(() => { setMode(dark ? 'dark' : 'light') }, [dark])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(v => !v) }
      if (e.key === 'Escape') setCmd(false)
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => { setOpen(false); setCmd(false) }, [loc.pathname])

  const groups = useMemo(
    () => NAV.map(g => ({ ...g, items: g.items.filter(i => can(i.module, 'read')) })).filter(g => g.items.length > 0),
    [profile, can])

  const results = useMemo(() => {
    const allowed = ALL_ITEMS.filter(i => can(i.module, 'read'))
    if (!q) return allowed.slice(0, 8)
    const s = q.toLowerCase()
    return allowed.filter(i => i.label.toLowerCase().includes(s) || i.group.toLowerCase().includes(s)).slice(0, 12)
  }, [q, profile, can])

  const Sidebar = (
    <aside className={cx('bg-sidebar text-sidebar-fg flex flex-col h-full border-r border-sidebar-border transition-all duration-200',
      collapsed ? 'w-[76px]' : 'w-[254px]')}>
      <div className={cx('flex items-center gap-2.5 h-16 shrink-0 px-4', collapsed && 'justify-center px-0')}>
        <div className="w-9 h-9 rounded-md bg-primary-500 text-white grid place-items-center font-display font-extrabold text-[15px] shrink-0">N</div>
        {!collapsed && <div className="min-w-0">
          <div className="font-display font-extrabold text-[16px] leading-tight tracking-tight text-sidebar-fg">NUSAKARYA</div>
          <div className="text-[10px] text-sidebar-muted truncate">{company?.name ?? 'Operational Control'}</div>
        </div>}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-5">
        {groups.map(g => (
          <div key={g.key}>
            {!collapsed && <div className="px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-[.09em] text-sidebar-muted">{g.label}</div>}
            <div className="space-y-0.5">
              {g.items.map(i => (
                <NavLink key={i.path} to={i.path} title={i.label}
                  className={({ isActive }) => cx(
                    'flex items-center gap-2.5 h-10 px-2.5 rounded-sm text-[13px] font-semibold transition-colors',
                    isActive
                      ? 'bg-sidebar-active text-sidebar-onactive shadow-e1'
                      : 'text-sidebar-fg/85 hover:bg-sidebar-hover hover:text-sidebar-fg',
                    collapsed && 'justify-center px-0')}>
                  {(() => { const C = ITEM_ICON[i.path] ?? ICONS[g.icon] ?? Circle; return <C size={17} className="shrink-0" /> })()}
                  {!collapsed && <span className="truncate">{i.label}</span>}
                </NavLink>))}
            </div>
          </div>))}
      </nav>

      {!collapsed && (
        <div className="mx-3 mb-3 rounded-md bg-primary-50 p-4 text-center">
          <div className="mx-auto mb-2 w-10 h-10 rounded-md bg-primary-500 text-white grid place-items-center"><Rocket size={18} /></div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-primary-700">Template Operations</div>
          <p className="mt-1 text-caption text-ink-500 leading-snug">Ganti tampilan kapan saja di Pengaturan.</p>
          <button onClick={() => nav('/pengaturan/tampilan')}
            className="mt-3 w-full h-9 rounded-sm bg-primary-500 text-white text-caption font-semibold hover:bg-primary-600">
            Atur Tampilan
          </button>
        </div>)}

      <div className="border-t border-sidebar-border">
        <button onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex w-full items-center gap-2 h-11 px-4 text-[12px] font-semibold text-sidebar-muted hover:text-sidebar-fg">
          <Icon name={collapsed ? 'ChevronsRight' : 'ChevronsLeft'} size={15} />{!collapsed && 'Ciutkan menu'}
        </button>
        <button onClick={signOut}
          className={cx('flex w-full items-center gap-2.5 h-12 px-4 text-[13px] font-semibold text-sidebar-fg/85 hover:bg-sidebar-hover', collapsed && 'justify-center px-0')}>
          <LogOut size={17} />{!collapsed && 'Keluar'}
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      <div className="hidden lg:block shrink-0">{Sidebar}</div>
      {open && <div className="lg:hidden fixed inset-0 z-40 flex">
        <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
        <div className="relative z-10">{Sidebar}</div>
      </div>}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-surface border-b border-ink-200 flex items-center gap-3 px-4">
          <button className="lg:hidden p-2 -ml-1 text-ink-500" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <button onClick={() => setCmd(true)}
            className="flex items-center gap-2 h-10 px-3.5 rounded-lg bg-ink-50 border border-ink-200 text-ink-400 text-body hover:border-primary-300 min-w-[150px] sm:min-w-[300px]">
            <Search size={16} /><span className="flex-1 text-left">Cari menu…</span>
            <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-surface border border-ink-200 text-ink-500">⌘K</kbd>
          </button>
          <div className="flex-1" />
          {[
            { k: 'tema', icon: dark ? <Sun size={17} /> : <Moon size={17} />, onClick: () => setDark(d => !d), title: 'Ganti mode terang/gelap' },
            { k: 'notif', icon: <Bell size={17} />, onClick: () => nav('/notifikasi'), title: 'Notifikasi' },
            { k: 'set', icon: <Settings size={17} />, onClick: () => nav('/pengaturan/tampilan'), title: 'Pengaturan' },
          ].map(b => (
            <button key={b.k} title={b.title} onClick={b.onClick}
              className="w-10 h-10 grid place-items-center rounded-full bg-ink-50 border border-ink-200 text-ink-500 hover:text-primary-600 hover:border-primary-300">
              {b.icon}
            </button>))}
          <div className="flex items-center gap-2.5 pl-2">
            <div className="w-10 h-10 rounded-full bg-primary-500 text-white grid place-items-center text-caption font-bold shrink-0">{inisial(profile?.full_name)}</div>
            <div className="hidden sm:block leading-tight">
              <div className="text-body font-bold text-ink-900 max-w-[160px] truncate">{profile?.full_name}</div>
              <div className="text-[11px] text-ink-400">{ROLE_LABEL[profile?.role ?? ''] ?? profile?.role}</div>
            </div>
          </div>
        </header>

        {company?.is_demo && (
          <div className="shrink-0 bg-accent-50 border-b border-accent-300/50 px-4 py-1.5 text-caption font-medium text-accent-700 flex items-center gap-2">
            <AlertTriangle size={13} /> Data contoh untuk peragaan — bersihkan sebelum dipakai produksi.
          </div>)}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
          <Footer />
        </main>
      </div>

      {cmd && (
        <div className="fixed inset-0 z-[60] bg-ink-900/40 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4" onClick={() => setCmd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-surface rounded-lg shadow-e3 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 h-14 border-b border-ink-200">
              <Search size={17} className="text-ink-400" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Lompat ke menu…"
                className="flex-1 bg-transparent outline-none text-body-l text-ink-900" />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 text-ink-500">ESC</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto py-1.5">
              {results.length === 0 && <div className="px-4 py-8 text-center text-caption text-ink-400">Tidak ada menu cocok.</div>}
              {results.map(r => (
                <button key={r.path} onClick={() => { nav(r.path); setQ('') }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-ink-50 text-left">
                  <CornerDownLeft size={14} className="text-ink-300" />
                  <span className="flex-1 text-body text-ink-800">{r.label}</span>
                  <Badge tone="teal">{r.group}</Badge>
                </button>))}
            </div>
          </div>
        </div>)}
    </div>
  )
}
