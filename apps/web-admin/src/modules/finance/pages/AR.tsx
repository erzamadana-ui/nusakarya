import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO } from '@/lib/format'
import {
  PageHeader, Tabs, DataTable, Badge, Drawer, Modal, Field, Input, Select, Money, Button,
  useToast, EmptyState, Section, Desc,
} from '@/components/ui'
import { sisaTagihan, umurLabel, daysSince, rekomendasiTindakLanjut } from '../lib/helpers'

const rp = (v: any) => rupiah(Number(v) || 0)

function tabOf(inv: any): 'belum_kirim' | 'menunggu' | 'jatuh_tempo' | 'lunas' | 'batal' {
  if (inv.status === 'batal') return 'batal'
  if (inv.status === 'lunas') return 'lunas'
  if (['draft', 'diajukan'].includes(inv.status)) return 'belum_kirim'
  const sisa = sisaTagihan(inv.total, inv.paid_amount)
  const u = umurLabel(inv.due_date)
  if (sisa > 0 && u.days != null && u.days > 0) return 'jatuh_tempo'
  return 'menunggu'
}

export default function AR() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [tab, setTab] = useState<'belum_kirim' | 'menunggu' | 'jatuh_tempo' | 'lunas' | 'batal'>('jatuh_tempo')
  const [detail, setDetail] = useState<any | null>(null)
  const [detailPayments, setDetailPayments] = useState<any[]>([])
  const [payOpen, setPayOpen] = useState(false)
  const [payForm, setPayForm] = useState<any>({ payment_date: todayISO(), amount: 0, method: 'Transfer Bank', bank_ref: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

  async function load() {
    setLoading(true)
    try {
      const data = await list('ar_invoices', {
        select: 'id,inv_no,invoice_date,due_date,total,paid_amount,status,faktur_pajak_no,customer_id,customer:customers(id,name,pic_name,phone,email)',
        eq: { company_id: profile!.company_id }, order: { col: 'invoice_date', asc: false }, limit: 2000,
      })
      setRows(data)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat invoice pelanggan', 'error') } finally { setLoading(false) }
  }

  const withTab = useMemo(() => rows.map(r => ({
    ...r, _tab: tabOf(r), _sisa: sisaTagihan(r.total, r.paid_amount), _umur: umurLabel(r.due_date),
    _tindakLanjut: rekomendasiTindakLanjut(daysSince(r.due_date)),
  })), [rows])
  const counts = useMemo(() => ({
    belum_kirim: withTab.filter(r => r._tab === 'belum_kirim').length,
    menunggu: withTab.filter(r => r._tab === 'menunggu').length,
    jatuh_tempo: withTab.filter(r => r._tab === 'jatuh_tempo').length,
    lunas: withTab.filter(r => r._tab === 'lunas').length,
    batal: withTab.filter(r => r._tab === 'batal').length,
  }), [withTab])
  const view = useMemo(() => withTab.filter(r => r._tab === tab), [withTab, tab])

  async function openDetail(row: any) {
    setDetail(row)
    setPayForm({ payment_date: todayISO(), amount: sisaTagihan(row.total, row.paid_amount), method: 'Transfer Bank', bank_ref: '' })
    try {
      const pays = await list('ar_payments', { eq: { invoice_id: row.id }, order: { col: 'payment_date', asc: false }, limit: 100 })
      setDetailPayments(pays)
    } catch { setDetailPayments([]) }
  }

  async function catatPembayaran() {
    if (!detail) return
    const amount = Number(payForm.amount) || 0
    if (amount <= 0) { toast.push('Jumlah pembayaran harus lebih dari 0.', 'error'); return }
    setBusy(true)
    try {
      const paymentNo = await nextDocNo(profile!.company_id, 'RCV')
      const payment = await insert('ar_payments', {
        company_id: profile!.company_id, payment_no: paymentNo, payment_date: payForm.payment_date,
        customer_id: detail.customer_id, invoice_id: detail.id, amount, method: payForm.method, bank_ref: payForm.bank_ref || null,
      })
      const newPaid = Number(detail.paid_amount || 0) + amount
      const newStatus = newPaid >= Number(detail.total || 0) ? 'lunas' : 'dibayar_sebagian'
      await update('ar_invoices', detail.id, { paid_amount: newPaid, status: newStatus })
      try {
        await insert('cash_flows', {
          company_id: profile!.company_id, flow_date: payForm.payment_date, direction: 'in',
          category: 'Penerimaan Piutang (AR)', description: `${detail.inv_no} — ${detail.customer?.name ?? ''}`,
          amount, ref_type: 'ar_payments', ref_id: payment.id,
        })
      } catch { /* pencatatan kas gagal tidak membatalkan pembayaran yang sudah tercatat */ }
      toast.push('Pembayaran berhasil dicatat.', 'success')
      setPayOpen(false); setDetail(null); await load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mencatat pembayaran', 'error') } finally { setBusy(false) }
  }

  const tabs = [
    { value: 'belum_kirim', label: 'Belum Dikirim', count: counts.belum_kirim },
    { value: 'menunggu', label: 'Menunggu Pembayaran', count: counts.menunggu },
    { value: 'jatuh_tempo', label: 'Jatuh Tempo', count: counts.jatuh_tempo },
    { value: 'lunas', label: 'Lunas', count: counts.lunas },
    { value: 'batal', label: 'Dibatalkan', count: counts.batal },
  ]

  return (
    <div>
      <PageHeader title="Piutang Pelanggan (AR)" subtitle="Pantau umur piutang, tindak lanjuti penagihan, dan catat pembayaran masuk." />

      <Tabs tabs={tabs} value={tab} onChange={(v: any) => setTab(v)} className="mb-4" />

      <DataTable
        loading={loading}
        rows={view}
        rowKey="id"
        onRowClick={openDetail}
        searchKeys={['inv_no']}
        exportName={`ar-invoices-${tab}`}
        emptyTitle="Tidak ada invoice"
        emptyMessage="Belum ada data pada tab ini."
        columns={[
          { key: 'inv_no', header: 'No Invoice' },
          { key: 'customer', header: 'Pelanggan', render: (r) => r.customer?.name ?? '-' },
          { key: 'invoice_date', header: 'Tanggal', render: (r) => tgl(r.invoice_date) },
          { key: 'due_date', header: 'Jatuh Tempo', render: (r) => tgl(r.due_date) },
          { key: 'total', header: 'Total', align: 'right', render: (r) => rp(r.total) },
          { key: 'paid_amount', header: 'Sudah Dibayar', align: 'right', render: (r) => rp(r.paid_amount) },
          { key: '_sisa', header: 'Sisa', align: 'right', render: (r) => <span className="font-medium">{rp(r._sisa)}</span> },
          { key: '_umur', header: 'Umur Piutang', render: (r) => <Badge tone={r._umur.tone}>{r._umur.label}</Badge> },
          { key: '_tindakLanjut', header: 'Rekomendasi Tindak Lanjut' },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
      />
      <p className="text-caption text-ink-400 mt-2">Kolom "Rekomendasi Tindak Lanjut" adalah panduan otomatis berdasarkan umur piutang (bukan catatan tersimpan). Ditarik: {tgl(todayISO())}.</p>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.inv_no} width="max-w-2xl"
        footer={detail && detail.status !== 'lunas' && detail.status !== 'batal' && can('FINANCE', 'write') && (
          <Button onClick={() => setPayOpen(true)}>Catat Pembayaran</Button>
        )}>
        {detail && (() => {
          const umur = umurLabel(detail.due_date)
          return (
            <>
              <Section title="Ringkasan">
                <Desc cols={2} items={[
                  { label: 'Pelanggan', value: detail.customer?.name },
                  { label: 'PIC Pelanggan', value: detail.customer?.pic_name || '-' },
                  { label: 'Status', value: <Badge>{detail.status}</Badge> },
                  { label: 'Tanggal Invoice', value: tgl(detail.invoice_date) },
                  { label: 'Jatuh Tempo', value: tgl(detail.due_date) },
                  { label: 'Total', value: rp(detail.total) },
                  { label: 'Sudah Dibayar', value: rp(detail.paid_amount) },
                  { label: 'Sisa', value: rp(sisaTagihan(detail.total, detail.paid_amount)) },
                  { label: 'Umur Piutang', value: <Badge tone={umur.tone}>{umur.label}</Badge> },
                  { label: 'Rekomendasi Tindak Lanjut', value: rekomendasiTindakLanjut(daysSince(detail.due_date)) },
                  { label: 'No Faktur Pajak', value: detail.faktur_pajak_no || '-' },
                ]} />
              </Section>
              <Section title="Riwayat Pembayaran Masuk">
                {detailPayments.length === 0 ? <EmptyState title="Belum ada pembayaran" message="Belum ada transaksi penerimaan tercatat untuk invoice ini." /> : (
                  <div className="border border-ink-200 dark:border-ink-800 rounded-md divide-y divide-ink-100 dark:divide-ink-800">
                    {detailPayments.map(p => (
                      <div key={p.payment_no} className="flex items-center justify-between px-3 py-2 text-body">
                        <div><div className="font-medium">{p.payment_no}</div><div className="text-caption text-ink-400">{tgl(p.payment_date)} · {p.method ?? '-'}</div></div>
                        <div className="font-medium tabular">{rp(p.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )
        })()}
      </Drawer>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Catat Pembayaran Masuk" size="sm"
        footer={<Button loading={busy} onClick={catatPembayaran}>Simpan</Button>}>
        <div className="space-y-3">
          <Field label="Tanggal Pembayaran" required><Input type="date" value={payForm.payment_date} onChange={(e: any) => setPayForm((f: any) => ({ ...f, payment_date: e.target.value }))} /></Field>
          <Field label="Jumlah" required><Money value={payForm.amount} onChange={(v: number) => setPayForm((f: any) => ({ ...f, amount: v }))} /></Field>
          <Field label="Metode"><Select value={payForm.method} onChange={(e: any) => setPayForm((f: any) => ({ ...f, method: e.target.value }))} options={['Transfer Bank', 'Giro', 'Tunai', 'Kliring']} /></Field>
          <Field label="Referensi Bank"><Input value={payForm.bank_ref} onChange={(e: any) => setPayForm((f: any) => ({ ...f, bank_ref: e.target.value }))} placeholder="Opsional" /></Field>
        </div>
      </Modal>
    </div>
  )
}
