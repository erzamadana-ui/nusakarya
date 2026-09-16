import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO, num } from '@/lib/format'
import {
  PageHeader, KpiCard, DataTable, Modal, Drawer, ConfirmDialog, Tabs, Desc, Card,
  Button, Field, Input, Textarea, Select, Money, Badge, useToast, Plus,
} from '@/components/ui'
import { INV_TABS, agingDays, agingTone, agingLabel } from '../lib/shared'

export default function InvoiceVendor() {
  const { profile, can } = useAuth()
  const toast = useToast()

  const [rows, setRows] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [pos, setPos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('semua')

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({})
  const [poItems, setPoItems] = useState<any[]>([])
  const [grList, setGrList] = useState<any[]>([])
  const [grItems, setGrItems] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<any | null>(null)
  const [dTab, setDTab] = useState('ringkasan')
  const [payments, setPayments] = useState<any[]>([])
  const [payForm, setPayForm] = useState<any>({ payment_date: todayISO(), amount: 0, method: 'transfer', bank_ref: '', note: '' })
  const [savingPay, setSavingPay] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await list('vendor_invoices', { order: { col: 'invoice_date', asc: false } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat invoice vendor', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => {
    load()
    ;(async () => {
      try {
        const [v, po] = await Promise.all([
          list('vendors', { order: { col: 'name', asc: true } }),
          list('purchase_orders', { in: { status: ['diterima_sebagian', 'diterima', 'ditutup'] }, order: { col: 'po_date', asc: false } }),
        ])
        setVendors(v); setPos(po)
      } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data referensi', 'error') }
    })()
  }, [load, toast])

  const vendorName = (id: string) => vendors.find(v => v.id === id)?.name ?? '-'
  const poNo = (id: string) => pos.find(p => p.id === id)?.po_no ?? rows.find(r => r.po_id === id)?.po_id ?? '-'
  const filtered = rows.filter(r => tab === 'semua' || r.status === tab)

  const outstanding = rows.filter(r => !['lunas', 'ditolak'].includes(r.status)).reduce((a, r) => a + (Number(r.total) - Number(r.paid_amount)), 0)
  const jatuhTempo = rows.filter(r => !['lunas', 'ditolak'].includes(r.status) && agingDays(r.due_date) > 0)
  const selisihCount = rows.filter(r => r.match_status === 'selisih').length

  function openAdd() {
    setForm({ vendor_id: '', po_id: '', gr_id: '', vendor_invoice_no: '', invoice_date: todayISO(), due_date: '', faktur_pajak_no: '', dpp: 0, ppn_percent: 11, pph23_percent: 0, match_note: '' })
    setPoItems([]); setGrList([]); setGrItems([])
    setModal(true)
  }

  async function onPickVendor(vendorId: string) {
    setForm((f: any) => ({ ...f, vendor_id: vendorId, po_id: '', gr_id: '' })); setPoItems([]); setGrList([]); setGrItems([])
  }
  async function onPickPO(poId: string) {
    const po = pos.find(p => p.id === poId)
    const due = po && form.invoice_date ? addDays(form.invoice_date, po ? (vendors.find(v => v.id === form.vendor_id)?.payment_term_days ?? 30) : 30) : ''
    setForm((f: any) => ({ ...f, po_id: poId, gr_id: '', due_date: due }))
    try {
      const [pi, gr] = await Promise.all([list('po_items', { eq: { po_id: poId } }), list('goods_receipts', { eq: { po_id: poId } })])
      setPoItems(pi); setGrList(gr); setGrItems([])
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat item PO/GR', 'error') }
  }
  async function onPickGR(grId: string) {
    setForm((f: any) => ({ ...f, gr_id: grId }))
    try {
      const gi = await list('gr_items', { eq: { gr_id: grId } })
      setGrItems(gi)
      const value = gi.reduce((a: number, r: any) => a + Number(r.qty_received) * (poItems.find(p => p.id === r.po_item_id)?.price ?? 0), 0)
      setForm((f: any) => ({ ...f, dpp: Math.round(value) }))
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat item GR', 'error') }
  }
  function addDays(dateStr: string, days: number) { const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }

  const poValue = pos.find(p => p.id === form.po_id)?.total ?? 0
  const grValue = useMemo(() => grItems.reduce((a, r) => a + Number(r.qty_received) * (poItems.find(p => p.id === r.po_item_id)?.price ?? 0), 0), [grItems, poItems])
  const ppnAmount = Math.round((form.dpp ?? 0) * ((form.ppn_percent ?? 0) / 100))
  const pph23Amount = Math.round((form.dpp ?? 0) * ((form.pph23_percent ?? 0) / 100))
  const invTotal = (form.dpp ?? 0) + ppnAmount - pph23Amount
  const selisih = invTotal - grValue
  const cocok = Math.abs(selisih) < 1000

  async function save() {
    if (!form.vendor_id || !form.po_id || !form.gr_id || !form.vendor_invoice_no || !form.due_date) { toast.push('Vendor, PO, GR, no. invoice vendor, dan jatuh tempo wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const inv_no = await nextDocNo(profile!.company_id, 'INV')
      await insert('vendor_invoices', {
        inv_no, vendor_invoice_no: form.vendor_invoice_no, invoice_date: form.invoice_date, due_date: form.due_date,
        vendor_id: form.vendor_id, po_id: form.po_id, gr_id: form.gr_id, dpp: form.dpp, ppn: ppnAmount, pph23: pph23Amount,
        total: invTotal, paid_amount: 0, match_status: cocok ? 'cocok' : 'selisih',
        match_note: form.match_note || (cocok ? '' : `Selisih ${rupiah(selisih)} terhadap nilai barang diterima.`),
        status: 'draft', faktur_pajak_no: form.faktur_pajak_no ?? '', file_url: '', company_id: profile!.company_id, created_by: profile!.id,
      })
      toast.push('Invoice vendor tersimpan'); setModal(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan invoice vendor', 'error') }
    finally { setSaving(false) }
  }

  async function openDetail(row: any) {
    setDetail(row); setDTab('ringkasan')
    setPayForm({ payment_date: todayISO(), amount: Number(row.total) - Number(row.paid_amount), method: 'transfer', bank_ref: '', note: '' })
    try { setPayments(await list('ap_payments', { eq: { invoice_id: row.id }, order: { col: 'payment_date', asc: false } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat riwayat pembayaran', 'error') }
  }

  async function setInvStatus(status: string) {
    try { await update('vendor_invoices', detail.id, { status }); setDetail({ ...detail, status }); load(); toast.push('Status invoice diperbarui') }
    catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui status invoice', 'error') }
  }

  async function addPayment() {
    const sisa = Number(detail.total) - Number(detail.paid_amount)
    if (payForm.amount <= 0 || payForm.amount > sisa + 0.5) { toast.push('Jumlah pembayaran tidak valid', 'error'); return }
    setSavingPay(true)
    try {
      const payment_no = await nextDocNo(profile!.company_id, 'AP')
      const created = await insert('ap_payments', { ...payForm, payment_no, vendor_id: detail.vendor_id, invoice_id: detail.id, status: 'selesai', company_id: profile!.company_id, created_by: profile!.id })
      const newPaid = Number(detail.paid_amount) + Number(payForm.amount)
      const newStatus = newPaid >= Number(detail.total) - 0.5 ? 'lunas' : 'dibayar_sebagian'
      await update('vendor_invoices', detail.id, { paid_amount: newPaid, status: newStatus })
      setPayments(v => [created, ...v]); setDetail({ ...detail, paid_amount: newPaid, status: newStatus })
      setPayForm({ payment_date: todayISO(), amount: Number(detail.total) - newPaid, method: 'transfer', bank_ref: '', note: '' })
      toast.push('Pembayaran dicatat'); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mencatat pembayaran', 'error') }
    finally { setSavingPay(false) }
  }

  const columns = [
    { key: 'inv_no', header: 'No. Invoice', width: '150px' },
    { key: 'vendor_id', header: 'Vendor', render: (r: any) => vendorName(r.vendor_id) },
    { key: 'invoice_date', header: 'Tanggal', render: (r: any) => tgl(r.invoice_date) },
    { key: 'due_date', header: 'Jatuh Tempo', render: (r: any) => tgl(r.due_date) },
    { key: 'total', header: 'Total', align: 'right' as const, render: (r: any) => rupiah(r.total) },
    { key: 'sisa', header: 'Sisa Tagihan', align: 'right' as const, render: (r: any) => rupiah(Number(r.total) - Number(r.paid_amount)) },
    {
      key: 'aging', header: 'Umur Hutang', render: (r: any) => {
        if (['lunas', 'ditolak'].includes(r.status)) return <span className="text-ink-400">-</span>
        const d = agingDays(r.due_date); return <span className={agingTone(d)}>{agingLabel(d)}</span>
      },
    },
    { key: 'match_status', header: '3-Way Match', render: (r: any) => <Badge tone={r.match_status === 'cocok' ? 'emerald' : r.match_status === 'selisih' ? 'red' : 'slate'}>{r.match_status}</Badge> },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="Invoice Vendor (3-Way Match)" subtitle="Tagihan vendor dicocokkan otomatis terhadap PO dan Good Receive."
        actions={can('PROCUREMENT', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Input Invoice</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Outstanding" value={rupiah(outstanding, true)} tone="teal" />
        <KpiCard label="Jatuh Tempo / Terlambat" value={num(jatuhTempo.length)} sub={rupiah(jatuhTempo.reduce((a, r) => a + Number(r.total) - Number(r.paid_amount), 0), true)} tone="orange" />
        <KpiCard label="Selisih 3-Way Match" value={num(selisihCount)} tone="red" />
        <KpiCard label="Invoice Tercatat" value={num(rows.length)} />
      </div>

      <Tabs className="mb-4" value={tab} onChange={setTab}
        tabs={INV_TABS.map(t => ({ ...t, count: t.value === 'semua' ? rows.length : rows.filter(r => r.status === t.value).length }))} />

      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={openDetail}
        searchable searchKeys={['inv_no', 'vendor_invoice_no']} exportName="invoice-vendor"
        emptyTitle="Belum ada invoice vendor" emptyMessage="Input invoice setelah barang diterima dari vendor." />

      <Modal open={modal} onClose={() => setModal(false)} size="xl" title="Input Invoice Vendor"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <Field label="Vendor" required><Select value={form.vendor_id ?? ''} onChange={(e: any) => onPickVendor(e.target.value)} options={vendors.map(v => ({ value: v.id, label: v.name }))} /></Field>
          <Field label="Purchase Order" required><Select value={form.po_id ?? ''} onChange={(e: any) => onPickPO(e.target.value)}
            options={pos.filter(p => !form.vendor_id || p.vendor_id === form.vendor_id).map(p => ({ value: p.id, label: p.po_no }))} /></Field>
          <Field label="Good Receive" required><Select value={form.gr_id ?? ''} onChange={(e: any) => onPickGR(e.target.value)} options={grList.map(g => ({ value: g.id, label: `${g.gr_no} — ${g.gr_date}` }))} /></Field>
          <Field label="No. Invoice Vendor" required><Input value={form.vendor_invoice_no ?? ''} onChange={(e: any) => setForm({ ...form, vendor_invoice_no: e.target.value })} /></Field>
          <Field label="Tanggal Invoice"><Input type="date" value={form.invoice_date ?? ''} onChange={(e: any) => setForm({ ...form, invoice_date: e.target.value })} /></Field>
          <Field label="Jatuh Tempo" required><Input type="date" value={form.due_date ?? ''} onChange={(e: any) => setForm({ ...form, due_date: e.target.value })} /></Field>
          <Field label="No. Faktur Pajak" className="sm:col-span-3"><Input value={form.faktur_pajak_no ?? ''} onChange={(e: any) => setForm({ ...form, faktur_pajak_no: e.target.value })} /></Field>
        </div>

        {form.gr_id && (
          <Card className="p-4 mb-4">
            <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500 mb-3">Panel 3-Way Match</h4>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-3 rounded-md bg-ink-50 dark:bg-surface-darker">
                <p className="text-caption text-ink-500">Nilai PO</p><p className="font-display font-bold text-[17px] tabular">{rupiah(poValue)}</p>
              </div>
              <div className="text-center p-3 rounded-md bg-ink-50 dark:bg-surface-darker">
                <p className="text-caption text-ink-500">Nilai Barang Diterima (GR)</p><p className="font-display font-bold text-[17px] tabular">{rupiah(grValue)}</p>
              </div>
              <div className="text-center p-3 rounded-md bg-ink-50 dark:bg-surface-darker">
                <p className="text-caption text-ink-500">Nilai Invoice</p><p className="font-display font-bold text-[17px] tabular">{rupiah(invTotal)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-md border border-ink-200 dark:border-ink-800">
              <span className="text-body">Selisih Invoice vs GR: <b className="tabular">{rupiah(selisih)}</b></span>
              <Badge tone={cocok ? 'emerald' : 'red'}>{cocok ? 'Cocok' : 'Selisih'}</Badge>
            </div>
          </Card>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="DPP"><Money value={form.dpp ?? 0} onChange={(v: number) => setForm({ ...form, dpp: v })} /></Field>
          <Field label="PPN (%)"><Input type="number" value={form.ppn_percent ?? 11} onChange={(e: any) => setForm({ ...form, ppn_percent: Number(e.target.value) })} /></Field>
          <Field label="PPh23 (%)"><Input type="number" value={form.pph23_percent ?? 0} onChange={(e: any) => setForm({ ...form, pph23_percent: Number(e.target.value) })} /></Field>
        </div>
        <div className="mt-3 space-y-1 text-body max-w-xs ml-auto">
          <div className="flex justify-between"><span className="text-ink-500">Nilai PPN</span><span className="tabular">{rupiah(ppnAmount)}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">Potongan PPh23</span><span className="tabular">-{rupiah(pph23Amount)}</span></div>
          <div className="flex justify-between text-body-l font-semibold border-t border-ink-200 dark:border-ink-800 pt-1.5"><span>Total Tagihan</span><span className="tabular">{rupiah(invTotal)}</span></div>
        </div>
        <Field label="Catatan Kecocokan (opsional)" className="mt-4"><Textarea value={form.match_note ?? ''} onChange={(e: any) => setForm({ ...form, match_note: e.target.value })} placeholder="Diisi otomatis jika terjadi selisih, dapat ditambahkan penjelasan." /></Field>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} width="max-w-2xl" title={detail?.inv_no}
        footer={<div className="flex flex-wrap justify-end gap-2 w-full">
          {detail?.status === 'draft' && can('PROCUREMENT', 'write') && <Button onClick={() => setInvStatus('diajukan')}>Ajukan</Button>}
          {detail?.status === 'diajukan' && can('PROCUREMENT', 'approve') && (<>
            <Button variant="danger" onClick={() => setConfirmReject(true)}>Tolak</Button>
            <Button variant="success" onClick={() => setInvStatus('diverifikasi')}>Verifikasi</Button></>)}
          {detail?.status === 'diverifikasi' && can('PROCUREMENT', 'approve') && <Button variant="success" onClick={() => setInvStatus('disetujui')}>Setujui</Button>}
        </div>}>
        {detail && (<>
          <div className="flex items-center gap-2 mb-3">
            <Badge>{detail.status}</Badge><Badge tone={detail.match_status === 'cocok' ? 'emerald' : detail.match_status === 'selisih' ? 'red' : 'slate'}>{detail.match_status}</Badge>
            {!['lunas', 'ditolak'].includes(detail.status) && <span className={agingTone(agingDays(detail.due_date))}>{agingLabel(agingDays(detail.due_date))}</span>}
          </div>
          <Tabs className="mb-4" value={dTab} onChange={setDTab} tabs={[{ value: 'ringkasan', label: 'Ringkasan' }, { value: 'pembayaran', label: 'Riwayat Pembayaran', count: payments.length }]} />
          {dTab === 'ringkasan' && (
            <Desc cols={2} items={[
              { label: 'Vendor', value: vendorName(detail.vendor_id) }, { label: 'No. Invoice Vendor', value: detail.vendor_invoice_no },
              { label: 'No. PO', value: poNo(detail.po_id) }, { label: 'No. Faktur Pajak', value: detail.faktur_pajak_no || '-' },
              { label: 'Tanggal Invoice', value: tgl(detail.invoice_date) }, { label: 'Jatuh Tempo', value: tgl(detail.due_date) },
              { label: 'DPP', value: rupiah(detail.dpp) }, { label: 'PPN', value: rupiah(detail.ppn) },
              { label: 'PPh23', value: `-${rupiah(detail.pph23)}` }, { label: 'Total Tagihan', value: rupiah(detail.total) },
              { label: 'Sudah Dibayar', value: rupiah(detail.paid_amount) }, { label: 'Sisa Tagihan', value: rupiah(Number(detail.total) - Number(detail.paid_amount)) },
              { label: 'Catatan Kecocokan', value: detail.match_note || '-' },
            ]} />
          )}
          {dTab === 'pembayaran' && (<>
            {can('PROCUREMENT', 'write') && ['disetujui', 'dibayar_sebagian'].includes(detail.status) && (
              <Card className="p-4 mb-4">
                <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500 mb-3">Catat Pembayaran</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Tanggal Bayar"><Input type="date" value={payForm.payment_date} onChange={(e: any) => setPayForm({ ...payForm, payment_date: e.target.value })} /></Field>
                  <Field label="Jumlah"><Money value={payForm.amount} onChange={(v: number) => setPayForm({ ...payForm, amount: v })} /></Field>
                  <Field label="Metode"><Select value={payForm.method} onChange={(e: any) => setPayForm({ ...payForm, method: e.target.value })} options={[{ value: 'transfer', label: 'Transfer Bank' }, { value: 'cek', label: 'Cek/Giro' }, { value: 'tunai', label: 'Tunai' }]} /></Field>
                  <Field label="No. Referensi Bank"><Input value={payForm.bank_ref} onChange={(e: any) => setPayForm({ ...payForm, bank_ref: e.target.value })} /></Field>
                </div>
                <div className="flex justify-end mt-3"><Button loading={savingPay} onClick={addPayment}>Simpan Pembayaran</Button></div>
              </Card>
            )}
            <DataTable searchable={false} rows={payments}
              columns={[{ key: 'payment_no', header: 'No. Bukti Bayar' }, { key: 'payment_date', header: 'Tanggal', render: (r: any) => tgl(r.payment_date) },
                { key: 'amount', header: 'Jumlah', align: 'right', render: (r: any) => rupiah(r.amount) }, { key: 'method', header: 'Metode' }]}
              emptyTitle="Belum ada pembayaran" />
          </>)}
        </>)}
      </Drawer>

      <ConfirmDialog open={confirmReject} onClose={() => setConfirmReject(false)} danger title="Tolak Invoice Vendor"
        confirmLabel="Tolak Invoice" message="Invoice akan ditandai ditolak dan tidak dapat diproses pembayarannya."
        onConfirm={async () => { await setInvStatus('ditolak'); setConfirmReject(false) }} />
    </div>
  )
}
