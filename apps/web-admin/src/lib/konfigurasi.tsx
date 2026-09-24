import React, { useEffect, useState } from 'react'
import supabase from './supabase'
import { Field, Input, Textarea, Select, Badge, type Column } from '@/components/ui'

/* ============================================================================
 * Konfigurasi adaptif per tenant — dibaca UI saat berjalan, bukan di-hardcode.
 *   useFieldKustom(entity)   -> definisi field tambahan (custom_field_defs)
 *   InputFieldKustom         -> form dinamis untuk kolom `custom` entitas inti
 *   kolomFieldKustom(defs)   -> kolom DataTable dinamis
 *   useLabelStatus(entity)   -> label & warna status versi perusahaan
 * ========================================================================== */

export type DefField = {
  id: string; entity: string; field_key: string; label: string
  data_type: 'teks' | 'teks_panjang' | 'angka' | 'tanggal' | 'pilihan' | 'ya_tidak'
  options: string[]; required: boolean; show_in_table: boolean; filterable: boolean
  help_text: string | null; sort_order: number; is_active: boolean
}

const cache = new Map<string, Promise<DefField[]>>()
export function hapusCacheKonfigurasi() { cache.clear(); labelCache.clear() }

export function useFieldKustom(entity: string) {
  const [defs, setDefs] = useState<DefField[]>([])
  useEffect(() => {
    let batal = false
    if (!cache.has(entity)) {
      cache.set(entity, Promise.resolve(supabase.from('custom_field_defs').select('*').eq('entity', entity).eq('is_active', true)
        .order('sort_order')).then(({ data, error }) => (error ? [] : (data ?? []) as DefField[])))
    }
    cache.get(entity)!.then(d => { if (!batal) setDefs(d) })
    return () => { batal = true }
  }, [entity])
  return defs
}

export function formatNilaiKustom(d: DefField, v: unknown): string {
  if (v === null || v === undefined || v === '') return '-'
  if (d.data_type === 'ya_tidak') return ['true', 'ya', '1'].includes(String(v).toLowerCase()) ? 'Ya' : 'Tidak'
  if (d.data_type === 'angka') return Number(v).toLocaleString('id-ID')
  if (d.data_type === 'tanggal') { const t = new Date(String(v)); return isNaN(+t) ? String(v) : t.toLocaleDateString('id-ID') }
  return String(v)
}

/** Kolom DataTable untuk field kustom yang ditandai "tampil di tabel". */
export function kolomFieldKustom(defs: DefField[]): Column[] {
  return defs.filter(d => d.show_in_table).map(d => ({
    key: `custom.${d.field_key}`, header: d.label,
    render: (r: any) => formatNilaiKustom(d, r?.custom?.[d.field_key]),
  }))
}

/** Validasi di sisi tampilan (basis data tetap memvalidasi ulang lewat trigger). */
export function periksaFieldKustom(defs: DefField[], nilai: Record<string, unknown> | null | undefined): string | null {
  for (const d of defs) {
    const v = nilai?.[d.field_key]
    const kosong = v === null || v === undefined || String(v).trim() === ''
    if (d.required && kosong) return `Kolom "${d.label}" wajib diisi`
    if (!kosong && d.data_type === 'angka' && isNaN(Number(v))) return `Kolom "${d.label}" harus angka`
  }
  return null
}

/** Input dinamis untuk objek `custom` — sisipkan di drawer/form entitas inti. */
export function InputFieldKustom({ defs, value, onChange, judul = 'Data tambahan perusahaan' }: {
  defs: DefField[]; value: Record<string, unknown> | null | undefined; onChange: (v: Record<string, unknown>) => void; judul?: string
}) {
  if (!defs.length) return null
  const v = value ?? {}
  const set = (k: string, x: unknown) => onChange({ ...v, [k]: x })
  return (
    <div className="rounded-md border border-dashed border-primary-200 bg-primary-50/40 p-3 space-y-3">
      <div className="text-caption font-semibold uppercase tracking-wide text-primary-700">{judul}</div>
      {defs.map(d => {
        const nilai = v[d.field_key] as any
        let input: React.ReactNode
        switch (d.data_type) {
          case 'teks_panjang': input = <Textarea rows={2} value={nilai ?? ''} onChange={e => set(d.field_key, e.target.value)} />; break
          case 'angka': input = <Input type="number" step="any" value={nilai ?? ''} onChange={e => set(d.field_key, e.target.value === '' ? null : Number(e.target.value))} />; break
          case 'tanggal': input = <Input type="date" value={nilai ?? ''} onChange={e => set(d.field_key, e.target.value || null)} />; break
          case 'pilihan': input = <Select value={nilai ?? ''} onChange={(e: any) => set(d.field_key, e.target.value || null)} options={d.options.map(o => ({ value: o, label: o }))} />; break
          case 'ya_tidak': input = <Select value={nilai === true || nilai === 'ya' ? 'ya' : nilai === false || nilai === 'tidak' ? 'tidak' : ''}
            onChange={(e: any) => set(d.field_key, e.target.value === '' ? null : e.target.value === 'ya')} options={[{ value: 'ya', label: 'Ya' }, { value: 'tidak', label: 'Tidak' }]} />; break
          default: input = <Input value={nilai ?? ''} onChange={e => set(d.field_key, e.target.value)} />
        }
        return <Field key={d.id} label={d.label} required={d.required} hint={d.help_text ?? undefined}>{input}</Field>
      })}
    </div>
  )
}

/* ------------------------------------------------------------ label status */
export type LabelStatus = { status_code: string; label: string; color: string | null; is_hidden: boolean; sort_order: number }
const labelCache = new Map<string, Promise<LabelStatus[]>>()
const WARNA: Record<string, string> = { slate: 'slate', blue: 'blue', teal: 'teal', green: 'emerald', amber: 'amber', orange: 'orange', red: 'red', purple: 'lavender' }

export function useLabelStatus(entity: string) {
  const [rows, setRows] = useState<LabelStatus[]>([])
  useEffect(() => {
    let batal = false
    if (!labelCache.has(entity)) {
      labelCache.set(entity, Promise.resolve(supabase.from('tenant_status_labels').select('status_code,label,color,is_hidden,sort_order')
        .eq('entity', entity).order('sort_order')).then(({ data, error }) => (error ? [] : (data ?? []) as LabelStatus[])))
    }
    labelCache.get(entity)!.then(r => { if (!batal) setRows(r) })
    return () => { batal = true }
  }, [entity])
  const peta = new Map(rows.map(r => [r.status_code, r]))
  return {
    rows,
    label: (kode: string | null | undefined) => (kode ? peta.get(kode)?.label ?? kode.replace(/_/g, ' ') : '-'),
    badge: (kode: string | null | undefined) => {
      const r = kode ? peta.get(kode) : undefined
      if (!r) return <Badge>{kode ?? '-'}</Badge>
      return <Badge tone={r.color ? WARNA[r.color] : undefined}>{r.label}</Badge>
    },
    /** Opsi dropdown status: urutan & penyembunyian mengikuti konfigurasi perusahaan. */
    opsi: (kodeInti: string[]) => {
      const urut = [...kodeInti].sort((a, b) => (peta.get(a)?.sort_order ?? 99) - (peta.get(b)?.sort_order ?? 99))
      return urut.filter(k => !peta.get(k)?.is_hidden).map(k => ({ value: k, label: peta.get(k)?.label ?? k.replace(/_/g, ' ') }))
    },
  }
}
