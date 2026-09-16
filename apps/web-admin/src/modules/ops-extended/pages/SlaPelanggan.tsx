import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Drawer, Field, Input, Select, Textarea, Money,
  Desc, Section, useToast, TableSkeleton, Checkbox,
} from '@/components/ui'
import { tgl, tglJam, rupiah, pct, durasi, todayISO } from '@/lib/format'
import { SLA_REPORT_STATUSES, slaReportStatusLabel, slaReportStatusTone, CHART_COLORS } from '../lib/constants'
import { rentangPeriode, labelPeriode, periode12BulanTerakhir } from '../lib/helpers'

export default function SlaPelanggan() {
  const { profile, company, can } = useAuth()
  const toast = useToast()
  const writable = can('OPERATIONS', 'write')
  const approver = can('OPERATIONS', 'approve')

  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [rootCauses, setRootCauses] = useState<any[]>([])
  const [pulledAt, setPulledAt] = useState<Date | null>(null)

  const [genOpen, setGenOpen] = useState(false)
  const [genForm, setGenForm] = useState<any>({ customer_id: '', contract_id: '', period_code: periode12BulanTerakhir().slice(-1)[0], seluruh: false, note: '' })
  const [genPreview, setGenPreview] = useState<any>(null)
  const [genLoading, setGenLoading] = useState(false)
  const [genSaving, setGenSaving] = useState(false)

  const [detail, setDetail] = useState<any>(null)
  const [breachTickets, setBreachTickets] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [printMode, setPrintMode] = useState(false)

  useEffect(() => { if (profile?.company_id) loadAll() }, [profile?.company_id])

  async function loadAll() {
    setLoading(true)
    try {
      const [r, c, k, rc] = await Promise.all([
        list('sla_reports', { eq: { company_id: profile!.company_id }, order: { col: 'created_at', asc: false }, limit: 1000 }),
        list('customers', { select: 'id,name,code,customer_type', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
        list('contracts', { select: 'id,contract_no,contract_name,customer_id,status', eq: { company_id: profile!.company_id }, order: { col: 'contract_no', asc: true } }),
        list('root_causes', { select: 'id,code,name,aspect', eq: { company_id: profile!.company_id } }),
      ])
      setReports(r); setCustomers(c); setContracts(k); setRootCauses(rc); setPulledAt(new Date())
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat laporan SLA', 'error') }
    finally { setLoading(false) }
  }

  const custName = (id?: string) => customers.find(c => c.id === id)?.name ?? '-'
  const ctrLabel = (id?: string) => { const c = contracts.find(x => x.id === id); return c ? `${c.contract_no} — ${c.contract_name}` : '-' }
  const rcName = (id?: string) => { const r = rootCauses.find(x => x.id === id); return r ? `${r.name} (${r.aspect})` : '-' }

  /* ---------------- Bangkitkan Laporan ---------------- */
  function openGenerate() {
    setGenForm({ customer_id: '', contract_id: '', period_code: periode12BulanTerakhir().slice(-1)[0], seluruh: false, note: '' })
    setGenPreview(null); setGenOpen(true)
  }
  async function hitung() {
    if (!genForm.customer_id || !genForm.period_code) { toast.push('Pilih pelanggan dan periode terlebih dahulu', 'error'); return }
    setGenLoading(true)
    try {
      const [awal, akhir] = rentangPeriode(genForm.period_code)
      const cust = customers.find(c => c.id === genForm.customer_id)
      const opts: any = { eq: { company_id: profile!.company_id }, gte: { reported_at: awal }, lte: { reported_at: akhir }, limit: 5000 }
      if (!genForm.seluruh && cust?.name) opts.ilike = { col: 'customer_name', value: cust.name }
      const tix = await list('tickets', opts)
      const met = tix.filter((t: any) => t.sla_status === 'met').length
      const breach = tix.filter((t: any) => t.sla_status === 'breach').length
      const total = tix.length
      const ttrList = tix.filter((t: any) => t.ttr_minutes != null).map((t: any) => t.ttr_minutes as number)
      const mttr = ttrList.length ? ttrList.reduce((a: number, b: number) => a + b, 0) / ttrList.length : 0
      const compliance = total ? (met / total) * 100 : 0
      setGenPreview({ total, met, breach, compliance, mttr, penalty_amount: 0 })
    } catch (e: any) { toast.push(e.message ?? 'Gagal menghitung data tiket', 'error') }
    finally { setGenLoading(false) }
  }
  async function simpanLaporan() {
    if (!genPreview) return
    setGenSaving(true)
    try {
      const reportNo = await nextDocNo(profile!.company_id, 'SLA')
      await insert('sla_reports', {
        company_id: profile!.company_id, report_no: reportNo, customer_id: genForm.customer_id,
        contract_id: genForm.contract_id || null, period_code: genForm.period_code,
        total_tickets: genPreview.total, met_count: genPreview.met, breach_count: genPreview.breach,
        compliance_percent: +genPreview.compliance.toFixed(2), mttr_minutes: +genPreview.mttr.toFixed(1),
        penalty_amount: genPreview.penalty_amount || 0, status: 'draft', note: genForm.note || null, created_by: profile!.id,
      })
      toast.push(`Laporan ${reportNo} berhasil dibuat`, 'success')
      setGenOpen(false); await loadAll()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan laporan', 'error') }
    finally { setGenSaving(false) }
  }

  /* ---------------- Detail & rincian pelanggaran ---------------- */
  async function openDetail(row: any) {
    setDetail(row); setDetailLoading(true)
    try {
      const [awal, akhir] = rentangPeriode(row.period_code)
      const cust = customers.find(c => c.id === row.customer_id)
      const opts: any = { eq: { company_id: profile!.company_id, sla_status: 'breach' }, gte: { reported_at: awal }, lte: { reported_at: akhir }, order: { col: 'reported_at', asc: false }, limit: 500 }
      if (cust?.name) opts.ilike = { col: 'customer_name', value: cust.name }
      const bt = await list('tickets', opts)
      setBreachTickets(bt)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat rincian pelanggaran', 'error') }
    finally { setDetailLoading(false) }
  }
  const riwayatPelanggan = useMemo(() => detail
    ? reports.filter(r => r.customer_id === detail.customer_id).sort((a, b) => a.period_code.localeCompare(b.period_code)).map(r => ({ label: labelPeriode(r.period_code), kepatuhan: Number(r.compliance_percent) }))
    : [], [detail, reports])

  async function ubahStatus(status: string) {
    try {
      await update('sla_reports', detail.id, { status })
      toast.push('Status laporan diperbarui', 'success')
      const row = { ...detail, status }; setDetail(row)
      setReports(rs => rs.map(r => r.id === row.id ? row : r))
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status laporan', 'error') }
  }

  return (
    <div>
      <PageHeader title="Laporan SLA Pelanggan" subtitle="Laporan kepatuhan SLA yang dikirim ke principal per kontrak & periode"
        actions={writable && <Button onClick={openGenerate}>Bangkitkan Laporan</Button>} />

      <DataTable
        loading={loading}
        rows={reports}
        onRowClick={openDetail}
        searchKeys={['report_no', 'period_code']}
        exportName="laporan-sla-pelanggan"
        emptyTitle="Belum ada laporan SLA"
        emptyMessage="Gunakan tombol Bangkitkan Laporan untuk membuat laporan SLA per pelanggan & periode."
        columns={[
          { key: 'report_no', header: 'No Laporan' },
          { key: 'customer_id', header: 'Pelanggan', render: r => custName(r.customer_id) },
          { key: 'contract_id', header: 'Kontrak', render: r => ctrLabel(r.contract_id) },
          { key: 'period_code', header: 'Periode', render: r => labelPeriode(r.period_code) },
          { key: 'total_tickets', header: 'Total Tiket', align: 'right' },
          { key: 'met_count', header: 'Memenuhi', align: 'right' },
          { key: 'breach_count', header: 'Melanggar', align: 'right' },
          { key: 'compliance_percent', header: 'Kepatuhan', align: 'right', render: r => pct(r.compliance_percent) },
          { key: 'mttr_minutes', header: 'MTTR', align: 'right', render: r => durasi(r.mttr_minutes) },
          { key: 'penalty_amount', header: 'Penalti', align: 'right', render: r => rupiah(r.penalty_amount) },
          { key: 'status', header: 'Status', render: r => <Badge tone={slaReportStatusTone(r.status)}>{slaReportStatusLabel(r.status)}</Badge> },
        ]}
      />
      <p className="text-caption text-ink-400 mt-2">
        Sumber data: tabel <code>sla_reports</code> &amp; <code>tickets</code>. Ditarik pada {pulledAt ? tglJam(pulledAt.toISOString()) : '-'}.
      </p>

      {/* Modal Bangkitkan Laporan */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Bangkitkan Laporan SLA" size="lg"
        footer={<>
          <Button variant="outline" onClick={() => setGenOpen(false)}>Batal</Button>
          {!genPreview
            ? <Button loading={genLoading} onClick={hitung}>Hitung</Button>
            : <Button loading={genSaving} onClick={simpanLaporan}>Simpan Laporan</Button>}
        </>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Pelanggan (Principal)" required>
            <Select options={customers.map(c => ({ value: c.id, label: `${c.name} (${c.code})` }))} value={genForm.customer_id}
              onChange={(e: any) => { setGenForm({ ...genForm, customer_id: e.target.value, contract_id: '' }); setGenPreview(null) }} />
          </Field>
          <Field label="Kontrak" hint="Opsional — untuk pencatatan referensi kontrak pada laporan.">
            <Select options={contracts.filter(c => c.customer_id === genForm.customer_id).map(c => ({ value: c.id, label: `${c.contract_no} — ${c.contract_name}` }))}
              value={genForm.contract_id} onChange={(e: any) => setGenForm({ ...genForm, contract_id: e.target.value })} />
          </Field>
          <Field label="Periode" required>
            <Select options={periode12BulanTerakhir().map(p => ({ value: p, label: labelPeriode(p) }))} value={genForm.period_code}
              onChange={(e: any) => { setGenForm({ ...genForm, period_code: e.target.value }); setGenPreview(null) }} />
          </Field>
          <Field label="Catatan (opsional)"><Input value={genForm.note} onChange={(e: any) => setGenForm({ ...genForm, note: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <Checkbox label="Sertakan seluruh tiket perusahaan pada periode ini (gunakan bila nama pelanggan pada tiket tidak tertaut langsung ke data pelanggan)"
              checked={genForm.seluruh} onChange={(e: any) => { setGenForm({ ...genForm, seluruh: e.target.checked }); setGenPreview(null) }} />
          </div>
        </div>

        {genPreview && (
          <div className="mt-5 pt-5 border-t border-ink-200 dark:border-ink-800">
            <h4 className="font-display font-semibold text-caption uppercase tracking-wide text-ink-500 mb-3">Pratinjau Perhitungan</h4>
            {genPreview.total === 0 && (
              <p className="text-caption text-amber-600 dark:text-amber-400 mb-3">
                Tidak ditemukan tiket yang cocok pada periode ini. Coba aktifkan opsi "Sertakan seluruh tiket perusahaan" lalu hitung ulang, atau lanjutkan menyimpan laporan kosong.
              </p>)}
            <Desc cols={3} items={[
              { label: 'Total Tiket', value: genPreview.total },
              { label: 'Memenuhi SLA', value: genPreview.met },
              { label: 'Melanggar SLA', value: genPreview.breach },
              { label: 'Kepatuhan', value: pct(genPreview.compliance) },
              { label: 'MTTR Rata-rata', value: durasi(genPreview.mttr) },
            ]} />
            <Field label="Nilai Penalti (opsional)" className="mt-4" hint="Diisi manual berdasarkan ketentuan penalti pada kontrak — belum dihitung otomatis dari sistem.">
              <Money value={genPreview.penalty_amount} onChange={(v: number) => setGenPreview({ ...genPreview, penalty_amount: v })} />
            </Field>
          </div>
        )}
      </Modal>

      {/* Drawer detail */}
      <Drawer open={!!detail} onClose={() => setDetail(null)} width="max-w-2xl"
        title={detail ? `${detail.report_no} — ${custName(detail.customer_id)}` : ''}
        footer={detail && (
          <div className="flex flex-wrap gap-2 w-full">
            <Button size="sm" variant="outline" onClick={() => setPrintMode(true)}>Cetak Laporan</Button>
            {writable && detail.status === 'draft' && <Button size="sm" onClick={() => ubahStatus('diajukan')}>Ajukan</Button>}
            {approver && detail.status === 'diajukan' && <Button size="sm" variant="success" onClick={() => ubahStatus('disetujui')}>Setujui</Button>}
            {approver && detail.status === 'disetujui' && <Button size="sm" onClick={() => ubahStatus('terkirim')}>Tandai Terkirim</Button>}
          </div>)}>
        {detail && (
          <div>
            <Section title="Ringkasan">
              <Desc cols={2} items={[
                { label: 'Status', value: <Badge tone={slaReportStatusTone(detail.status)}>{slaReportStatusLabel(detail.status)}</Badge> },
                { label: 'Periode', value: labelPeriode(detail.period_code) },
                { label: 'Kontrak', value: ctrLabel(detail.contract_id) },
                { label: 'Total Tiket', value: detail.total_tickets },
                { label: 'Memenuhi / Melanggar', value: `${detail.met_count} / ${detail.breach_count}` },
                { label: 'Kepatuhan SLA', value: pct(detail.compliance_percent) },
                { label: 'MTTR Rata-rata', value: durasi(detail.mttr_minutes) },
                { label: 'Nilai Penalti', value: rupiah(detail.penalty_amount) },
              ]} />
              {detail.note && <p className="mt-3 text-body text-ink-600 dark:text-ink-300">{detail.note}</p>}
            </Section>

            <Section title="Kepatuhan per Bulan">
              <div className="h-56">
                {riwayatPelanggan.length < 2 ? <div className="grid place-items-center h-full text-ink-400 text-caption">Belum cukup riwayat laporan untuk pelanggan ini.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={riwayatPelanggan}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                      <Line type="monotone" dataKey="kepatuhan" stroke={CHART_COLORS[0]} strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>)}
              </div>
            </Section>

            <Section title="Rincian Tiket Melanggar SLA">
              {detailLoading ? <TableSkeleton rows={4} /> : breachTickets.length === 0 ? (
                <p className="text-caption text-ink-400">Tidak ada tiket melanggar SLA pada periode ini (atau nama pelanggan pada tiket tidak tertaut).</p>
              ) : (
                <div className="overflow-auto border border-ink-200 dark:border-ink-800 rounded-md">
                  <table className="w-full text-caption">
                    <thead className="bg-ink-50 dark:bg-surface-darker">
                      <tr>
                        <th className="px-2.5 py-2 text-left">No Tiket</th>
                        <th className="px-2.5 py-2 text-left">Dilaporkan</th>
                        <th className="px-2.5 py-2 text-right">SLA (mnt)</th>
                        <th className="px-2.5 py-2 text-right">TTR (mnt)</th>
                        <th className="px-2.5 py-2 text-right">Keterlambatan</th>
                        <th className="px-2.5 py-2 text-left">Root Cause / Alasan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breachTickets.map(t => (
                        <tr key={t.id} className="border-t border-ink-100 dark:border-ink-800">
                          <td className="px-2.5 py-2">{t.ticket_no}</td>
                          <td className="px-2.5 py-2">{tgl(t.reported_at)}</td>
                          <td className="px-2.5 py-2 text-right tabular">{t.sla_minutes ?? '-'}</td>
                          <td className="px-2.5 py-2 text-right tabular">{t.ttr_minutes ?? '-'}</td>
                          <td className="px-2.5 py-2 text-right tabular text-red-600 dark:text-red-400">{t.ttr_minutes != null && t.sla_minutes != null ? Math.max(0, t.ttr_minutes - t.sla_minutes) : '-'}</td>
                          <td className="px-2.5 py-2">{t.root_cause_id ? rcName(t.root_cause_id) : (t.description || '-')}</td>
                        </tr>))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        )}
      </Drawer>

      {/* Halaman cetak */}
      {printMode && detail && (
        <div className="fixed inset-0 z-[200] bg-white overflow-auto p-8">
          <div className="print:hidden flex justify-end gap-2 mb-4">
            <Button variant="outline" onClick={() => setPrintMode(false)}>Tutup</Button>
            <Button onClick={() => window.print()}>Cetak</Button>
          </div>
          <div className="max-w-3xl mx-auto text-ink-900">
            <div className="flex items-center justify-between border-b-2 border-ink-800 pb-4 mb-4">
              <div>
                <h1 className="font-display text-xl font-bold">{company?.name ?? 'Perusahaan'}</h1>
                <p className="text-caption">{company?.address}</p>
                <p className="text-caption">{company?.phone} {company?.email ? `· ${company.email}` : ''}</p>
              </div>
              {company?.logo_url && <img src={company.logo_url} className="h-14" />}
            </div>
            <h2 className="text-center font-display text-lg font-bold mb-1">LAPORAN KEPATUHAN SLA PELANGGAN</h2>
            <p className="text-center text-body mb-6">No. {detail.report_no} — Periode {labelPeriode(detail.period_code)}</p>

            <Desc cols={2} items={[
              { label: 'Pelanggan', value: custName(detail.customer_id) },
              { label: 'Kontrak', value: ctrLabel(detail.contract_id) },
              { label: 'Status Laporan', value: slaReportStatusLabel(detail.status) },
              { label: 'Tanggal Cetak', value: tgl(todayISO()) },
            ]} />

            <table className="w-full text-body mt-6 border border-ink-300">
              <tbody>
                <tr className="border-b border-ink-300"><td className="px-3 py-2 font-medium bg-ink-50">Total Tiket</td><td className="px-3 py-2 text-right">{detail.total_tickets}</td></tr>
                <tr className="border-b border-ink-300"><td className="px-3 py-2 font-medium bg-ink-50">Tiket Memenuhi SLA</td><td className="px-3 py-2 text-right">{detail.met_count}</td></tr>
                <tr className="border-b border-ink-300"><td className="px-3 py-2 font-medium bg-ink-50">Tiket Melanggar SLA</td><td className="px-3 py-2 text-right">{detail.breach_count}</td></tr>
                <tr className="border-b border-ink-300"><td className="px-3 py-2 font-medium bg-ink-50">Kepatuhan SLA</td><td className="px-3 py-2 text-right">{pct(detail.compliance_percent)}</td></tr>
                <tr className="border-b border-ink-300"><td className="px-3 py-2 font-medium bg-ink-50">MTTR Rata-rata</td><td className="px-3 py-2 text-right">{durasi(detail.mttr_minutes)}</td></tr>
                <tr><td className="px-3 py-2 font-medium bg-ink-50">Nilai Penalti</td><td className="px-3 py-2 text-right">{rupiah(detail.penalty_amount)}</td></tr>
              </tbody>
            </table>

            {breachTickets.length > 0 && (
              <>
                <h3 className="font-display font-semibold mt-6 mb-2">Rincian Tiket Melanggar SLA</h3>
                <table className="w-full text-caption border border-ink-300">
                  <thead><tr className="bg-ink-50">
                    <th className="px-2 py-1.5 border-b border-ink-300 text-left">No Tiket</th>
                    <th className="px-2 py-1.5 border-b border-ink-300 text-left">Dilaporkan</th>
                    <th className="px-2 py-1.5 border-b border-ink-300 text-right">SLA (mnt)</th>
                    <th className="px-2 py-1.5 border-b border-ink-300 text-right">TTR (mnt)</th>
                    <th className="px-2 py-1.5 border-b border-ink-300 text-right">Terlambat (mnt)</th>
                  </tr></thead>
                  <tbody>
                    {breachTickets.map(t => (
                      <tr key={t.id}>
                        <td className="px-2 py-1.5 border-b border-ink-200">{t.ticket_no}</td>
                        <td className="px-2 py-1.5 border-b border-ink-200">{tgl(t.reported_at)}</td>
                        <td className="px-2 py-1.5 border-b border-ink-200 text-right">{t.sla_minutes ?? '-'}</td>
                        <td className="px-2 py-1.5 border-b border-ink-200 text-right">{t.ttr_minutes ?? '-'}</td>
                        <td className="px-2 py-1.5 border-b border-ink-200 text-right">{t.ttr_minutes != null && t.sla_minutes != null ? Math.max(0, t.ttr_minutes - t.sla_minutes) : '-'}</td>
                      </tr>))}
                  </tbody>
                </table>
              </>
            )}

            <div className="grid grid-cols-2 gap-8 mt-16 text-body">
              <div className="text-center">
                <p className="mb-16">Diserahkan oleh,</p>
                <p className="border-t border-ink-800 pt-1">{company?.name}</p>
              </div>
              <div className="text-center">
                <p className="mb-16">Diterima oleh,</p>
                <p className="border-t border-ink-800 pt-1">{custName(detail.customer_id)}</p>
              </div>
            </div>

            <p className="text-caption text-ink-500 mt-10 border-t border-ink-200 pt-2">
              Sumber data: tabel <code>sla_reports</code> &amp; <code>tickets</code> aplikasi NUSAKARYA. Ditarik pada {tglJam(new Date().toISOString())}.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
