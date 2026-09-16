import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO, num } from '@/lib/format'
import {
  PageHeader, Card, DataTable, Modal, Drawer, ConfirmDialog, Field, Input, Select, Textarea,
  Badge, Button, Stepper, useToast, TableSkeleton, EmptyState, Section, Desc, Plus,
} from '@/components/ui'
import { Printer } from 'lucide-react'
import { CLAIM_STATUS_STEPS } from '../lib/constants'

type Item = { price_list_id: string | null; description: string; uom: string; unit_price: number; qty: number }

export default function Klaim() {
  const { profile, company, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [spkList, setSpkList] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // form pembuatan klaim baru
  const [fSpkId, setFSpkId] = useState('')
  const [fPeriodStart, setFPeriodStart] = useState(todayISO())
  const [fPeriodEnd, setFPeriodEnd] = useState(todayISO())
  const [fBaNo, setFBaNo] = useState('')
  const [fBaDate, setFBaDate] = useState(todayISO())
  const [fNote, setFNote] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)

  const [detail, setDetail] = useState<any>(null)
  const [detailItems, setDetailItems] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [delId, setDelId] = useState<string | null>(null)
  const [printMode, setPrintMode] = useState(false)

  const spkMap = useMemo(() => Object.fromEntries(spkList.map(s => [s.id, s])), [spkList])
  const contractMap = useMemo(() => Object.fromEntries(contracts.map(c => [c.id, c])), [contracts])

  const load = async () => {
    setLoading(true)
    try {
      const [cl, sp, ct] = await Promise.all([
        list('progress_claims', { order: { col: 'created_at', asc: false }, limit: 500 }),
        list('spk', { select: 'id,spk_no,title,contract_id,status', eq: { status: 'aktif' }, order: { col: 'spk_no', asc: true }, limit: 500 }),
        list('contracts', { select: 'id,contract_name,retention_percent,customer_id', limit: 500 }),
      ])
      setRows(cl); setSpkList(sp); setContracts(ct)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data klaim', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const resetForm = () => {
    setFSpkId(''); setFPeriodStart(todayISO()); setFPeriodEnd(todayISO()); setFBaNo(''); setFBaDate(todayISO()); setFNote(''); setItems([])
  }
  const openAdd = () => { resetForm(); setModal(true) }

  const pullPriceList = async (spkId: string) => {
    setFSpkId(spkId)
    const spk = spkMap[spkId]
    if (!spk) { setItems([]); return }
    setItemsLoading(true)
    try {
      const pl = await list('contract_price_list', { eq: { contract_id: spk.contract_id, is_active: true }, order: { col: 'item_code', asc: true }, limit: 500 })
      setItems(pl.map((p: any) => ({ price_list_id: p.id, description: `${p.item_code ? p.item_code + ' — ' : ''}${p.description ?? ''}`, uom: p.uom ?? '', unit_price: Number(p.unit_price) || 0, qty: 0 })))
    } catch (e: any) { toast.push(e.message ?? 'Gagal menarik item price list', 'error') }
    finally { setItemsLoading(false) }
  }

  const claimAmount = useMemo(() => items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0), [items])
  const contractIdForForm = fSpkId ? spkMap[fSpkId]?.contract_id : null
  const retentionPercent = contractIdForForm ? Number(contractMap[contractIdForForm]?.retention_percent ?? 0) : 0
  const retentionAmount = Math.round(claimAmount * retentionPercent / 100)
  const netAmount = claimAmount - retentionAmount

  const save = async () => {
    if (!fSpkId) { toast.push('Pilih SPK terlebih dahulu', 'error'); return }
    const filledItems = items.filter(it => Number(it.qty) > 0)
    if (filledItems.length === 0) { toast.push('Isi minimal satu qty realisasi', 'error'); return }
    setSaving(true)
    try {
      const spk = spkMap[fSpkId]
      const claimNo = await nextDocNo(profile!.company_id, 'CLM')
      const claim = await insert<any>('progress_claims', {
        company_id: profile!.company_id, claim_no: claimNo, spk_id: fSpkId, contract_id: spk.contract_id,
        period_start: fPeriodStart || null, period_end: fPeriodEnd || null, progress_percent: 0,
        claim_amount: claimAmount, retention_amount: retentionAmount, status: 'draft',
        ba_no: fBaNo, ba_date: fBaDate || null, note: fNote,
      })
      for (const it of filledItems) {
        await insert('progress_claim_items', {
          company_id: profile!.company_id, claim_id: claim.id, price_list_id: it.price_list_id,
          description: it.description, uom: it.uom, qty: Number(it.qty), unit_price: Number(it.unit_price),
          amount: Number(it.qty) * Number(it.unit_price),
        })
      }
      toast.push('Klaim progres ditambahkan', 'success')
      setModal(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan klaim', 'error') }
    finally { setSaving(false) }
  }

  const openDetail = async (row: any) => {
    setDetail(row); setDetailLoading(true)
    try { setDetailItems(await list('progress_claim_items', { eq: { claim_id: row.id }, order: { col: 'created_at', asc: true } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat item klaim', 'error') }
    finally { setDetailLoading(false) }
  }

  const changeStatus = async (status: string, note?: string) => {
    if (!detail) return
    try {
      const payload: any = { status }
      if (note != null) payload.note = note
      await update('progress_claims', detail.id, payload)
      toast.push('Status klaim diperbarui', 'success')
      setDetail({ ...detail, ...payload }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
  }
  const doReject = async () => {
    if (!rejectReason.trim()) { toast.push('Alasan penolakan wajib diisi', 'error'); return }
    await changeStatus('ditolak', rejectReason)
    setRejectOpen(false); setRejectReason('')
  }
  const doDelete = async () => {
    if (!delId) return
    try { await remove('progress_claims', delId); toast.push('Klaim dihapus', 'success'); load() }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus klaim', 'error') }
  }

  const columns = [
    { key: 'claim_no', header: 'No Klaim', width: '140px' },
    { key: 'spk_id', header: 'SPK', render: (r: any) => spkMap[r.spk_id]?.spk_no ?? '-' },
    { key: 'contract_id', header: 'Kontrak', render: (r: any) => contractMap[r.contract_id]?.contract_name ?? '-' },
    { key: 'periode', header: 'Periode', sortable: false, render: (r: any) => `${tgl(r.period_start)} – ${tgl(r.period_end)}` },
    { key: 'claim_amount', header: 'Nilai Klaim', align: 'right' as const, render: (r: any) => rupiah(r.claim_amount) },
    { key: 'retention_amount', header: 'Retensi', align: 'right' as const, render: (r: any) => rupiah(r.retention_amount) },
    { key: 'bersih', header: 'Nilai Bersih', align: 'right' as const, sortable: false, render: (r: any) => rupiah(Number(r.claim_amount) - Number(r.retention_amount)) },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
    can('COMMERCE', 'approve') ? {
      key: 'aksi', header: '', width: '90px', sortable: false,
      render: (r: any) => <div onClick={e => e.stopPropagation()}><Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelId(r.id)}>Hapus</Button></div>,
    } : null,
  ].filter(Boolean) as any

  const stepIdx = detail ? Math.max(0, CLAIM_STATUS_STEPS.indexOf(detail.status)) : 0

  return (
    <div>
      <PageHeader title="Klaim Progres / BA" subtitle="Klaim progres pekerjaan berdasarkan realisasi item price list per SPK."
        actions={can('COMMERCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Klaim</Button>} />

      {loading ? <Card><TableSkeleton /></Card> : (
        <DataTable columns={columns} rows={rows} searchable searchKeys={['claim_no']} exportName="klaim-progres"
          onRowClick={openDetail} emptyTitle="Belum ada klaim progres" emptyMessage="Buat klaim progres dari SPK yang sedang berjalan."
          emptyAction={can('COMMERCE', 'write') && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah Klaim</Button>} />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Tambah Klaim Progres" size="xl"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan Klaim</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="SPK" required className="sm:col-span-2">
            <Select value={fSpkId} options={spkList.map(s => ({ value: s.id, label: `${s.spk_no} — ${s.title}` }))} onChange={(e: any) => pullPriceList(e.target.value)} />
          </Field>
          <Field label="Periode Mulai"><Input type="date" value={fPeriodStart} onChange={e => setFPeriodStart(e.target.value)} /></Field>
          <Field label="Periode Selesai"><Input type="date" value={fPeriodEnd} onChange={e => setFPeriodEnd(e.target.value)} /></Field>
          <Field label="No Berita Acara"><Input value={fBaNo} onChange={e => setFBaNo(e.target.value)} /></Field>
          <Field label="Tanggal Berita Acara"><Input type="date" value={fBaDate} onChange={e => setFBaDate(e.target.value)} /></Field>
          <Field label="Catatan" className="sm:col-span-2"><Textarea value={fNote} onChange={e => setFNote(e.target.value)} /></Field>
        </div>

        {itemsLoading ? <TableSkeleton rows={3} /> : items.length === 0 ? (
          <EmptyState title="Belum ada item" message="Pilih SPK untuk menarik item price list dari kontrak terkait." />
        ) : (
          <div className="border border-ink-200 dark:border-ink-800 rounded-sm overflow-hidden mb-4">
            <table className="w-full text-body">
              <thead className="bg-ink-50 dark:bg-surface-darker"><tr>
                <th className="px-3 py-2 text-left text-caption font-semibold text-ink-500">Deskripsi</th>
                <th className="px-3 py-2 text-left text-caption font-semibold text-ink-500 w-20">Satuan</th>
                <th className="px-3 py-2 text-right text-caption font-semibold text-ink-500 w-32">Harga Satuan</th>
                <th className="px-3 py-2 text-right text-caption font-semibold text-ink-500 w-28">Qty Realisasi</th>
                <th className="px-3 py-2 text-right text-caption font-semibold text-ink-500 w-32">Nilai</th>
              </tr></thead>
              <tbody>{items.map((it, i) => (
                <tr key={i} className="border-t border-ink-100 dark:border-ink-800">
                  <td className="px-3 py-2">{it.description}</td>
                  <td className="px-3 py-2">{it.uom}</td>
                  <td className="px-3 py-2 text-right tabular">{rupiah(it.unit_price)}</td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} value={it.qty || ''} onChange={e => {
                      const v = Number(e.target.value) || 0
                      setItems(arr => arr.map((x, xi) => xi === i ? { ...x, qty: v } : x))
                    }} className="w-full h-8 px-2 text-right rounded-xs border border-ink-200 dark:border-ink-700 bg-white dark:bg-surface-dark" />
                  </td>
                  <td className="px-3 py-2 text-right tabular">{rupiah((Number(it.qty) || 0) * it.unit_price)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}

        <Card className="p-4">
          <Desc cols={3} items={[
            { label: 'Nilai Klaim', value: rupiah(claimAmount) },
            { label: `Retensi (${retentionPercent}%)`, value: rupiah(retentionAmount) },
            { label: 'Nilai Bersih', value: <span className="font-semibold text-primary-600">{rupiah(netAmount)}</span> },
          ]} />
        </Card>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.claim_no} width="max-w-2xl"
        footer={detail && <>
          {detail.status === 'draft' && can('COMMERCE', 'write') && <Button variant="outline" onClick={() => changeStatus('diajukan')}>Ajukan</Button>}
          {detail.status === 'diajukan' && can('COMMERCE', 'write') && <Button variant="outline" onClick={() => changeStatus('diverifikasi')}>Verifikasi</Button>}
          {detail.status === 'diverifikasi' && can('COMMERCE', 'approve') && <>
            <Button variant="danger" onClick={() => setRejectOpen(true)}>Tolak</Button>
            <Button variant="success" onClick={() => changeStatus('disetujui')}>Setujui</Button>
          </>}
          {detail.status === 'disetujui' && can('COMMERCE', 'write') && <Button variant="outline" onClick={() => changeStatus('ditagihkan')}>Tandai Ditagihkan</Button>}
          <Button variant="outline" icon={<Printer size={15} />} onClick={() => setPrintMode(true)}>Cetak BA</Button>
        </>}>
        {detail && (
          <>
            {detail.status !== 'ditolak' && <div className="mb-5"><Stepper steps={CLAIM_STATUS_STEPS} current={stepIdx} /></div>}
            {detail.status === 'ditolak' && <div className="mb-5"><Badge>ditolak</Badge>{detail.note && <p className="text-caption text-ink-500 mt-1">Alasan: {detail.note}</p>}</div>}
            <Section title="Ringkasan">
              <Desc items={[
                { label: 'SPK', value: spkMap[detail.spk_id]?.spk_no },
                { label: 'Kontrak', value: contractMap[detail.contract_id]?.contract_name },
                { label: 'Periode', value: `${tgl(detail.period_start)} – ${tgl(detail.period_end)}` },
                { label: 'No Berita Acara', value: detail.ba_no },
                { label: 'Tanggal BA', value: tgl(detail.ba_date) },
                { label: 'Nilai Klaim', value: rupiah(detail.claim_amount) },
                { label: 'Retensi', value: rupiah(detail.retention_amount) },
                { label: 'Nilai Bersih', value: rupiah(Number(detail.claim_amount) - Number(detail.retention_amount)) },
                { label: 'Catatan', value: detail.note },
              ]} />
            </Section>
            <Section title="Item Realisasi">
              {detailLoading ? <TableSkeleton rows={3} /> : detailItems.length === 0 ? <EmptyState title="Belum ada item" /> : (
                <div className="space-y-2">{detailItems.map((it: any) => (
                  <Card key={it.id} className="p-3 flex items-center justify-between gap-3">
                    <div><p className="text-body">{it.description}</p><p className="text-caption text-ink-500">{num(it.qty)} {it.uom} × {rupiah(it.unit_price)}</p></div>
                    <p className="text-body tabular font-medium">{rupiah(it.amount)}</p>
                  </Card>))}</div>)}
            </Section>
          </>)}
      </Drawer>

      {printMode && detail && (
        <div className="fixed inset-0 z-[200] bg-white overflow-auto p-8">
          <div className="print:hidden flex justify-end mb-4"><Button variant="outline" onClick={() => setPrintMode(false)}>Tutup</Button><Button className="ml-2" onClick={() => window.print()}>Cetak</Button></div>
          <div className="max-w-2xl mx-auto text-ink-900">
            <h1 className="text-center font-display text-xl font-bold mb-1">BERITA ACARA KLAIM PROGRES PEKERJAAN</h1>
            <p className="text-center text-body mb-6">{company?.name}</p>
            <table className="w-full text-body mb-4"><tbody>
              <tr><td className="py-0.5 w-40">No Klaim</td><td>: {detail.claim_no}</td></tr>
              <tr><td className="py-0.5">No Berita Acara</td><td>: {detail.ba_no || '-'}</td></tr>
              <tr><td className="py-0.5">Tanggal BA</td><td>: {tgl(detail.ba_date)}</td></tr>
              <tr><td className="py-0.5">SPK</td><td>: {spkMap[detail.spk_id]?.spk_no} — {spkMap[detail.spk_id]?.title}</td></tr>
              <tr><td className="py-0.5">Kontrak</td><td>: {contractMap[detail.contract_id]?.contract_name}</td></tr>
              <tr><td className="py-0.5">Periode</td><td>: {tgl(detail.period_start)} – {tgl(detail.period_end)}</td></tr>
            </tbody></table>
            <table className="w-full text-body border border-ink-300 mb-4">
              <thead><tr className="border-b border-ink-300">
                <th className="text-left p-2 border-r border-ink-300">Deskripsi</th>
                <th className="text-right p-2 border-r border-ink-300 w-20">Qty</th>
                <th className="text-right p-2 border-r border-ink-300 w-32">Harga Satuan</th>
                <th className="text-right p-2 w-32">Nilai</th>
              </tr></thead>
              <tbody>{detailItems.map((it: any) => (
                <tr key={it.id} className="border-b border-ink-200">
                  <td className="p-2 border-r border-ink-300">{it.description}</td>
                  <td className="p-2 border-r border-ink-300 text-right">{num(it.qty)} {it.uom}</td>
                  <td className="p-2 border-r border-ink-300 text-right">{rupiah(it.unit_price)}</td>
                  <td className="p-2 text-right">{rupiah(it.amount)}</td>
                </tr>))}</tbody>
            </table>
            <p className="text-body mb-1">Nilai Klaim: <b>{rupiah(detail.claim_amount)}</b></p>
            <p className="text-body mb-1">Retensi: <b>{rupiah(detail.retention_amount)}</b></p>
            <p className="text-body mb-6">Nilai Bersih Ditagihkan: <b>{rupiah(Number(detail.claim_amount) - Number(detail.retention_amount))}</b></p>
            <div className="grid grid-cols-2 gap-8 mt-16 text-center text-body">
              <div><p>Diserahkan oleh,</p><div className="h-20" /><p className="border-t border-ink-400 pt-1">Kontraktor</p></div>
              <div><p>Diterima oleh,</p><div className="h-20" /><p className="border-t border-ink-400 pt-1">Pelanggan</p></div>
            </div>
          </div>
        </div>
      )}

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Tolak Klaim"
        footer={<><Button variant="outline" onClick={() => setRejectOpen(false)}>Batal</Button><Button variant="danger" onClick={doReject}>Tolak Klaim</Button></>}>
        <Field label="Alasan Penolakan" required><Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} /></Field>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
        title="Hapus Klaim" message="Klaim progres akan dihapus permanen. Lanjutkan?" confirmLabel="Ya, Hapus" />
    </div>
  )
}
