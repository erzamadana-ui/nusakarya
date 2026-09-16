import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO } from '@/lib/format'
import {
  PageHeader, Card, DataTable, Modal, Drawer, ConfirmDialog, Field, Input, Select, Money,
  Badge, Button, Tabs, useToast, TableSkeleton, EmptyState, Section, Desc, Plus, cx,
} from '@/components/ui'
import { PPN_RATE, PPH23_RATE, TAX_NOTE, PAYMENT_METHOD_OPTIONS } from '../lib/constants'
import { agingDays, agingTone, agingLabel, isArActive } from '../lib/helpers'

const emptyForm = { claim_id: '', invoice_date: todayISO(), due_date: '', dpp: 0, ppn: 0, pph23: 0, faktur_pajak_no: '' }
const TAB_LIST = [{ value: 'semua', label: 'Semua' }, { value: 'belum_bayar', label: 'Belum Bayar' }, { value: 'jatuh_tempo', label: 'Jatuh Tempo' }, { value: 'lunas', label: 'Lunas' }]

export default function Invoice() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [claims, setClaims] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('semua')

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [payLoading, setPayLoading] = useState(false)
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('Transfer Bank')
  const [payRef, setPayRef] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payDate, setPayDate] = useState(todayISO())
  const [payBusy, setPayBusy] = useState(false)
  const [delId, setDelId] = useState<string | null>(null)

  const contractMap = useMemo(() => Object.fromEntries(contracts.map(c => [c.id, c])), [contracts])
  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c])), [customers])
  const invoicedClaimIds = useMemo(() => new Set(rows.map(r => r.claim_id).filter(Boolean)), [rows])
  const availableClaims = useMemo(() => claims.filter(c => !invoicedClaimIds.has(c.id)), [claims, invoicedClaimIds])

  const load = async () => {
    setLoading(true)
    try {
      const [inv, cl, ct, cu] = await Promise.all([
        list('ar_invoices', { order: { col: 'created_at', asc: false }, limit: 1000 }),
        list('progress_claims', { eq: { status: 'disetujui' }, order: { col: 'claim_no', asc: true }, limit: 500 }),
        list('contracts', { select: 'id,contract_name,customer_id', limit: 500 }),
        list('customers', { select: 'id,name,payment_term_days', limit: 500 }),
      ])
      setRows(inv); setClaims(cl); setContracts(ct); setCustomers(cu)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data invoice', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const displayStatus = (r: any) => {
    if (r.status === 'lunas' || r.status === 'batal') return r.status
    return agingDays(r.due_date) > 0 ? 'overdue' : r.status
  }

  const filtered = useMemo(() => rows.filter(r => {
    if (tab === 'semua') return true
    if (tab === 'lunas') return r.status === 'lunas'
    if (tab === 'jatuh_tempo') return isArActive(r.status) && agingDays(r.due_date) > 0
    if (tab === 'belum_bayar') return isArActive(r.status) && agingDays(r.due_date) <= 0
    return true
  }), [rows, tab])

  const openAdd = () => { setForm(emptyForm); setModal(true) }

  const onClaimChange = (claimId: string) => {
    const claim = claims.find(c => c.id === claimId)
    if (!claim) { setForm({ ...emptyForm, claim_id: claimId }); return }
    const contract = contractMap[claim.contract_id]
    const customer = contract ? customerMap[contract.customer_id] : null
    const dpp = Math.max(0, Number(claim.claim_amount ?? 0) - Number(claim.retention_amount ?? 0))
    const ppn = Math.round(dpp * PPN_RATE)
    const pph23 = Math.round(dpp * PPH23_RATE)
    const invDate = todayISO()
    const termDays = Number(customer?.payment_term_days ?? 30)
    const due = new Date(); due.setDate(due.getDate() + termDays)
    setForm({ claim_id: claimId, invoice_date: invDate, due_date: due.toISOString().slice(0, 10), dpp, ppn, pph23, faktur_pajak_no: '' })
  }

  const total = Number(form.dpp || 0) + Number(form.ppn || 0) - Number(form.pph23 || 0)

  const save = async () => {
    if (!form.claim_id) { toast.push('Pilih klaim yang sudah disetujui', 'error'); return }
    const claim = claims.find(c => c.id === form.claim_id)
    const contract = claim ? contractMap[claim.contract_id] : null
    if (!contract) { toast.push('Kontrak pada klaim tidak ditemukan', 'error'); return }
    setSaving(true)
    try {
      const invNo = await nextDocNo(profile!.company_id, 'INV')
      await insert('ar_invoices', {
        company_id: profile!.company_id, inv_no: invNo, invoice_date: form.invoice_date || todayISO(),
        due_date: form.due_date || null, customer_id: contract.customer_id, contract_id: contract.id,
        spk_id: claim.spk_id, claim_id: claim.id, dpp: Number(form.dpp) || 0, ppn: Number(form.ppn) || 0,
        pph23: Number(form.pph23) || 0, total, paid_amount: 0, status: 'draft', faktur_pajak_no: form.faktur_pajak_no,
      })
      toast.push('Invoice ditambahkan', 'success')
      setModal(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan invoice', 'error') }
    finally { setSaving(false) }
  }

  const openDetail = async (row: any) => {
    setDetail(row); setPayLoading(true); setPayAmount(Math.max(0, Number(row.total) - Number(row.paid_amount)))
    try { setPayments(await list('ar_payments', { eq: { invoice_id: row.id }, order: { col: 'payment_date', asc: false } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat riwayat pembayaran', 'error') }
    finally { setPayLoading(false) }
  }

  const submitPayment = async () => {
    if (!detail) return
    if (!payAmount || payAmount <= 0) { toast.push('Jumlah pembayaran wajib diisi', 'error'); return }
    setPayBusy(true)
    try {
      const payNo = await nextDocNo(profile!.company_id, 'PAY')
      await insert('ar_payments', {
        company_id: profile!.company_id, payment_no: payNo, payment_date: payDate || todayISO(),
        customer_id: detail.customer_id, invoice_id: detail.id, amount: payAmount, method: payMethod,
        bank_ref: payRef, note: payNote,
      })
      const newPaid = Number(detail.paid_amount ?? 0) + payAmount
      const newStatus = newPaid >= Number(detail.total) ? 'lunas' : newPaid > 0 ? 'dibayar_sebagian' : detail.status
      await update('ar_invoices', detail.id, { paid_amount: newPaid, status: newStatus })
      toast.push('Pembayaran tercatat', 'success')
      setDetail({ ...detail, paid_amount: newPaid, status: newStatus })
      setPayAmount(Math.max(0, Number(detail.total) - newPaid)); setPayRef(''); setPayNote('')
      const pays = await list('ar_payments', { eq: { invoice_id: detail.id }, order: { col: 'payment_date', asc: false } })
      setPayments(pays); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mencatat pembayaran', 'error') }
    finally { setPayBusy(false) }
  }

  const doDelete = async () => {
    if (!delId) return
    try { await remove('ar_invoices', delId); toast.push('Invoice dihapus', 'success'); load() }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus invoice', 'error') }
  }

  const columns = [
    { key: 'inv_no', header: 'No Invoice', width: '140px' },
    { key: 'invoice_date', header: 'Tanggal', render: (r: any) => tgl(r.invoice_date) },
    { key: 'customer_id', header: 'Pelanggan', render: (r: any) => customerMap[r.customer_id]?.name ?? '-' },
    { key: 'total', header: 'Total Tagihan', align: 'right' as const, render: (r: any) => rupiah(r.total) },
    { key: 'paid_amount', header: 'Terbayar', align: 'right' as const, render: (r: any) => rupiah(r.paid_amount) },
    { key: 'sisa', header: 'Sisa', align: 'right' as const, sortable: false, render: (r: any) => rupiah(Math.max(0, Number(r.total) - Number(r.paid_amount))) },
    {
      key: 'umur', header: 'Umur Piutang', sortable: false,
      render: (r: any) => { const d = agingDays(r.due_date); return isArActive(r.status) ? <span className={cx('font-medium', agingTone(d))}>{agingLabel(d)}</span> : <span className="text-ink-400">-</span> },
    },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{displayStatus(r)}</Badge> },
    can('COMMERCE', 'approve') ? {
      key: 'aksi', header: '', width: '80px', sortable: false,
      render: (r: any) => <div onClick={e => e.stopPropagation()}><Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelId(r.id)}>Hapus</Button></div>,
    } : null,
  ].filter(Boolean) as any

  return (
    <div>
      <PageHeader title="Invoice Pelanggan (AR)" subtitle="Penagihan piutang pelanggan dari klaim progres yang telah disetujui."
        actions={can('COMMERCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Invoice</Button>} />

      <Tabs tabs={TAB_LIST} value={tab} onChange={setTab} className="mb-4" />

      {loading ? <Card><TableSkeleton /></Card> : (
        <DataTable columns={columns} rows={filtered} searchable searchKeys={['inv_no']} exportName="invoice-ar"
          onRowClick={openDetail} emptyTitle="Belum ada invoice" emptyMessage="Buat invoice dari klaim progres yang telah disetujui."
          emptyAction={can('COMMERCE', 'write') && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah Invoice</Button>} />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Tambah Invoice" size="lg"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan Invoice</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Klaim Disetujui" required className="sm:col-span-2">
            <Select value={form.claim_id} options={availableClaims.map(c => ({ value: c.id, label: `${c.claim_no} — ${contractMap[c.contract_id]?.contract_name ?? ''}` }))} onChange={(e: any) => onClaimChange(e.target.value)} />
          </Field>
          <Field label="Tanggal Invoice"><Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} /></Field>
          <Field label="Jatuh Tempo"><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></Field>
          <Field label="DPP (Nilai Dasar Pengenaan Pajak)"><Money value={form.dpp} onChange={(v: number) => setForm({ ...form, dpp: v })} /></Field>
          <Field label="No Faktur Pajak"><Input value={form.faktur_pajak_no} onChange={e => setForm({ ...form, faktur_pajak_no: e.target.value })} /></Field>
          <Field label="PPN (11%)"><Money value={form.ppn} onChange={(v: number) => setForm({ ...form, ppn: v })} /></Field>
          <Field label="PPh 23 (2%)"><Money value={form.pph23} onChange={(v: number) => setForm({ ...form, pph23: v })} /></Field>
        </div>
        <Card className="p-4 mt-4"><Desc cols={1} items={[{ label: 'Total Tagihan (DPP + PPN − PPh 23)', value: <span className="text-[18px] font-semibold text-primary-600">{rupiah(total)}</span> }]} /></Card>
        <p className="text-caption text-ink-400 mt-2">{TAX_NOTE}</p>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.inv_no} width="max-w-2xl">
        {detail && (
          <>
            <div className="mb-4 flex items-center gap-2"><Badge>{displayStatus(detail)}</Badge>
              {isArActive(detail.status) && <span className={cx('text-caption font-medium', agingTone(agingDays(detail.due_date)))}>{agingLabel(agingDays(detail.due_date))}</span>}
            </div>
            <Section title="Ringkasan">
              <Desc items={[
                { label: 'Pelanggan', value: customerMap[detail.customer_id]?.name },
                { label: 'Tanggal Invoice', value: tgl(detail.invoice_date) },
                { label: 'Jatuh Tempo', value: tgl(detail.due_date) },
                { label: 'DPP', value: rupiah(detail.dpp) },
                { label: 'PPN', value: rupiah(detail.ppn) },
                { label: 'PPh 23', value: rupiah(detail.pph23) },
                { label: 'Total Tagihan', value: rupiah(detail.total) },
                { label: 'Terbayar', value: rupiah(detail.paid_amount) },
                { label: 'Sisa Tagihan', value: rupiah(Math.max(0, Number(detail.total) - Number(detail.paid_amount))) },
                { label: 'No Faktur Pajak', value: detail.faktur_pajak_no },
              ]} />
            </Section>
            <Section title="Riwayat Pembayaran">
              {payLoading ? <TableSkeleton rows={2} /> : payments.length === 0 ? <EmptyState title="Belum ada pembayaran" /> : (
                <div className="space-y-2 mb-4">{payments.map((p: any) => (
                  <Card key={p.id} className="p-3 flex items-center justify-between gap-3">
                    <div><p className="text-body">{p.payment_no}</p><p className="text-caption text-ink-500">{tgl(p.payment_date)} · {p.method}{p.bank_ref ? ` · ${p.bank_ref}` : ''}</p></div>
                    <p className="text-body tabular font-medium">{rupiah(p.amount)}</p>
                  </Card>))}</div>)}
              {can('COMMERCE', 'write') && detail.status !== 'lunas' && detail.status !== 'batal' && (
                <Card className="p-4">
                  <p className="text-caption font-semibold text-ink-500 uppercase tracking-wide mb-3">Catat Pembayaran Masuk</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Jumlah"><Money value={payAmount} onChange={setPayAmount} /></Field>
                    <Field label="Tanggal"><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></Field>
                    <Field label="Metode"><Select value={payMethod} options={PAYMENT_METHOD_OPTIONS} onChange={(e: any) => setPayMethod(e.target.value)} /></Field>
                    <Field label="Referensi Bank"><Input value={payRef} onChange={e => setPayRef(e.target.value)} /></Field>
                    <Field label="Catatan" className="col-span-2"><Input value={payNote} onChange={e => setPayNote(e.target.value)} /></Field>
                  </div>
                  <Button className="mt-3" loading={payBusy} onClick={submitPayment}>Simpan Pembayaran</Button>
                </Card>)}
            </Section>
          </>)}
      </Drawer>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
        title="Hapus Invoice" message="Invoice akan dihapus permanen. Lanjutkan?" confirmLabel="Ya, Hapus" />
    </div>
  )
}
