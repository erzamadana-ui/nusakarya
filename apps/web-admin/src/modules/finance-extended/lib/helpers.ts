/** Util murni untuk modul Finance Extended — COA, Jurnal, Pajak, Kas Kecil, Bank & Rekonsiliasi. */

export type Tone = 'slate' | 'emerald' | 'amber' | 'orange' | 'red' | 'blue' | 'zinc'

export const ACCOUNT_TYPES = [
  { value: 'aset', label: 'Aset' },
  { value: 'liabilitas', label: 'Liabilitas' },
  { value: 'ekuitas', label: 'Ekuitas' },
  { value: 'pendapatan', label: 'Pendapatan' },
  { value: 'beban', label: 'Beban' },
]
export const ACCOUNT_TYPE_LABEL: Record<string, string> = Object.fromEntries(ACCOUNT_TYPES.map(a => [a.value, a.label]))

export const NORMAL_BALANCE_OPTIONS = [
  { value: 'debit', label: 'Debit' },
  { value: 'kredit', label: 'Kredit' },
]

export type CoaNode = { account_code: string; account_name: string; parent_code: string | null; [k: string]: any; children: CoaNode[] }

/** Susun daftar akun datar menjadi pohon berdasarkan parent_code. Akun tanpa induk valid (null / tidak ditemukan) jadi akar. */
export function buildCoaTree(rows: any[]): CoaNode[] {
  const byCode = new Map<string, CoaNode>()
  rows.forEach(r => byCode.set(r.account_code, { ...r, children: [] }))
  const roots: CoaNode[] = []
  byCode.forEach(node => {
    const p = node.parent_code
    if (p && byCode.has(p) && p !== node.account_code) {
      byCode.get(p)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortRec = (list: CoaNode[]) => {
    list.sort((a, b) => a.account_code.localeCompare(b.account_code))
    list.forEach(n => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/** Ratakan pohon (urutan tampil) untuk kebutuhan ekspor CSV. */
export function flattenCoaTree(nodes: CoaNode[], depth = 0, out: any[] = []): any[] {
  nodes.forEach(n => {
    out.push({
      'Kode Akun': n.account_code, 'Nama Akun': '  '.repeat(depth) + n.account_name,
      'Jenis Akun': ACCOUNT_TYPE_LABEL[n.account_type] ?? n.account_type, 'Saldo Normal': n.normal_balance === 'debit' ? 'Debit' : 'Kredit',
      'Dapat Diposting': n.is_postable ? 'Ya' : 'Tidak', 'Induk Akun': n.parent_code ?? '-', 'Aktif': n.is_active ? 'Ya' : 'Tidak',
    })
    flattenCoaTree(n.children, depth + 1, out)
  })
  return out
}

/** Cek apakah `candidateParent` adalah keturunan dari `code` (mencegah siklus induk-anak). */
export function isDescendant(rows: any[], code: string, candidateParent: string): boolean {
  let cur: string | null = candidateParent
  const byCode = new Map(rows.map(r => [r.account_code, r.parent_code]))
  const seen = new Set<string>()
  while (cur) {
    if (cur === code) return true
    if (seen.has(cur)) break
    seen.add(cur)
    cur = byCode.get(cur) ?? null
  }
  return false
}

export const JOURNAL_STATUS_STEPS = ['Draft', 'Diposting']

export const TAX_TYPES: { value: string; label: string; group: 'ppn' | 'pph' }[] = [
  { value: 'ppn_keluaran', label: 'PPN Keluaran', group: 'ppn' },
  { value: 'ppn_masukan', label: 'PPN Masukan', group: 'ppn' },
  { value: 'pph21', label: 'PPh 21', group: 'pph' },
  { value: 'pph23', label: 'PPh 23', group: 'pph' },
  { value: 'pph4a2', label: 'PPh 4(2)', group: 'pph' },
  { value: 'pph_final', label: 'PPh Final', group: 'pph' },
]
export const TAX_TYPE_LABEL: Record<string, string> = Object.fromEntries(TAX_TYPES.map(t => [t.value, t.label]))

export const currentPeriod = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
export function periodLabel(p: string) {
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const [y, m] = p.split('-')
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a), db = new Date(b)
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

/** Baris impor mutasi rekening koran: tanggal|uraian|debit|kredit */
export function parseStatementLines(text: string): Array<{ transaction_date: string; description: string; debit: number; credit: number }> {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split('|').map(p => p.trim())
    const [tanggal, uraian, debit, kredit] = parts
    return {
      transaction_date: tanggal, description: uraian ?? '',
      debit: Number(String(debit ?? '0').replace(/[^\d.-]/g, '')) || 0,
      credit: Number(String(kredit ?? '0').replace(/[^\d.-]/g, '')) || 0,
    }
  }).filter(r => r.transaction_date)
}

export type MatchCandidate = { source: 'cash_flows' | 'ap_payments' | 'ar_payments'; id: string; date: string; amount: number; label: string }

/** Usulkan calon pasangan mutasi untuk satu baris rekening koran, berdasar nominal identik & tanggal berdekatan (±3 hari). */
export function findCandidates(
  line: { transaction_date: string; debit: number; credit: number },
  pools: { cashFlows: any[]; apPayments: any[]; arPayments: any[] },
  windowDays = 3,
): MatchCandidate[] {
  const target = line.debit > 0 ? line.debit : line.credit
  if (!target) return []
  const out: MatchCandidate[] = []
  pools.cashFlows.forEach(cf => {
    if (Number(cf.amount) === target && Math.abs(daysBetween(cf.flow_date, line.transaction_date)) <= windowDays) {
      out.push({ source: 'cash_flows', id: cf.id, date: cf.flow_date, amount: Number(cf.amount), label: `Kas — ${cf.description || cf.category || '-'}` })
    }
  })
  if (line.debit > 0) {
    pools.apPayments.forEach(p => {
      if (Number(p.amount) === target && Math.abs(daysBetween(p.payment_date, line.transaction_date)) <= windowDays) {
        out.push({ source: 'ap_payments', id: p.id, date: p.payment_date, amount: Number(p.amount), label: `Bayar AP ${p.payment_no ?? ''} — ${p.vendor?.name ?? ''}` })
      }
    })
  }
  if (line.credit > 0) {
    pools.arPayments.forEach(p => {
      if (Number(p.amount) === target && Math.abs(daysBetween(p.payment_date, line.transaction_date)) <= windowDays) {
        out.push({ source: 'ar_payments', id: p.id, date: p.payment_date, amount: Number(p.amount), label: `Terima AR ${p.payment_no ?? ''} — ${p.customer?.name ?? ''}` })
      }
    })
  }
  return out
}

export const uid = () => Math.random().toString(36).slice(2, 10)
