import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ArrowRight, Info } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo } from '@/lib/db'
import { rupiah, tgl, num, pct, todayISO } from '@/lib/format'
import {
  PageHeader, Card, CardHeader, KpiCard, DataTable, Badge, Button, Drawer, Stepper,
  Field, Input, Select, Textarea, Money, useToast, TableSkeleton, EmptyState, Plus,
} from '@/components/ui'
import { RTV_STATUS_STEPS, RTV_STATUS_STEP_VALUES, RTV_REASON_OPTIONS, CHART_COLORS } from '../lib/constants'
import { isSameMonth } from '../lib/helpers'

type RtvItemRow = { id?: string; item_id: string; qty: number; uom: string; price: number; reason: string }

function emptyForm() {
  return { rtv_no: '', rtv_date: todayISO(), vendor_id: '', po_id: '', gr_id: '', reason: '', note: '', status: 'draft' }
}

export default function Retur() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const writable = can('PROCUREMENT', 'write')
  const approver = can('PROCUREMENT', 'approve')

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [pos, setPos] = useState<any[]>([])
  const [grs, setGrs] = useState<any[]>([])
  const [poItems, setPoItems] = useState<any[]>([])
  const [grItems, setGrItems] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])

  const [drawer, setDrawer] = useState<{ open: boolean; row?: any }>({ open: false })
  const [form, setForm] = useState<any>(emptyForm())
  const [rtvItems, setRtvItems] = useState<RtvItemRow[]>([])
  const [saving, setSaving] = useState(false)

  const vendorMap = useMemo(() => Object.fromEntries(vendors.map(v => [v.id, v.name])), [vendors])
  const itemMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])

  const load = async () => {
    setLoading(true)
    try {
      const [rtv, v, po, gr, pi, gi, ic] = await Promise.all([
        list('vendor_returns', { order: { col: 'rtv_date', asc: false }, limit: 1000 }),
        list('vendors', { select: 'id,name', order: { col: 'name', asc: true }, limit: 1000 }),
        list('purchase_orders', { select: 'id,po_no,vendor_id,po_date,total,status', limit: 3000 }),
        list('goods_receipts', { select: 'id,gr_no,po_id,gr_date', limit: 3000 }),
        list('po_items', { select: 'id,po_id,item_id,description,price,uom', limit: 5000 }),
        list('gr_items', { select: 'id,gr_id,po_item_id,qty_received', limit: 5000 }),
        list('item_catalog', { select: 'id,code,name,uom,last_price', eq: { is_active: true }, order: { col: 'name', asc: true }, limit: 1000 }),
      ])
      setRows(rtv); setVendors(v); setPos(po); setGrs(gr); setPoItems(pi); setGrItems(gi); setItems(ic)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data retur vendor', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  /* ---------------- KPI ---------------- */
  const kpi = useMemo(() => {
    const valid = rows.filter(r => r.status !== 'ditolak')
    const thisMonth = valid.filter(r => isSameMonth(r.rtv_date)).reduce((s, r) => s + Number(r.total_amount || 0), 0)
    const byVendor: Record<string, number> = {}
    valid.forEach(r => { byVendor[r.vendor_id] = (byVendor[r.vendor_id] ?? 0) + 1 })
    const topVendorEntry = Object.entries(byVendor).sort(([, a], [, b]) => b - a)[0]
    const priceByPoItem = Object.fromEntries(poItems.map(p => [p.id, Number(p.price) || 0]))
    const totalReceivedValue = grItems.reduce((s, g) => s + Number(g.qty_received || 0) * (priceByPoItem[g.po_item_id] ?? 0), 0)
    const totalReturnValue = valid.reduce((s, r) => s + Number(r.total_amount || 0), 0)
    const returnRatio = totalReceivedValue > 0 ? (totalReturnValue / totalReceivedValue) * 100 : 0
    return {
      thisMonth,
      topVendorName: topVendorEntry ? (vendorMap[topVendorEntry[0]] ?? '-') : '-',
      topVendorCount: topVendorEntry ? topVendorEntry[1] : 0,
      returnRatio, totalReceivedValue, totalReturnValue,
    }
  }, [rows, poItems, grItems, vendorMap])

  const perVendorChart = useMemo(() => {
    const g: Record<string, number> = {}
    rows.filter(r => r.status !== 'ditolak').forEach(r => { const n = vendorMap[r.vendor_id] ?? '-'; g[n] = (g[n] ?? 0) + Number(r.total_amount || 0) })
    return Object.entries(g).map(([name, nilai]) => ({ name, nilai })).sort((a, b) => b.nilai - a.nilai).slice(0, 8)
  }, [rows, vendorMap])

  /* ---------------- CRUD ---------------- */
  const openAdd = async () => {
    let no = ''
    try { no = await nextDocNo(profile!.company_id, 'RTV') } catch { /* biarkan kosong bila gagal */ }
    setForm({ ...emptyForm(), rtv_no: no })
    setRtvItems([])
    setDrawer({ open: true })
  }

  const openDetail = async (row: any) => {
    setForm({ ...row })
    try { setRtvItems((await list('vendor_return_items', { eq: { rtv_id: row.id } })).map((x: any) => ({ ...x, qty: Number(x.qty), price: Number(x.price) }))) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat item retur', 'error') }
    setDrawer({ open: true, row })
  }

  const editable = !drawer.row || drawer.row.status === 'draft'
  const total = useMemo(() => rtvItems.reduce((a, r) => a + Number(r.qty) * Number(r.price), 0), [rtvItems])

  function addItemRow() { setRtvItems(v => [...v, { item_id: '', qty: 1, uom: '', price: 0, reason: RTV_REASON_OPTIONS[0] }]) }
  function removeItemRow(idx: number) { setRtvItems(v => v.filter((_, i) => i !== idx)) }
  function patchItemRow(idx: number, patch: Partial<RtvItemRow>) { setRtvItems(v => v.map((r, i) => i === idx ? { ...r, ...patch } : r)) }
  function onPickItem(idx: number, itemId: string) {
    const it = itemMap[itemId]
    patchItemRow(idx, { item_id: itemId, uom: it?.uom ?? '', price: Number(it?.last_price ?? 0) })
  }

  const posForVendor = pos.filter(p => !form.vendor_id || p.vendor_id === form.vendor_id)
  const grsForPo = grs.filter(g => !form.po_id || g.po_id === form.po_id)

  async function persist(nextStatus?: string) {
    if (!form.vendor_id || !form.reason) { toast.push('Vendor dan alasan retur wajib diisi', 'error'); return null }
    if (rtvItems.length === 0 || rtvItems.some(r => !r.item_id || Number(r.qty) <= 0)) { toast.push('Tambahkan minimal satu baris item dengan qty > 0', 'error'); return null }
    setSaving(true)
    try {
      let rtvId = drawer.row?.id
      const header: any = {
        vendor_id: form.vendor_id, po_id: form.po_id || null, gr_id: form.gr_id || null, reason: form.reason,
        note: form.note ?? '', total_amount: total, status: nextStatus ?? 'draft',
      }
      if (!rtvId) {
        const rtv_no = await nextDocNo(profile!.company_id, 'RTV')
        const created = await insert('vendor_returns', { ...header, rtv_no, rtv_date: form.rtv_date || todayISO(), company_id: profile!.company_id, created_by: profile!.id })
        rtvId = created.id
        for (const r of rtvItems) await insert('vendor_return_items', {
          company_id: profile!.company_id, rtv_id: rtvId, item_id: r.item_id, qty: r.qty, uom: r.uom,
          price: r.price, amount: Number(r.qty) * Number(r.price), reason: r.reason || '', created_by: profile!.id,
        })
      } else {
        await update('vendor_returns', rtvId, header)
        const existing = await list('vendor_return_items', { eq: { rtv_id: rtvId } })
        for (const ex of existing) if (!rtvItems.some(r => r.id === ex.id)) await remove('vendor_return_items', ex.id)
        for (const r of rtvItems) {
          const amount = Number(r.qty) * Number(r.price)
          if (r.id) await update('vendor_return_items', r.id, { item_id: r.item_id, qty: r.qty, uom: r.uom, price: r.price, amount, reason: r.reason || '' })
          else await insert('vendor_return_items', { company_id: profile!.company_id, rtv_id: rtvId, item_id: r.item_id, qty: r.qty, uom: r.uom, price: r.price, amount, reason: r.reason || '', created_by: profile!.id })
        }
      }
      return rtvId
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan retur', 'error'); return null }
    finally { setSaving(false) }
  }

  async function onSaveDraft() { if (await persist()) { toast.push('Draft retur tersimpan'); setDrawer({ open: false }); load() } }
  async function onAjukan() { if (await persist('diajukan')) { toast.push('Retur diajukan untuk persetujuan'); setDrawer({ open: false }); load() } }
  async function setStatus(status: string, msg: string) {
    setSaving(true)
    try { await update('vendor_returns', drawer.row.id, { status }); toast.push(msg); setDrawer({ open: false }); load() }
    catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui status retur', 'error') }
    finally { setSaving(false) }
  }

  const columns = [
    { key: 'rtv_no', header: 'No RTV', width: '150px' },
    { key: 'rtv_date', header: 'Tanggal', render: (r: any) => tgl(r.rtv_date) },
    { key: 'vendor_id', header: 'Vendor', render: (r: any) => vendorMap[r.vendor_id] ?? '-' },
    { key: 'reason', header: 'Alasan', render: (r: any) => <span className="line-clamp-1">{r.reason}</span> },
    { key: 'total_amount', header: 'Nilai', align: 'right' as const, render: (r: any) => rupiah(r.total_amount) },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="Retur ke Vendor (RTV)" subtitle="Pengembalian barang ke vendor akibat cacat/ketidaksesuaian, tertaut GR/PO asal."
        actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Buat Retur</Button>} />

      {loading ? <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="p-4"><TableSkeleton rows={2} /></Card>)}</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <KpiCard label="Nilai Retur Bulan Ini" value={rupiah(kpi.thisMonth, true)} tone="amber" />
          <KpiCard label="Vendor Retur Terbanyak" value={kpi.topVendorName} sub={`${num(kpi.topVendorCount)} retur`} tone="red" />
          <KpiCard label="Rasio Retur vs Nilai Penerimaan" value={pct(kpi.returnRatio)} sub={`${rupiah(kpi.totalReturnValue, true)} / ${rupiah(kpi.totalReceivedValue, true)}`} tone="teal" />
        </div>
      )}
      <p className="text-caption text-ink-400 -mt-3 mb-5">Sumber data: vendor_returns, vendor_return_items, gr_items, po_items — ditarik {tgl(todayISO())}. Retur berstatus "ditolak" tidak dihitung dalam KPI.</p>

      <Card className="mb-5">
        <CardHeader title="Nilai Retur per Vendor" subtitle="Total nilai retur valid (di luar status ditolak)" />
        <div className="p-4 h-64">
          {loading ? <TableSkeleton rows={4} /> : perVendorChart.length === 0 ? <EmptyState title="Belum ada data retur" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perVendorChart} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E6EB" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tickFormatter={(v) => rupiah(v, true)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v: any) => rupiah(Number(v))} />
                <Bar dataKey="nilai" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>)}
        </div>
      </Card>

      {loading ? <Card><TableSkeleton /></Card> : (
        <DataTable columns={columns} rows={rows} searchable searchKeys={['rtv_no', 'reason']} exportName="retur-vendor" onRowClick={openDetail}
          emptyTitle="Belum ada retur vendor" emptyMessage="Buat retur ketika barang tidak sesuai spesifikasi saat inspeksi GR."
          emptyAction={writable && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Buat Retur</Button>} />
      )}

      <Drawer open={drawer.open} onClose={() => setDrawer({ open: false })} width="max-w-3xl"
        title={drawer.row ? drawer.row.rtv_no : 'Buat Retur Vendor'}
        footer={<div className="flex flex-wrap justify-end gap-2 w-full">
          {editable && writable && <Button variant="outline" loading={saving} onClick={onSaveDraft}>Simpan Draft</Button>}
          {editable && writable && <Button loading={saving} onClick={onAjukan}>Ajukan</Button>}
          {drawer.row?.status === 'diajukan' && approver && (
            <><Button variant="danger" loading={saving} onClick={() => setStatus('ditolak', 'Retur ditolak')}>Tolak</Button>
              <Button variant="success" loading={saving} onClick={() => setStatus('disetujui', 'Retur disetujui')}>Setujui</Button></>
          )}
          {drawer.row?.status === 'disetujui' && writable && <Button loading={saving} onClick={() => setStatus('dikirim', 'Retur ditandai terkirim ke vendor')}>Tandai Dikirim</Button>}
          {drawer.row?.status === 'dikirim' && writable && <Button loading={saving} onClick={() => setStatus('selesai', 'Retur ditandai selesai')}>Tandai Selesai</Button>}
        </div>}>
        {drawer.row && drawer.row.status !== 'ditolak' && <div className="mb-4"><Stepper steps={RTV_STATUS_STEPS} current={Math.max(0, RTV_STATUS_STEP_VALUES.indexOf(drawer.row.status))} /></div>}
        {drawer.row?.status === 'ditolak' && <div className="mb-4"><Badge tone="red">Retur Ditolak</Badge></div>}

        {drawer.row && ['disetujui', 'dikirim', 'selesai'].includes(drawer.row.status) && (
          <Card className="mb-4 p-3 bg-primary-50/50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 flex items-start gap-2.5">
            <Info size={16} className="text-primary-600 mt-0.5 shrink-0" />
            <p className="text-caption text-ink-700 dark:text-ink-200 flex-1">Retur yang disetujui perlu diikuti mutasi stok keluar pada modul Inventory agar saldo stok gudang akurat.</p>
            <Button size="sm" variant="outline" icon={<ArrowRight size={13} />} onClick={() => navigate('/inventory/mutasi')}>Buka Mutasi Stok</Button>
          </Card>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <Field label="Tanggal Retur"><Input type="date" disabled={!editable} value={form.rtv_date ?? ''} onChange={(e: any) => setForm({ ...form, rtv_date: e.target.value })} /></Field>
          <Field label="Vendor" required><Select disabled={!editable} value={form.vendor_id ?? ''} onChange={(e: any) => setForm({ ...form, vendor_id: e.target.value, po_id: '', gr_id: '' })} options={vendors.map(v => ({ value: v.id, label: v.name }))} /></Field>
          <Field label="Referensi PO"><Select disabled={!editable} value={form.po_id ?? ''} onChange={(e: any) => setForm({ ...form, po_id: e.target.value, gr_id: '' })} options={posForVendor.map(p => ({ value: p.id, label: p.po_no }))} /></Field>
          <Field label="Referensi GR"><Select disabled={!editable} value={form.gr_id ?? ''} onChange={(e: any) => setForm({ ...form, gr_id: e.target.value })} options={grsForPo.map(g => ({ value: g.id, label: g.gr_no }))} /></Field>
          <Field label="Alasan Retur" required className="sm:col-span-2"><Textarea disabled={!editable} value={form.reason ?? ''} onChange={(e: any) => setForm({ ...form, reason: e.target.value })} placeholder="Uraikan alasan retur secara umum…" /></Field>
          <Field label="Catatan" className="sm:col-span-2"><Textarea disabled={!editable} value={form.note ?? ''} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500">Item Retur</h4>
          {editable && <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={addItemRow}>Tambah Baris</Button>}
        </div>
        <div className="border border-ink-200 dark:border-ink-800 rounded-md overflow-hidden mb-3 overflow-x-auto">
          <table className="w-full text-body">
            <thead className="bg-ink-50 dark:bg-surface-darker"><tr className="text-caption uppercase text-ink-500">
              <th className="text-left px-2 py-2">Item</th><th className="text-right px-2 py-2 w-20">Qty</th><th className="text-left px-2 py-2 w-20">Satuan</th>
              <th className="text-right px-2 py-2 w-32">Harga</th><th className="text-right px-2 py-2 w-32">Jumlah</th><th className="text-left px-2 py-2 min-w-[180px]">Alasan Baris</th>
              {editable && <th className="px-2 py-2 w-10" />}
            </tr></thead>
            <tbody>
              {rtvItems.map((r, i) => (
                <tr key={i} className="border-t border-ink-100 dark:border-ink-800">
                  <td className="px-2 py-1.5 min-w-[200px]"><Select disabled={!editable} value={r.item_id} onChange={(e: any) => onPickItem(i, e.target.value)} options={items.map(it => ({ value: it.id, label: `${it.code} — ${it.name}` }))} /></td>
                  <td className="px-2 py-1.5"><Input type="number" disabled={!editable} value={r.qty} onChange={(e: any) => patchItemRow(i, { qty: Number(e.target.value) })} className="text-right" /></td>
                  <td className="px-2 py-1.5"><Input disabled={!editable} value={r.uom} onChange={(e: any) => patchItemRow(i, { uom: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><Money disabled={!editable} value={r.price} onChange={(v: number) => patchItemRow(i, { price: v })} /></td>
                  <td className="px-2 py-1.5 text-right tabular">{rupiah(Number(r.qty) * Number(r.price))}</td>
                  <td className="px-2 py-1.5"><Select disabled={!editable} value={r.reason} onChange={(e: any) => patchItemRow(i, { reason: e.target.value })} options={RTV_REASON_OPTIONS} /></td>
                  {editable && <td className="px-2 py-1.5 text-center"><button onClick={() => removeItemRow(i)} className="text-red-500 hover:text-red-700 text-caption">Hapus</button></td>}
                </tr>
              ))}
              {rtvItems.length === 0 && <tr><td colSpan={7} className="px-2 py-6 text-center text-ink-400">Belum ada item retur.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="ml-auto max-w-xs text-body-l font-semibold flex justify-between border-t border-ink-200 dark:border-ink-800 pt-1.5">
          <span>Total Retur</span><span className="tabular">{rupiah(total)}</span>
        </div>
      </Drawer>
    </div>
  )
}
