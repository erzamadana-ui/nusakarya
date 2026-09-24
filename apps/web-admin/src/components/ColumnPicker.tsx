import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button, cx } from '@/components/ui'

export type ColumnDef = {
  key: string
  header: string
  /** false = disembunyikan secara bawaan (tetap bisa dinyalakan lewat pengaturan kolom). */
  defaultVisible?: boolean
  /** true = kolom kunci, tidak boleh dimatikan. */
  locked?: boolean
}

function bacaSimpanan(storageKey: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : null
  } catch { return null }
}

/**
 * Pengaturan kolom tabel. Mengembalikan daftar key kolom yang tampil +
 * tombol popover untuk menyalakan/mematikan kolom. Pilihan disimpan per-peramban
 * di localStorage sehingga tidak hilang saat pindah halaman.
 */
export function useColumnPicker(storageKey: string, defs: ColumnDef[]) {
  const bawaan = useMemo(
    () => defs.filter(d => d.locked || d.defaultVisible !== false).map(d => d.key),
    [defs],
  )
  const [visible, setVisible] = useState<string[]>(() => bacaSimpanan(storageKey) ?? bawaan)

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(visible)) } catch { /* localStorage bisa diblokir */ }
  }, [storageKey, visible])

  const shown = useMemo(() => {
    const set = new Set(visible)
    return new Set(defs.filter(d => d.locked || set.has(d.key)).map(d => d.key))
  }, [defs, visible])

  const toggle = (key: string) => setVisible(v => (v.includes(key) ? v.filter(k => k !== key) : [...v, key]))
  const reset = () => setVisible(bawaan)

  const control = <ColumnPickerButton defs={defs} shown={shown} onToggle={toggle} onReset={reset} />
  return { shown, control, isShown: (key: string) => shown.has(key) }
}

function ColumnPickerButton({ defs, shown, onToggle, onReset }: {
  defs: ColumnDef[]; shown: Set<string>; onToggle: (k: string) => void; onReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="outline" icon={<Settings2 size={14} />} onClick={() => setOpen(o => !o)}>
        Kolom ({shown.size})
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-64 max-h-80 overflow-auto bg-surface border border-ink-200 rounded-md shadow-e2 py-1">
          <p className="px-3 py-2 text-caption text-ink-400">Pilih kolom yang ditampilkan</p>
          {defs.map(d => (
            <label key={d.key}
              className={cx('flex items-center gap-2 px-3 py-2 text-body cursor-pointer hover:bg-ink-50',
                d.locked && 'opacity-60 cursor-not-allowed')}>
              <input type="checkbox" className="w-4 h-4 rounded-xs" disabled={d.locked}
                checked={shown.has(d.key)} onChange={() => !d.locked && onToggle(d.key)} />
              <span className="text-ink-700">{d.header}</span>
            </label>
          ))}
          <div className="px-3 py-2 border-t border-ink-100">
            <button type="button" onClick={onReset} className="text-caption text-primary-600 hover:underline">
              Kembalikan ke bawaan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Input banyak nilai (text[]) — chip yang bisa dihapus + saran nilai yang sudah dipakai. */
export function MultiValueInput({ value, onChange, suggestions = [], placeholder = 'Ketik lalu tekan Enter' }: {
  value: string[]
  onChange: (v: string[]) => void
  suggestions?: string[]
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const val = Array.isArray(value) ? value : []
  const tambah = (raw: string) => {
    const v = raw.trim()
    if (!v || val.includes(v)) { setDraft(''); return }
    onChange([...val, v]); setDraft('')
  }
  const sisaSaran = suggestions.filter(s => !val.includes(s))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {val.map(v => (
          <span key={v} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-primary-50 border border-primary-200 text-caption text-primary-700">
            {v}
            <button type="button" aria-label={`Hapus ${v}`} className="w-4 h-4 grid place-items-center rounded-full hover:bg-primary-100"
              onClick={() => onChange(val.filter(x => x !== v))}>×</button>
          </span>
        ))}
        {val.length === 0 && <span className="text-caption text-ink-400">Belum ada nilai</span>}
      </div>
      <input
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); tambah(draft) }
          else if (e.key === 'Backspace' && !draft && val.length) onChange(val.slice(0, -1))
        }}
        onBlur={() => tambah(draft)}
        className="w-full h-11 px-3 rounded-sm border border-ink-200 bg-surface text-body text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
      {sisaSaran.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sisaSaran.slice(0, 12).map(s => (
            <button key={s} type="button" onClick={() => tambah(s)}
              className="h-7 px-2.5 rounded-full border border-ink-200 bg-surface text-caption text-ink-500 hover:bg-ink-50">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
