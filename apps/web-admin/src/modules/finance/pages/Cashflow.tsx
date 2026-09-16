import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import { rupiah, tgl, todayISO } from '@/lib/format'
import {
  PageHeader, FilterBar, Card, CardHeader, DataTable, Badge, Modal, Field, Input, Select, Money, Textarea, Button,
  useToast, ConfirmDialog, Section, Plus,
} from '@/components/ui'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts'
import { addDays, CHART_COLORS, sisaTagihan, ymLabel } from '../lib/helpers'

const rp = (v: any) => rupiah(Number(v) || 0)
const KATEGORI_OPTIONS = [
  'Penerimaan Piutang (AR)', 'Pembayaran Vendor (AP)', 'Gaji & Upah', 'Operasional Kantor', 'Sewa & Utilitas',
  'Pajak', 'Modal / Investasi', 'Pinjaman', 'Lain-lain',
]

export default function Cashflow() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [flows, setFlows] = useState<any[]>([])
  const [arDue, setArDue] = useState<any[]>([])
  const [apDue, setApDue] = useState<any[]>([])

  const firstOfMonth = todayISO().slice(0, 8) + '01'
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(todayISO())
  const [dirFilter, setDirFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<any>({ flow_date: todayISO(), direction: 'in', category: '', description: '', amount: 0, bank_account: '' })
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

  async function load() {
    setLoading(true)
    try {
      const today = todayISO(); const limit90 = addDays(today, 90)
      const [cf, ar, ap] = await Promise.all([
        list('cash_flows', { eq: { company_id: profile!.company_id }, order: { col: 'flow_date', asc: true }, limit: 5000 }),
        list('ar_invoices', {
          select: 'id,inv_no,due_date,total,paid_amount,status,customer:customers(name)',
          eq: { company_id: profile!.company_id }, gte: { due_date: today }, lte: { due_date: limit90 }, limit: 2000,
        }),
        list('vendor_invoices', {
          select: 'id,inv_no,due_date,total,paid_amount,status,vendor:vendors(name)',
          eq: { company_id: profile!.company_id }, gte: { due_date: today }, lte: { due_date: limit90 }, limit: 2000,
        }),
      ])
      setFlows(cf)
      setArDue(ar.filter((i: any) => !['lunas', 'batal'].includes(i.status)))
      setApDue(ap.filter((i: any) => !['lunas', 'ditolak'].includes(i.status)))
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat arus kas', 'error') } finally { setLoading(false) }
  }

  const filtered = useMemo(() => flows
    .filter(f => (!dateFrom || f.flow_date >= dateFrom) && (!dateTo || f.flow_date <= dateTo))
    .filter(f => !dirFilter || f.direction === dirFilter), [flows, dateFrom, dateTo, dirFilter])

  const runningBalance = useMemo(() => {
    let bal = 0
    return filtered.map(f => {
      bal += f.direction === 'in' ? Number(f.amount || 0) : -Number(f.amount || 0)
      return { tanggal: tgl(f.flow_date), saldo: bal }
    })
  }, [filtered])

  const ringkasanKategori = useMemo(() => {
    const map: Record<string, { kategori: string; masuk: number; keluar: number }> = {}
    filtered.forEach(f => {
      const k = f.category || 'Tanpa Kategori'
      if (!map[k]) map[k] = { kategori: k, masuk: 0, keluar: 0 }
      if (f.direction === 'in') map[k].masuk += Number(f.amount || 0); else map[k].keluar += Number(f.amount || 0)
    })
    return Object.values(map).sort((a, b) => (b.masuk + b.keluar) - (a.masuk + a.keluar))
  }, [filtered])

  const proyeksi90 = useMemo(() => {
    const items = [
      ...arDue.map((i: any) => ({ tanggal: i.due_date, sumber: 'AR' as const, pihak: i.customer?.name ?? '-', inv_no: i.inv_no, nominal: sisaTagihan(i.total, i.paid_amount), arah: 'in' as const })),
      ...apDue.map((i: any) => ({ tanggal: i.due_date, sumber: 'AP' as const, pihak: i.vendor?.name ?? '-', inv_no: i.inv_no, nominal: sisaTagihan(i.total, i.paid_amount), arah: 'out' as const })),
    ].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    const byMonth: Record<string, { masuk: number; keluar: number }> = {}
    items.forEach(it => {
      const m = it.tanggal.slice(0, 7)
      if (!byMonth[m]) byMonth[m] = { masuk: 0, keluar: 0 }
      if (it.arah === 'in') byMonth[m].masuk += it.nominal; else byMonth[m].keluar += it.nominal
    })
    const chart = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({ bulan: ymLabel(m), masuk: v.masuk, keluar: v.keluar }))
    return { items, chart }
  }, [arDue, apDue])

  function openAdd() { setEditing(null); setForm({ flow_date: todayISO(), direction: 'in', category: '', description: '', amount: 0, bank_account: '' }); setModalOpen(true) }
  function openEdit(row: any) { setEditing(row); setForm({ ...row }); setModalOpen(true) }

  async function simpan() {
    if (!form.amount || Number(form.amount) <= 0) { toast.push('Nominal harus lebih dari 0.', 'error'); return }
    setBusy(true)
    try {
      const payload = {
        company_id: profile!.company_id, flow_date: form.flow_date, direction: form.direction,
        category: form.category || null, description: form.description || null, amount: Number(form.amount),
        bank_account: form.bank_account || null,
      }
      if (editing) { await update('cash_flows', editing.id, payload); toast.push('Transaksi kas diperbarui.', 'success') }
      else { await insert('cash_flows', payload); toast.push('Transaksi kas ditambahkan.', 'success') }
      setModalOpen(false); await load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan transaksi kas', 'error') } finally { setBusy(false) }
  }
  async function hapus() {
    if (!confirmDelete) return
    try { await remove('cash_flows', confirmDelete.id); toast.push('Transaksi kas dihapus.', 'success'); await load() }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus transaksi', 'error') }
  }

  return (
    <div>
      <PageHeader title="Arus Kas" subtitle="Catatan kas masuk/keluar, saldo berjalan, dan proyeksi likuiditas 90 hari."
        actions={can('FINANCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Transaksi</Button>} />

      <FilterBar>
        <Field label="Dari Tanggal"><Input type="date" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} /></Field>
        <Field label="Sampai Tanggal"><Input type="date" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} /></Field>
        <Field label="Arah"><Select value={dirFilter} onChange={(e: any) => setDirFilter(e.target.value)} options={[{ value: 'in', label: 'Masuk' }, { value: 'out', label: 'Keluar' }]} placeholder="Semua arah" /></Field>
      </FilterBar>

      <Section title="Saldo Kas Berjalan (Rentang Terpilih)">
        <Card className="p-4">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={runningBalance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EB" />
              <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => rupiah(v, true)} width={70} />
              <Tooltip formatter={(v: any) => rp(v)} />
              <Area type="monotone" dataKey="saldo" name="Saldo" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.18} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-caption text-ink-400 mt-2">Saldo kumulatif dihitung mulai dari 0 pada awal rentang tanggal terpilih (bukan saldo kas riil perusahaan, karena tidak ada saldo awal tersimpan). Sumber: cash_flows. Ditarik: {tgl(todayISO())}.</p>
        </Card>
      </Section>

      <Section title="Ringkasan per Kategori">
        <Card className="overflow-hidden">
          {ringkasanKategori.length === 0 ? <div className="p-6 text-center text-body text-ink-400">Belum ada transaksi pada rentang ini.</div> : (
            <table className="w-full text-body">
              <thead className="bg-ink-50 dark:bg-surface-darker"><tr>
                <th className="text-left px-4 py-2.5 text-caption font-semibold uppercase text-ink-500">Kategori</th>
                <th className="text-right px-4 py-2.5 text-caption font-semibold uppercase text-ink-500">Masuk</th>
                <th className="text-right px-4 py-2.5 text-caption font-semibold uppercase text-ink-500">Keluar</th>
                <th className="text-right px-4 py-2.5 text-caption font-semibold uppercase text-ink-500">Netto</th>
              </tr></thead>
              <tbody>
                {ringkasanKategori.map((r, i) => (
                  <tr key={i} className="border-t border-ink-100 dark:border-ink-800">
                    <td className="px-4 py-2.5">{r.kategori}</td>
                    <td className="px-4 py-2.5 text-right tabular text-emerald-600">{rp(r.masuk)}</td>
                    <td className="px-4 py-2.5 text-right tabular text-red-600">{rp(r.keluar)}</td>
                    <td className="px-4 py-2.5 text-right tabular font-medium">{rp(r.masuk - r.keluar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Section>

      <Section title="Daftar Transaksi Kas">
        <DataTable
          loading={loading}
          rows={filtered}
          rowKey="id"
          searchKeys={['category', 'description']}
          exportName="arus-kas"
          emptyTitle="Belum ada transaksi"
          columns={[
            { key: 'flow_date', header: 'Tanggal', render: (r) => tgl(r.flow_date) },
            { key: 'direction', header: 'Arah', render: (r) => r.direction === 'in' ? <Badge tone="emerald">Masuk</Badge> : <Badge tone="red">Keluar</Badge> },
            { key: 'category', header: 'Kategori', render: (r) => r.category || '-' },
            { key: 'description', header: 'Keterangan', render: (r) => r.description || '-' },
            { key: 'bank_account', header: 'Rekening', render: (r) => r.bank_account || '-' },
            { key: 'amount', header: 'Nominal', align: 'right', render: (r) => rp(r.amount) },
            {
              key: 'aksi', header: '', sortable: false, align: 'right', render: (r) => can('FINANCE', 'write') && (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>
                  {can('FINANCE', 'approve') && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(r)}>Hapus</Button>}
                </div>
              ),
            },
          ]}
        />
      </Section>

      <Section title="Proyeksi Arus Kas 90 Hari">
        <Card className="p-4">
          <div className="mb-3 px-3 py-2 rounded-sm bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-caption font-medium">
            PROYEKSI — berdasarkan tanggal jatuh tempo AR/AP, bukan komitmen bayar aktual.
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={proyeksi90.chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EB" />
              <XAxis dataKey="bulan" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => rupiah(v, true)} width={70} />
              <Tooltip formatter={(v: any) => rp(v)} />
              <Legend />
              <Bar dataKey="masuk" name="Proyeksi Masuk (AR)" fill={CHART_COLORS.masuk} radius={[3, 3, 0, 0]} />
              <Bar dataKey="keluar" name="Proyeksi Keluar (AP)" fill={CHART_COLORS.keluar} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 border border-ink-200 dark:border-ink-800 rounded-md overflow-hidden">
            <div className="max-h-64 overflow-y-auto divide-y divide-ink-100 dark:divide-ink-800">
              {proyeksi90.items.length === 0 ? <div className="p-6 text-center text-body text-ink-400">Tidak ada AR/AP jatuh tempo dalam 90 hari ke depan.</div> :
                proyeksi90.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-body">
                    <div className="flex items-center gap-2">
                      <Badge tone={it.arah === 'in' ? 'emerald' : 'red'}>{it.sumber}</Badge>
                      <div><div className="font-medium">{it.pihak}</div><div className="text-caption text-ink-400">{it.inv_no} · jatuh tempo {tgl(it.tanggal)}</div></div>
                    </div>
                    <div className={`tabular font-medium ${it.arah === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>{it.arah === 'in' ? '+' : '−'}{rp(it.nominal)}</div>
                  </div>
                ))}
            </div>
          </div>
          <p className="text-caption text-ink-400 mt-2">Sumber: ar_invoices & vendor_invoices belum lunas dengan jatuh tempo {tgl(todayISO())} s.d. {tgl(addDays(todayISO(), 90))}. Ditarik: {tgl(todayISO())}.</p>
        </Card>
      </Section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Ubah Transaksi Kas' : 'Tambah Transaksi Kas'} size="sm"
        footer={<Button loading={busy} onClick={simpan}>Simpan</Button>}>
        <div className="space-y-3">
          <Field label="Tanggal" required><Input type="date" value={form.flow_date} onChange={(e: any) => setForm((f: any) => ({ ...f, flow_date: e.target.value }))} /></Field>
          <Field label="Arah" required><Select value={form.direction} onChange={(e: any) => setForm((f: any) => ({ ...f, direction: e.target.value }))} options={[{ value: 'in', label: 'Masuk' }, { value: 'out', label: 'Keluar' }]} /></Field>
          <Field label="Kategori"><Select value={form.category ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, category: e.target.value }))} options={KATEGORI_OPTIONS} /></Field>
          <Field label="Keterangan"><Textarea value={form.description ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, description: e.target.value }))} /></Field>
          <Field label="Rekening Bank"><Input value={form.bank_account ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, bank_account: e.target.value }))} placeholder="Opsional" /></Field>
          <Field label="Nominal" required><Money value={form.amount} onChange={(v: number) => setForm((f: any) => ({ ...f, amount: v }))} /></Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={hapus} danger
        title="Hapus Transaksi Kas" message="Hapus transaksi kas ini? Tindakan ini tidak dapat dibatalkan." />
    </div>
  )
}
