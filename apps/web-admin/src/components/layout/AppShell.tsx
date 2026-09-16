import React, { useState, useEffect, useMemo } from 'react'
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { useAuth, ROLE_LABEL } from '@/lib/auth'
import { NAV, ALL_ITEMS } from '@/lib/nav'
import { inisial } from '@/lib/format'
import { cx, Badge } from '@/components/ui'

const Icon = ({ name, ...p }: any) => {
  const C = (Icons as any)[name] ?? Icons.Circle
  return <C {...p} />
}

export default function AppShell() {
  const { profile, company, signOut, can } = useAuth()
  const nav = useNavigate(); const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [cmd, setCmd] = useState(false)
  const [q, setQ] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem('nk-theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('nk-theme', dark ? 'dark' : 'light') } catch {}
  }, [dark])

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
    <aside className={cx('bg-sidebar text-white flex flex-col h-full transition-all duration-200', collapsed ? 'w-[72px]' : 'w-[264px]')}>
      <div className="flex items-center gap-2.5 h-16 px-4 shrink-0 border-b border-white/10">
        <div className="w-9 h-9 rounded-md bg-primary-500 grid place-items-center font-display font-extrabold text-[15px] shrink-0">N</div>
        {!collapsed && <div className="min-w-0">
          <div className="font-display font-bold text-[15px] leading-tight tracking-tight">NUSAKARYA</div>
          <div className="text-[10px] text-white/55 truncate">{company?.name ?? 'Operational Control'}</div>
        </div>}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
        {groups.map(g => (
          <div key={g.key}>
            {!collapsed && <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[.08em] text-white/40">{g.label}</div>}
            <div className="space-y-0.5">
              {g.items.map(i => (
                <NavLink key={i.path} to={i.path} title={i.label}
                  className={({ isActive }) => cx('flex items-center gap-2.5 h-9 px-2.5 rounded-sm text-[13px] font-medium transition-colors',
                    isActive ? 'bg-sidebar-active text-white' : 'text-white/70 hover:bg-sidebar-hover hover:text-white',
                    collapsed && 'justify-center')}>
                  <Icon name={g.icon} size={16} className="shrink-0 opacity-90" />
                  {!collapsed && <span className="truncate">{i.label}</span>}
                </NavLink>))}
            </div>
          </div>))}
      </nav>
      <button onClick={() => setCollapsed(c => !c)} className="hidden lg:flex items-center gap-2 h-11 px-4 text-[12px] text-white/50 hover:text-white border-t border-white/10">
        <Icon name={collapsed ? 'ChevronsRight' : 'ChevronsLeft'} size={15} />{!collapsed && 'Ciutkan menu'}
      </button>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50 dark:bg-surface-darker">
      <div className="hidden lg:block shrink-0">{Sidebar}</div>
      {open && <div className="lg:hidden fixed inset-0 z-40 flex">
        <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
        <div className="relative z-10">{Sidebar}</div>
      </div>}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-white dark:bg-surface-dark border-b border-ink-200 dark:border-ink-800 flex items-center gap-3 px-4">
          <button className="lg:hidden p-2 -ml-2 text-ink-500" onClick={() => setOpen(true)}><Icons.Menu size={20} /></button>
          <button onClick={() => setCmd(true)}
            className="flex items-center gap-2 h-9 px-3 rounded-sm border border-ink-200 dark:border-ink-700 text-ink-400 text-body hover:border-primary-300 min-w-[150px] sm:min-w-[260px]">
            <Icons.Search size={15} /><span className="flex-1 text-left">Cari menu…</span>
            <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-500">⌘K</kbd>
          </button>
          <div className="flex-1" />
          <button onClick={() => setDark(d => !d)} className="p-2 rounded-sm text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800" title="Ganti tema">
            {dark ? <Icons.Sun size={18} /> : <Icons.Moon size={18} />}
          </button>
          <button onClick={() => nav('/notifikasi')} className="p-2 rounded-sm text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"><Icons.Bell size={18} /></button>
          <div className="flex items-center gap-2.5 pl-3 border-l border-ink-200 dark:border-ink-800">
            <div className="w-9 h-9 rounded-full bg-primary-500 text-white grid place-items-center text-caption font-semibold shrink-0">{inisial(profile?.full_name)}</div>
            <div className="hidden sm:block leading-tight">
              <div className="text-body font-medium text-ink-900 dark:text-ink-100 max-w-[150px] truncate">{profile?.full_name}</div>
              <div className="text-[11px] text-ink-400">{ROLE_LABEL[profile?.role ?? ''] ?? profile?.role}</div>
            </div>
            <button onClick={signOut} title="Keluar" className="p-2 rounded-sm text-ink-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"><Icons.LogOut size={17} /></button>
          </div>
        </header>

        {company?.is_demo && (
          <div className="shrink-0 bg-accent-50 dark:bg-accent-700/20 border-b border-accent-300/50 px-4 py-1.5 text-caption text-accent-700 dark:text-accent-300 flex items-center gap-2">
            <Icons.AlertTriangle size={13} /> Data contoh untuk peragaan — bersihkan sebelum dipakai produksi.
          </div>)}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6"><Outlet /></main>
      </div>

      {cmd && (
        <div className="fixed inset-0 z-[60] bg-ink-900/40 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4" onClick={() => setCmd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-lg shadow-e3 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 h-14 border-b border-ink-200 dark:border-ink-800">
              <Icons.Search size={17} className="text-ink-400" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Lompat ke menu…"
                className="flex-1 bg-transparent outline-none text-body-l text-ink-900 dark:text-ink-100" />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-500">ESC</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto py-1.5">
              {results.length === 0 && <div className="px-4 py-8 text-center text-caption text-ink-400">Tidak ada menu cocok.</div>}
              {results.map(r => (
                <button key={r.path} onClick={() => { nav(r.path); setQ('') }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800 text-left">
                  <Icons.CornerDownLeft size={14} className="text-ink-300" />
                  <span className="flex-1 text-body text-ink-800 dark:text-ink-100">{r.label}</span>
                  <Badge tone="teal">{r.group}</Badge>
                </button>))}
            </div>
          </div>
        </div>)}
    </div>
  )
}
