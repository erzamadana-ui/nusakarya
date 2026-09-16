import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO, num } from '@/lib/format'
import {
  PageHeader, FilterBar, KpiCard, DataTable, Modal, Button, Field, Input, Textarea, Select,
  Money, Badge, useToast, Plus, EmptyState,
} from '@/components/ui'
import { RFQ_STATUS } from '../lib/shared'

export default function RFQ() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [rows, setRows] = useState<any[]>([])
  const [prs, setPrs] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fStatus, setFStatus] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<any | null>(null)
  const [quotes, setQuotes] = useState<any[]>([])
  const [quoteForm, setQuoteForm] = useState<any>({ vendor_id: '', quote_no: '', quote_date: todayISO(), total_amount: 0, delivery_days: 0, payment_term: '', note: '' })
  const [savingQuote, setSavingQuote] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await list('rfqs', { order: { col: 'issue_date', asc: false } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat data RFQ', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => {
    load()
    ;(async () => {
      try {
        const [pr, v] = await Promise.all([
          list('purchase_requests', { in: { status: ['disetujui', 'sebagian_po'] }, order: { col: 'pr_no', asc: false } }),
          list('vendors', { eq: { status: 'aktif' }, order: { col: 'name', asc: true } }),
        ])
        setPrs(pr); setVendors(v)
      } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data referensi', 'error') }
    })()
  }, [load, toast])

  const filtered = rows.filter(r => !fStatus || r.status === fStatus)
  const prNo = (id: string) => prs.find(p => p.id === id)?.pr_no ?? rows.find(r => r.pr_id === id)?.pr_no ?? '-'

  function openAdd() { setAddForm({ pr_id: '', issue_date: todayISO(), due_date: '' }); setAddOpen(true) }
  async function saveAdd() {
    if (!addForm.pr_id || !addForm.due_date) { toast.push('PR dan batas waktu penawaran wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const rfq_no = await nextDocNo(profile!.company_id, 'RFQ')
      await insert('rfqs', { rfq_no, pr_id: addForm.pr_id, issue_date: addForm.issue_date, due_date: addForm.due_date, status: 'draft', company_id: profile!.company_id, created_by: profile!.id })
      toast.push('RFQ dibuat'); setAddOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal membuat RFQ', 'error') }
    finally { setSaving(false) }
  }

  async function openDetail(row: any) {
    setDetail(row)
    setQuoteForm({ vendor_id: '', quote_no: '', quote_date: todayISO(), total_amount: 0, delivery_days: 0, payment_term: '', note: '' })
    try { setQuotes(await list('rfq_quotes', { eq: { rfq_id: row.id }, order: { col: 'total_amount', asc: true } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat penawaran', 'error') }
  }

  async function changeStatus(status: string) {
    try { await update('rfqs', detail.id, { status }); setDetail({ ...detail, status }); load(); toast.push('Status RFQ diperbarui') }
    catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui status RFQ', 'error') }
  }

  async function addQuote() {
    if (!quoteForm.vendor_id || !quoteForm.quote_no) { toast.push('Vendor dan nomor penawaran wajib diisi', 'error'); return }
    setSavingQuote(true)
    try {
      const created = await insert('rfq_quotes', { ...quoteForm, rfq_id: detail.id, is_selected: false, file_url: '', company_id: profile!.company_id, created_by: profile!.id })
      setQuotes(v => [...v, created])
      setQuoteForm({ vendor_id: '', quote_no: '', quote_date: todayISO(), total_amount: 0, delivery_days: 0, payment_term: '', note: '' })
      toast.push('Penawaran ditambahkan')
    } catch (e: any) { toast.push(e.message ?? 'Gagal menambahkan penawaran', 'error') }
    finally { setSavingQuote(false) }
  }

  async function pilihPemenang(q: any) {
    try {
      await Promise.all(quotes.filter(x => x.is_selected && x.id !== q.id).map(x => update('rfq_quotes', x.id, { is_selected: false })))
      await update('rfq_quotes', q.id, { is_selected: true })
      setQuotes(v => v.map(x => ({ ...x, is_selected: x.id === q.id })))
      toast.push(`${vendors.find(v => v.id === q.vendor_id)?.name ?? 'Vendor'} ditetapkan sebagai pemenang RFQ`)
    } catch (e: any) { toast.push(e.message ?? 'Gagal menetapkan pemenang', 'error') }
  }

  function buatPO() {
    const winner = quotes.find(q => q.is_selected)
    navigate('/procurement/po', { state: { fromPrId: detail.pr_id, fromRfqId: detail.id, fromVendorId: winner?.vendor_id } })
  }

  const columns = [
    { key: 'rfq_no', header: 'No. RFQ', width: '150px' },
    { key: 'pr_id', header: 'No. PR', render: (r: any) => prNo(r.pr_id) },
    { key: 'issue_date', header: 'Tanggal Terbit', render: (r: any) => tgl(r.issue_date) },
    { key: 'due_date', header: 'Batas Penawaran', render: (r: any) => tgl(r.due_date) },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="RFQ & Penawaran" subtitle="Permintaan dan perbandingan penawaran harga dari vendor."
        actions={can('PROCUREMENT', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Buat RFQ</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total RFQ" value={num(rows.length)} />
        <KpiCard label="Sedang Dikirim" value={num(rows.filter(r => r.status === 'dikirim').length)} tone="amber" />
        <KpiCard label="Ditutup (Pemenang Dipilih)" value={num(rows.filter(r => r.status === 'ditutup').length)} tone="teal" />
        <KpiCard label="Draft" value={num(rows.filter(r => r.status === 'draft').length)} />
      </div>

      <FilterBar><Field label="Status" className="w-52"><Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={RFQ_STATUS} /></Field></FilterBar>

      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={openDetail}
        searchable searchKeys={['rfq_no']} exportName="rfq" emptyTitle="Belum ada RFQ" emptyMessage="Buat RFQ dari PR yang telah disetujui." />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Buat RFQ" size="md"
        footer={<><Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button><Button loading={saving} onClick={saveAdd}>Simpan</Button></>}>
        <div className="grid gap-4">
          <Field label="Purchase Request" required><Select value={addForm.pr_id ?? ''} onChange={(e: any) => setAddForm({ ...addForm, pr_id: e.target.value })}
            options={prs.map(p => ({ value: p.id, label: `${p.pr_no} — ${p.purpose}` }))} /></Field>
          <Field label="Tanggal Terbit"><Input type="date" value={addForm.issue_date ?? ''} onChange={(e: any) => setAddForm({ ...addForm, issue_date: e.target.value })} /></Field>
          <Field label="Batas Waktu Penawaran" required><Input type="date" value={addForm.due_date ?? ''} onChange={(e: any) => setAddForm({ ...addForm, due_date: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} size="xl" title={detail?.rfq_no}
        subtitle={detail ? `PR ${prNo(detail.pr_id)} · Batas penawaran ${tgl(detail.due_date)}` : ''}>
        {detail && (<div>
          <div className="flex items-center gap-3 mb-4">
            <Badge>{detail.status}</Badge>
            {can('PROCUREMENT', 'write') && (
              <Select className="w-52" value={detail.status} onChange={(e: any) => changeStatus(e.target.value)} options={RFQ_STATUS} />
            )}
            {quotes.some(q => q.is_selected) && can('PROCUREMENT', 'write') && <Button size="sm" onClick={buatPO}>Buat PO dari Pemenang</Button>}
          </div>

          <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500 mb-2">Perbandingan Penawaran</h4>
          {quotes.length === 0 ? <EmptyState title="Belum ada penawaran" message="Tambahkan penawaran vendor di bawah." /> : (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-body">
                <thead className="bg-ink-50 dark:bg-surface-darker"><tr className="text-caption uppercase text-ink-500">
                  <th className="text-left px-2 py-2">Vendor</th><th className="text-left px-2 py-2">No. Penawaran</th>
                  <th className="text-right px-2 py-2">Total</th><th className="text-right px-2 py-2">Hari Kirim</th>
                  <th className="text-left px-2 py-2">Termin</th><th className="text-center px-2 py-2">Pemenang</th><th className="px-2 py-2" />
                </tr></thead>
                <tbody>
                  {quotes.map(q => (
                    <tr key={q.id} className={q.is_selected ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : 'border-t border-ink-100 dark:border-ink-800'}>
                      <td className="px-2 py-2">{vendors.find(v => v.id === q.vendor_id)?.name ?? '-'}</td>
                      <td className="px-2 py-2">{q.quote_no}</td>
                      <td className="px-2 py-2 text-right tabular">{rupiah(q.total_amount)}</td>
                      <td className="px-2 py-2 text-right tabular">{q.delivery_days} hari</td>
                      <td className="px-2 py-2">{q.payment_term}</td>
                      <td className="px-2 py-2 text-center">{q.is_selected && <Badge tone="emerald">Pemenang</Badge>}</td>
                      <td className="px-2 py-2 text-right">{can('PROCUREMENT', 'approve') && !q.is_selected && <Button size="sm" variant="outline" onClick={() => pilihPemenang(q)}>Pilih Pemenang</Button>}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          )}

          {can('PROCUREMENT', 'write') && (
            <div className="border-t border-ink-200 dark:border-ink-800 pt-4">
              <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500 mb-2">Tambah Penawaran</h4>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Vendor" required><Select value={quoteForm.vendor_id} onChange={(e: any) => setQuoteForm({ ...quoteForm, vendor_id: e.target.value })} options={vendors.map(v => ({ value: v.id, label: v.name }))} /></Field>
                <Field label="No. Penawaran" required><Input value={quoteForm.quote_no} onChange={(e: any) => setQuoteForm({ ...quoteForm, quote_no: e.target.value })} /></Field>
                <Field label="Tanggal Penawaran"><Input type="date" value={quoteForm.quote_date} onChange={(e: any) => setQuoteForm({ ...quoteForm, quote_date: e.target.value })} /></Field>
                <Field label="Total Penawaran"><Money value={quoteForm.total_amount} onChange={(v: number) => setQuoteForm({ ...quoteForm, total_amount: v })} /></Field>
                <Field label="Estimasi Hari Kirim"><Input type="number" value={quoteForm.delivery_days} onChange={(e: any) => setQuoteForm({ ...quoteForm, delivery_days: Number(e.target.value) })} /></Field>
                <Field label="Termin Pembayaran"><Input value={quoteForm.payment_term} onChange={(e: any) => setQuoteForm({ ...quoteForm, payment_term: e.target.value })} placeholder="mis. 30 hari setelah invoice" /></Field>
                <Field label="Catatan" className="sm:col-span-3"><Textarea value={quoteForm.note} onChange={(e: any) => setQuoteForm({ ...quoteForm, note: e.target.value })} /></Field>
              </div>
              <div className="flex justify-end mt-3"><Button loading={savingQuote} onClick={addQuote}>Simpan Penawaran</Button></div>
            </div>
          )}
        </div>)}
      </Modal>
    </div>
  )
}
