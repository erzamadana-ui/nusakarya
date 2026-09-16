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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu']

export const tgl = (s?: string | null) => {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export const tglPanjang = (s?: string | null) => {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return `${DAYS[d.getDay()]}, ${tgl(s)}`
}

export const tglJam = (s?: string | null) => {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return `${tgl(s)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const jam = (s?: string | null) => {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const durasi = (menit?: number | null) => {
  if (menit == null) return '-'
  const j = Math.floor(menit / 60)
  const m = Math.round(menit % 60)
  return j > 0 ? `${j}j ${m}m` : `${m}m`
}

/** Format hitung mundur SLA dalam bentuk singkat "2j 15m lagi" / "Lewat 10m". */
export const sisaWaktu = (dueISO?: string | null) => {
  if (!dueISO) return '-'
  const due = new Date(dueISO).getTime()
  if (isNaN(due)) return '-'
  const diffMin = Math.round((due - Date.now()) / 60000)
  const abs = Math.abs(diffMin)
  const j = Math.floor(abs / 60)
  const m = abs % 60
  const teks = j > 0 ? `${j}j ${m}m` : `${m}m`
  return diffMin >= 0 ? `${teks} lagi` : `Lewat ${teks}`
}

export const inisial = (nama?: string | null) =>
  (nama || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const periodCode = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export const pctBulan = (n?: number | null, d = 1) => (n == null || isNaN(Number(n)) ? '-' : `${Number(n).toFixed(d)}%`)
