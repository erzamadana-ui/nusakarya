export const rupiah = (n?: number | null, compact = false) => {
  if (n == null || isNaN(Number(n))) return '-'
  const v = Number(n)
  if (compact) {
    if (Math.abs(v) >= 1e12) return `Rp ${(v / 1e12).toFixed(2)} T`
    if (Math.abs(v) >= 1e9) return `Rp ${(v / 1e9).toFixed(2)} M`
    if (Math.abs(v) >= 1e6) return `Rp ${(v / 1e6).toFixed(1)} jt`
    if (Math.abs(v) >= 1e3) return `Rp ${(v / 1e3).toFixed(0)} rb`
  }
  return 'Rp ' + v.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}
export const num = (n?: number | null, d = 0) =>
  n == null || isNaN(Number(n)) ? '-' : Number(n).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
export const pct = (n?: number | null, d = 1) => (n == null ? '-' : `${Number(n).toFixed(d)}%`)
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
export const tgl = (s?: string | null) => {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
export const tglJam = (s?: string | null) => {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return `${tgl(s)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
export const durasi = (menit?: number | null) => {
  if (menit == null) return '-'
  const j = Math.floor(menit / 60), m = Math.round(menit % 60)
  return j > 0 ? `${j}j ${m}m` : `${m}m`
}
export const inisial = (nama?: string | null) =>
  (nama || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
export const todayISO = () => new Date().toISOString().slice(0, 10)
export const periodCode = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const exportCSV = (rows: any[], filename: string) => {
  if (!rows?.length) return
  const cols = Object.keys(rows[0])
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = `${filename}.csv`; a.click(); URL.revokeObjectURL(a.href)
}
