import supabase from '@/lib/supabase'
import type { Dataset, KolomDataset, TipeKolom } from './tipe'

/* ============================================================================
 * Dataset dinamis — mengikuti konfigurasi tenant, tanpa coding ulang:
 *   1. Field kustom (custom_field_defs) ditambahkan sebagai kolom "custom.<kunci>"
 *      pada dataset inti yang tabelnya sama (work_orders, employees, customers, ...).
 *   2. Setiap tabel kustom (custom_tables) menjadi dataset impor sendiri.
 * ========================================================================== */

export type DefField = {
  id: string; entity: string; field_key: string; label: string; data_type: string
  options: string[]; required: boolean; is_active: boolean; sort_order: number; help_text?: string | null
  show_in_table?: boolean; filterable?: boolean
}
export type TabelKustom = { id: string; code: string; name: string; description: string | null; module_code: string; is_active: boolean }

const TIPE: Record<string, TipeKolom> = {
  teks: 'teks', teks_panjang: 'teks', angka: 'angka', tanggal: 'tanggal', pilihan: 'teks', ya_tidak: 'boolean',
}

export function kolomDariField(d: DefField, awalan: 'custom' | 'data'): KolomDataset {
  return {
    nama: `${awalan}.${d.field_key}`,
    label: d.label,
    wajib: d.required,
    tipe: TIPE[d.data_type] ?? 'teks',
    nilaiSah: d.data_type === 'pilihan' && d.options?.length ? d.options : undefined,
  }
}

export async function muatDefField(): Promise<DefField[]> {
  const { data, error } = await supabase.from('custom_field_defs').select('*').eq('is_active', true).order('sort_order')
  if (error) return []
  return (data ?? []) as DefField[]
}

export async function muatTabelKustom(): Promise<TabelKustom[]> {
  const { data, error } = await supabase.from('custom_tables').select('*').eq('is_active', true).order('name')
  if (error) return []
  return (data ?? []) as TabelKustom[]
}

/** Gabungkan dataset statis dengan field kustom tenant + dataset tabel kustom. */
export function susunDataset(statis: Dataset[], defs: DefField[], tabel: TabelKustom[]): Dataset[] {
  const hasil = statis.map(ds => {
    const tambahan = defs.filter(d => d.entity === ds.tabel).map(d => kolomDariField(d, 'custom'))
    if (!tambahan.length) return ds
    return { ...ds, kolom: [...ds.kolom, ...tambahan] }
  })
  for (const t of tabel) {
    const kolom = defs.filter(d => d.entity === `ct:${t.code}`).map(d => kolomDariField(d, 'data'))
    if (!kolom.length) continue
    hasil.push({
      kode: `ct:${t.code}`, label: `${t.name} (tabel kustom)`, keterangan: t.description || 'Tabel kustom buatan perusahaan Anda.',
      tabel: 'custom_records', modul: t.module_code, kunciAlami: null, konflikUpsert: null, kolom,
      contoh: [], tableId: t.id, dinamis: true,
    })
  }
  return hasil
}
