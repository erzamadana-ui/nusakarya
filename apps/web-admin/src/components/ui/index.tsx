import React, { useState, useMemo, useEffect, createContext, useContext, useCallback } from 'react'
import { X, ChevronDown, Search, Download, Plus, AlertCircle, CheckCircle2, Info, Loader2, Inbox, ChevronRight } from 'lucide-react'
import { exportCSV } from '@/lib/format'

export const cx = (...c: any[]) => c.filter(Boolean).join(' ')

/* ---------------- Button ---------------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
  size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: React.ReactNode
}
export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 shadow-e1',
    secondary: 'bg-ink-100 text-ink-800 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
    outline: 'border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800 bg-white dark:bg-transparent',
    ghost: 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }[variant]
  const s = { sm: 'h-8 px-3 text-caption gap-1.5', md: 'h-10 px-4 text-body gap-2', lg: 'h-12 px-5 text-body-l gap-2' }[size]
  return (
    <button {...p} disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center rounded-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1 dark:focus:ring-offset-surface-dark', v, s, className)}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}{children}
    </button>
  )
}

/* ---------------- Fields ---------------- */
const fieldBase = 'w-full h-10 px-3 rounded-sm border border-ink-200 dark:border-ink-700 bg-white dark:bg-surface-dark text-body text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 disabled:bg-ink-50 dark:disabled:bg-ink-800 disabled:text-ink-400'
export function Field({ label, required, hint, error, children, className }: any) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="block mb-1.5 text-caption font-medium text-ink-600 dark:text-ink-300">{label}{required && <span className="text-red-500"> *</span>}</span>}
      {children}
      {hint && !error && <span className="block mt-1 text-caption text-ink-400">{hint}</span>}
      {error && <span className="block mt-1 text-caption text-red-600">{error}</span>}
    </label>
  )
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(fieldBase, p.className)} />
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(fieldBase, 'h-auto py-2 min-h-[80px]', p.className)} />
export function Select({ options = [], placeholder = '— pilih —', ...p }: any) {
  return (
    <div className="relative">
      <select {...p} className={cx(fieldBase, 'appearance-none pr-9', p.className)}>
        <option value="">{placeholder}</option>
        {options.map((o: any) => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={16} className="absolute right-3 top-3 pointer-events-none text-ink-400" />
    </div>
  )
}
export function Money({ value, onChange, ...p }: any) {
  return <Input {...p} inputMode="numeric" value={value == null || value === '' ? '' : Number(value).toLocaleString('id-ID')}
    onChange={(e) => onChange?.(Number(String(e.target.value).replace(/[^\d]/g, '')) || 0)} className="tabular text-right" />
}
export function Checkbox({ label, ...p }: any) {
  return <label className="inline-flex items-center gap-2 cursor-pointer select-none">
    <input type="checkbox" {...p} className="w-4 h-4 rounded-xs border-ink-300 text-primary-500 focus:ring-primary-400" />
    <span className="text-body text-ink-700 dark:text-ink-200">{label}</span></label>
}

/* ---------------- Card / Page ---------------- */
export const Card = ({ className, children, ...p }: any) => (
  <div {...p} className={cx('bg-white dark:bg-surface-dark border border-ink-200 dark:border-ink-800 rounded-md shadow-e1', className)}>{children}</div>
)
export const CardHeader = ({ title, subtitle, action, className }: any) => (
  <div className={cx('flex items-start justify-between gap-3 px-5 py-4 border-b border-ink-200 dark:border-ink-800', className)}>
    <div><h3 className="font-display font-semibold text-[15px] text-ink-900 dark:text-ink-100">{title}</h3>
      {subtitle && <p className="text-caption text-ink-500 mt-0.5">{subtitle}</p>}</div>
    {action}
  </div>
)
export const PageHeader = ({ title, subtitle, breadcrumb, actions }: any) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
    <div>
      {breadcrumb?.length > 0 && (
        <nav className="flex items-center gap-1 text-caption text-ink-400 mb-1">
          {breadcrumb.map((b: string, i: number) => <span key={i} className="flex items-center gap-1">{i > 0 && <ChevronRight size={12} />}{b}</span>)}
        </nav>)}
      <h1 className="font-display text-[24px] leading-8 font-bold text-ink-900 dark:text-ink-50">{title}</h1>
      {subtitle && <p className="text-body text-ink-500 mt-1">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-2">{actions}</div>
  </div>
)

/* ---------------- Badge / Status ---------------- */
const STATUS_MAP: Record<string, string> = {
  draft: 'slate', baru: 'slate', belum: 'slate', nonaktif: 'slate', obsolete: 'slate', libur: 'slate',
  diajukan: 'blue', review: 'blue', on_progress: 'blue', berjalan: 'blue', assigned: 'blue', dispatched: 'blue', terkirim: 'blue', proses: 'blue', dihitung: 'blue', survey: 'blue', design: 'blue', pelaksanaan: 'blue', accepted: 'blue', dikirim: 'blue',
  menunggu: 'amber', pending: 'amber', diverifikasi: 'amber', warning: 'amber', approval: 'amber', pending_material: 'amber', hold: 'amber', sebagian_po: 'amber', diterima_sebagian: 'amber', dibayar_sebagian: 'amber', rusak_ringan: 'amber', perbaikan: 'amber', terjadwal: 'amber',
  disetujui: 'emerald', approved: 'emerald', lulus: 'emerald', selesai: 'emerald', done: 'emerald', lunas: 'emerald', aktif: 'emerald', met: 'emerald', on_track: 'emerald', hadir: 'emerald', baik: 'emerald', resolved: 'emerald', closed: 'emerald', cocok: 'emerald', ditandatangani: 'emerald', diterima: 'emerald', tersedia: 'emerald', layak: 'emerald', dibayar: 'emerald', dikeluarkan: 'emerald',
  ditolak: 'red', rejected: 'red', tidak_lulus: 'red', failed: 'red', breach: 'red', alpa: 'red', blacklist: 'red', rusak_berat: 'red', hilang: 'red', putus: 'red', tidak_layak: 'red', selisih: 'red',
  overdue: 'orange', terlambat: 'orange', terlewat: 'orange', penuh: 'orange',
  batal: 'zinc', cancelled: 'zinc', dihapus: 'zinc', resign: 'zinc',
}
const TONE: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  orange: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  zinc: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  teal: 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200',
}
export function Badge({ children, tone, className }: any) {
  const key = String(children ?? '').toLowerCase().replace(/\s+/g, '_')
  const t = tone ?? STATUS_MAP[key] ?? 'slate'
  return <span className={cx('inline-flex items-center h-[22px] px-2 rounded-full text-caption font-medium whitespace-nowrap capitalize', TONE[t] ?? TONE.slate, className)}>{String(children ?? '-').replace(/_/g, ' ')}</span>
}
export const StatusBadge = Badge

/* ---------------- KPI ---------------- */
export function KpiCard({ label, value, sub, trend, tone = 'teal', icon, onClick }: any) {
  return (
    <Card onClick={onClick} className={cx('p-4', onClick && 'cursor-pointer hover:shadow-e2 transition-shadow')}>
      <div className="flex items-start justify-between">
        <span className="text-caption font-medium text-ink-500 uppercase tracking-wide">{label}</span>
        {icon && <span className={cx('w-8 h-8 rounded-sm grid place-items-center', TONE[tone] ?? TONE.teal)}>{icon}</span>}
      </div>
      <div className="mt-2 font-display text-[28px] leading-9 font-bold text-ink-900 dark:text-ink-50 tabular">{value}</div>
      {(sub || trend != null) && (
        <div className="mt-1 flex items-center gap-2 text-caption">
          {trend != null && <span className={cx('font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-600')}>{trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%</span>}
          {sub && <span className="text-ink-400">{sub}</span>}
        </div>)}
    </Card>
  )
}

/* ---------------- Tabs ---------------- */
export function Tabs({ tabs, value, onChange, className }: any) {
  return (
    <div className={cx('flex items-center gap-1 border-b border-ink-200 dark:border-ink-800 overflow-x-auto', className)}>
      {tabs.map((t: any) => {
        const k = typeof t === 'string' ? t : t.value
        const l = typeof t === 'string' ? t : t.label
        const active = value === k
        return <button key={k} onClick={() => onChange(k)}
          className={cx('px-3.5 h-10 text-body font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
            active ? 'border-primary-500 text-primary-600 dark:text-primary-300' : 'border-transparent text-ink-500 hover:text-ink-800 dark:hover:text-ink-200')}>
          {l}{t?.count != null && <span className="ml-1.5 text-caption text-ink-400">({t.count})</span>}
        </button>
      })}
    </div>
  )
}

/* ---------------- Modal / Drawer ---------------- */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: any) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    if (open) { document.addEventListener('keydown', h); document.body.style.overflow = 'hidden' }
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto bg-ink-900/50 backdrop-blur-[2px]" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={cx('w-full bg-white dark:bg-surface-dark rounded-lg shadow-e3 my-auto', w)}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-ink-200 dark:border-ink-800">
          <div><h3 className="font-display font-semibold text-[17px] text-ink-900 dark:text-ink-50">{title}</h3>
            {subtitle && <p className="text-caption text-ink-500 mt-0.5">{subtitle}</p>}</div>
          <button onClick={onClose} className="p-1.5 rounded-sm text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-surface-darker rounded-b-lg">{footer}</div>}
      </div>
    </div>
  )
}
export function Drawer({ open, onClose, title, children, footer, width = 'max-w-xl' }: any) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/40" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={cx('w-full bg-white dark:bg-surface-dark h-full shadow-e3 flex flex-col', width)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200 dark:border-ink-800">
          <h3 className="font-display font-semibold text-[17px]">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-sm text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-ink-200 dark:border-ink-800">{footer}</div>}
      </div>
    </div>
  )
}
export function ConfirmDialog({ open, onClose, onConfirm, title = 'Konfirmasi', message, confirmLabel = 'Ya, lanjutkan', danger }: any) {
  const [busy, setBusy] = useState(false)
  return <Modal open={open} onClose={onClose} title={title} size="sm"
    footer={<><Button variant="outline" onClick={onClose}>Batal</Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false); onClose() } }}>{confirmLabel}</Button></>}>
    <p className="text-body text-ink-600 dark:text-ink-300">{message}</p></Modal>
}

/* ---------------- Toast ---------------- */
const ToastCtx = createContext<{ push: (m: string, t?: 'success' | 'error' | 'info') => void }>({ push: () => {} })
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: any) {
  const [items, setItems] = useState<any[]>([])
  const push = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setItems(x => [...x, { id, message, type }])
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 4200)
  }, [])
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info }
  return <ToastCtx.Provider value={{ push }}>{children}
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]">
      {items.map(i => { const I = Icon[i.type]
        return <div key={i.id} className={cx('flex items-start gap-2.5 p-3 rounded-md shadow-e3 border text-body bg-white dark:bg-surface-dark',
          i.type === 'error' ? 'border-red-200 dark:border-red-900' : i.type === 'info' ? 'border-blue-200 dark:border-blue-900' : 'border-emerald-200 dark:border-emerald-900')}>
          <I size={18} className={i.type === 'error' ? 'text-red-600' : i.type === 'info' ? 'text-blue-600' : 'text-emerald-600'} />
          <span className="flex-1 text-ink-800 dark:text-ink-100">{i.message}</span></div> })}
    </div></ToastCtx.Provider>
}

/* ---------------- Empty / Skeleton ---------------- */
export const EmptyState = ({ title = 'Belum ada data', message, action, icon }: any) => (
  <div className="py-14 text-center">
    <div className="mx-auto w-12 h-12 rounded-full bg-ink-100 dark:bg-ink-800 grid place-items-center text-ink-400">{icon ?? <Inbox size={22} />}</div>
    <p className="mt-3 font-medium text-ink-700 dark:text-ink-200">{title}</p>
    {message && <p className="mt-1 text-caption text-ink-400 max-w-sm mx-auto">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)
export const Skeleton = ({ className = 'h-4 w-full' }: any) => <div className={cx('skeleton', className)} />
export const TableSkeleton = ({ rows = 6 }: any) => (
  <div className="p-4 space-y-2.5">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
)

/* ---------------- DataTable ---------------- */
export type Column = {
  key: string; header: string
  render?: (row: any, i: number) => React.ReactNode
  className?: string; width?: string; align?: 'left' | 'right' | 'center'; sortable?: boolean; hidden?: boolean
}
export function DataTable({
  columns, rows, loading, onRowClick, emptyTitle, emptyMessage, emptyAction,
  searchable = true, searchKeys, exportName, toolbar, pageSize = 25, dense, selectable, onSelect, rowKey = 'id',
}: {
  columns: Column[]; rows: any[]; loading?: boolean; onRowClick?: (r: any) => void
  emptyTitle?: string; emptyMessage?: string; emptyAction?: React.ReactNode
  searchable?: boolean; searchKeys?: string[]; exportName?: string; toolbar?: React.ReactNode
  pageSize?: number; dense?: boolean; selectable?: boolean; onSelect?: (ids: string[]) => void; rowKey?: string
}) {
  const [q, setQ] = useState(''); const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ k: string; asc: boolean } | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const cols = columns.filter(c => !c.hidden)

  const filtered = useMemo(() => {
    let r = rows ?? []
    if (q) {
      const keys = searchKeys ?? cols.map(c => c.key)
      const s = q.toLowerCase()
      r = r.filter(row => keys.some(k => String(row?.[k] ?? '').toLowerCase().includes(s)))
    }
    if (sort) r = [...r].sort((a, b) => {
      const x = a?.[sort.k], y = b?.[sort.k]
      if (x == null) return 1; if (y == null) return -1
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'id')
      return sort.asc ? c : -c
    })
    return r
  }, [rows, q, sort, cols, searchKeys])

  useEffect(() => { setPage(1) }, [q, rows])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const view = filtered.slice((page - 1) * pageSize, page * pageSize)
  const toggle = (id: string) => { const n = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]; setSel(n); onSelect?.(n) }

  return (
    <Card className="overflow-hidden">
      {(searchable || toolbar || exportName) && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-ink-200 dark:border-ink-800">
          {searchable && (
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={15} className="absolute left-3 top-2.5 text-ink-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari…"
                className="w-full h-9 pl-9 pr-3 rounded-sm border border-ink-200 dark:border-ink-700 bg-white dark:bg-surface-darker text-body focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>)}
          <div className="flex-1" />
          {sel.length > 0 && <span className="text-caption text-ink-500">{sel.length} dipilih</span>}
          {toolbar}
          {exportName && <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={() => exportCSV(filtered, exportName)}>Ekspor</Button>}
        </div>)}
      {loading ? <TableSkeleton /> : filtered.length === 0 ? <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} /> : (
        <div className="overflow-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-body border-separate border-spacing-0">
            <thead className="bg-ink-50 dark:bg-surface-darker sticky top-0 z-20">
              <tr>
                {selectable && <th className="w-10 px-3"><input type="checkbox" checked={sel.length === view.length && view.length > 0}
                  onChange={e => { const n = e.target.checked ? view.map(r => r[rowKey]) : []; setSel(n); onSelect?.(n) }} className="w-4 h-4 rounded-xs" /></th>}
                {cols.map(c => (
                  <th key={c.key} style={{ width: c.width }}
                    className={cx('px-3 h-11 font-semibold text-caption uppercase tracking-wide text-ink-500 whitespace-nowrap bg-ink-50 dark:bg-surface-darker border-b border-ink-200 dark:border-ink-800',
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.sortable !== false && 'cursor-pointer select-none hover:text-ink-800 dark:hover:text-ink-200')}
                    onClick={() => c.sortable !== false && setSort(s => s?.k === c.key ? { k: c.key, asc: !s.asc } : { k: c.key, asc: true })}>
                    {c.header}{sort?.k === c.key && <span className="ml-1">{sort.asc ? '↑' : '↓'}</span>}
                  </th>))}
              </tr>
            </thead>
            <tbody>
              {view.map((row, i) => (
                <tr key={row?.[rowKey] ?? i} onClick={() => onRowClick?.(row)}
                  className={cx('transition-colors border-b border-ink-100 dark:border-ink-800', onRowClick && 'cursor-pointer hover:bg-primary-50/50 dark:hover:bg-ink-800/60')}>
                  {selectable && <td className="px-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={sel.includes(row[rowKey])} onChange={() => toggle(row[rowKey])} className="w-4 h-4 rounded-xs" /></td>}
                  {cols.map(c => (
                    <td key={c.key} className={cx(dense ? 'px-3 py-2' : 'px-3 py-2.5', 'text-ink-700 dark:text-ink-200 align-middle',
                      c.align === 'right' ? 'text-right tabular' : c.align === 'center' ? 'text-center' : '', c.className)}>
                      {c.render ? c.render(row, i) : (row?.[c.key] ?? '-')}
                    </td>))}
                </tr>))}
            </tbody>
          </table>
        </div>)}
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-ink-200 dark:border-ink-800 text-caption text-ink-500">
          <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} dari {filtered.length}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button>
            <span className="px-2">{page}/{pages}</span>
            <Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Berikutnya</Button>
          </div>
        </div>)}
    </Card>
  )
}

/* ---------------- Misc ---------------- */
export const Stepper = ({ steps, current }: any) => (
  <div className="flex items-center gap-1 overflow-x-auto pb-1">
    {steps.map((s: any, i: number) => {
      const done = i < current, active = i === current
      return <React.Fragment key={i}>
        <div className={cx('flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap text-caption font-medium',
          done ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
          active ? 'bg-primary-500 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>
          <span className={cx('w-5 h-5 rounded-full grid place-items-center text-[10px]', done ? 'bg-emerald-600 text-white' : active ? 'bg-white/25' : 'bg-ink-300 dark:bg-ink-700 text-white')}>{done ? '✓' : i + 1}</span>
          {typeof s === 'string' ? s : s.label}
        </div>
        {i < steps.length - 1 && <div className="w-4 h-px bg-ink-200 dark:bg-ink-700 shrink-0" />}
      </React.Fragment>
    })}
  </div>
)
export const Timeline = ({ items }: any) => (
  <ol className="relative border-l border-ink-200 dark:border-ink-700 ml-2 space-y-4">
    {items.map((it: any, i: number) => (
      <li key={i} className="ml-4">
        <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-primary-500 mt-1.5" />
        <p className="text-body text-ink-800 dark:text-ink-100">{it.title}</p>
        {it.note && <p className="text-caption text-ink-500 mt-0.5">{it.note}</p>}
        <p className="text-caption text-ink-400 mt-0.5">{it.time}{it.by ? ` · ${it.by}` : ''}</p>
      </li>))}
  </ol>
)
export const Progress = ({ value = 0, tone = 'primary', height = 8 }: any) => (
  <div className="w-full rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden" style={{ height }}>
    <div className={cx('h-full rounded-full transition-all',
      tone === 'danger' ? 'bg-red-500' : tone === 'warning' ? 'bg-amber-500' : tone === 'success' ? 'bg-emerald-500' : 'bg-primary-500')}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
)
export const FilterBar = ({ children }: any) => (
  <div className="flex flex-wrap items-end gap-3 mb-4 p-4 bg-white dark:bg-surface-dark border border-ink-200 dark:border-ink-800 rounded-md">{children}</div>
)
export const Section = ({ title, children, className }: any) => (
  <div className={cx('mb-6', className)}>
    {title && <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500 mb-3">{title}</h4>}
    {children}
  </div>
)
export const Desc = ({ items, cols = 2 }: any) => (
  <dl className={cx('grid gap-x-6 gap-y-3', cols === 3 ? 'sm:grid-cols-3' : cols === 1 ? '' : 'sm:grid-cols-2')}>
    {items.filter(Boolean).map((it: any, i: number) => (
      <div key={i}><dt className="text-caption text-ink-400">{it.label}</dt>
        <dd className="text-body text-ink-800 dark:text-ink-100 mt-0.5">{it.value ?? '-'}</dd></div>))}
  </dl>
)
export { Plus, Download, Search }
