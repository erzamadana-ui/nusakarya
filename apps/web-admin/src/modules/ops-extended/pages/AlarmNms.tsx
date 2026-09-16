import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Drawer, Tabs, Field, Input, Select, Textarea,
  Desc, Section, KpiCard, useToast, TableSkeleton,
} from '@/components/ui'
import { tglJam, durasi } from '@/lib/format'
import {
  ALARM_SEVERITIES, ALARM_STATUSES, alarmSeverityLabel, alarmSeverityTone, alarmStatusLabel, alarmStatusTone,
  ALARM_TO_TICKET_SEVERITY, TICKET_SEVERITIES, ticketSeverityLabel, CHART_COLORS,
} from '../lib/constants'
import { umurMenit, warnaUmurAlarm, formatMenit, rentangHariIni, rentangJamKeBelakang } from '../lib/helpers'

export default function AlarmNms() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const writable = can('OPERATIONS', 'write')

  const [loading, setLoading] = useState(true)
  const [alarms, setAlarms] = useState<any[]>([])
  const [elements, setElements] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [pulledAt, setPulledAt] = useState<Date | null>(null)

  const [tab, setTab] = useState('baru')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detail, setDetail] = useState<any>(null)

  const [ignoreOpen, setIgnoreOpen] = useState(false)
  const [ignoreTargets, setIgnoreTargets] = useState<string[]>([])
  const [ignoreReason, setIgnoreReason] = useState('')
  const [ignoreSaving, setIgnoreSaving] = useState(false)

  const [ticketOpen, setTicketOpen] = useState(false)
  const [ticketAlarm, setTicketAlarm] = useState<any>(null)
  const [ticketForm, setTicketForm] = useState<any>({})
  const [ticketSaving, setTicketSaving] = useState(false)

  useEffect(() => { if (profile?.company_id) loadAll() }, [profile?.company_id])

  async function loadAll() {
    setLoading(true)
    try {
      const [al, el, br, pr] = await Promise.all([
        list('nms_alarms', { eq: { company_id: profile!.company_id }, order: { col: 'received_at', asc: false }, limit: 3000 }),
        list('network_elements', { select: 'id,code,name,element_type,branch_id', eq: { company_id: profile!.company_id }, order: { col: 'code', asc: true } }),
        list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
        list('profiles', { select: 'id,full_name', eq: { company_id: profile!.company_id } }),
      ])
      setAlarms(al); setElements(el); setBranches(br); setStaff(pr); setPulledAt(new Date())
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat alarm NMS', 'error') }
    finally { setLoading(false) }
  }

  const elName = (id?: string, fallback?: string) => {
    const e = elements.find(x => x.id === id)
    return e ? `${e.element_type} · ${e.code} — ${e.name}` : (fallback || '-')
  }
  const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
  const staffName = (id?: string) => staff.find(s => s.id === id)?.full_name ?? '-'

  /* ---------------- KPI & Chart ---------------- */
  const kpi = useMemo(() => {
    const baru = alarms.filter(a => a.status === 'baru')
    const criticalBelumDiakui = baru.filter(a => a.severity === 'critical')
    const diakuiList = alarms.filter(a => a.acknowledged_at && a.received_at)
    const rataAkui = diakuiList.length
      ? diakuiList.reduce((sum, a) => sum + (umurMenit(a.received_at, a.acknowledged_at) ?? 0), 0) / diakuiList.length
      : null
    const [awal, akhir] = rentangHariIni()
    const jadiTiketHariIni = alarms.filter(a => a.status === 'tiket_dibuat' && a.updated_at >= awal && a.updated_at <= akhir)
    return { baru: baru.length, criticalBelumDiakui: criticalBelumDiakui.length, rataAkui, jadiTiketHariIni: jadiTiketHariIni.length }
  }, [alarms])

  const perJam = useMemo(() => {
    const [awal] = rentangJamKeBelakang(24)
    const buckets: { label: string; jam: number; jumlah: number }[] = []
    const now = new Date()
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000)
      buckets.push({ label: `${String(d.getHours()).padStart(2, '0')}:00`, jam: d.getHours(), jumlah: 0 })
    }
    alarms.forEach(a => {
      if (!a.received_at || a.received_at < awal) return
      const d = new Date(a.received_at)
      const jamKe = Math.floor((now.getTime() - d.getTime()) / 3600000)
      const idx = 23 - jamKe
      if (idx >= 0 && idx < 24) buckets[idx].jumlah += 1
    })
    return buckets
  }, [alarms])

  /* ---------------- Tabs & tabel ---------------- */
  const filtered = useMemo(() => tab === 'semua' ? alarms : alarms.filter(a => a.status === tab), [alarms, tab])
  const tabs = [
    { value: 'semua', label: 'Semua', count: alarms.length },
    ...ALARM_STATUSES.map(s => ({ value: s.value, label: s.label, count: alarms.filter(a => a.status === s.value).length })),
  ]

  /* ---------------- Aksi: akui ---------------- */
  async function akuiSatu(id: string) {
    try {
      await update('nms_alarms', id, { status: 'diakui', acknowledged_by: profile!.id, acknowledged_at: new Date().toISOString() })
      toast.push('Alarm berhasil diakui', 'success')
      await loadAll()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengakui alarm', 'error') }
  }
  async function akuiTerpilih() {
    const targets = alarms.filter(a => selectedIds.includes(a.id) && a.status === 'baru')
    if (targets.length === 0) { toast.push('Tidak ada alarm berstatus Baru pada pilihan Anda', 'error'); return }
    try {
      await Promise.all(targets.map(a => update('nms_alarms', a.id, { status: 'diakui', acknowledged_by: profile!.id, acknowledged_at: new Date().toISOString() })))
      toast.push(`${targets.length} alarm berhasil diakui`, 'success')
      setSelectedIds([]); await loadAll()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengakui alarm terpilih', 'error') }
  }

  /* ---------------- Aksi: abaikan ---------------- */
  function openIgnore(ids: string[]) { setIgnoreTargets(ids); setIgnoreReason(''); setIgnoreOpen(true) }
  async function submitIgnore() {
    if (!ignoreReason.trim()) { toast.push('Alasan mengabaikan alarm wajib diisi', 'error'); return }
    setIgnoreSaving(true)
    try {
      const targets = alarms.filter(a => ignoreTargets.includes(a.id))
      await Promise.all(targets.map(a => update('nms_alarms', a.id, {
        status: 'diabaikan',
        description: `${a.description ? a.description + '\n\n' : ''}Diabaikan oleh ${profile!.full_name} pada ${tglJam(new Date().toISOString())} — Alasan: ${ignoreReason.trim()}`,
      })))
      toast.push(`${targets.length} alarm berhasil diabaikan`, 'success')
      setIgnoreOpen(false); setSelectedIds([]); setDetail(null); await loadAll()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengabaikan alarm', 'error') }
    finally { setIgnoreSaving(false) }
  }

  /* ---------------- Aksi: buat tiket ---------------- */
  function openBuatTiket(a: any) {
    const el = elements.find(x => x.id === a.network_element_id)
    setTicketAlarm(a)
    setTicketForm({
      branch_id: el?.branch_id ?? '', network_element_id: a.network_element_id ?? '',
      severity: ALARM_TO_TICKET_SEVERITY[a.severity] ?? 'sedang',
      category: a.alarm_type ?? '', sub_category: '', customer_name: '',
      description: `[Alarm NMS ${a.alarm_id_ext ?? ''}] ${a.description ?? a.alarm_type ?? ''}`.trim(),
    })
    setTicketOpen(true)
  }
  async function submitBuatTiket() {
    if (!ticketForm.branch_id) { toast.push('Pilih cabang terlebih dahulu', 'error'); return }
    setTicketSaving(true)
    try {
      const ticketNo = await nextDocNo(profile!.company_id, 'TKT')
      const row = await insert('tickets', {
        company_id: profile!.company_id, ticket_no: ticketNo, source: 'nms', ticket_type: 'gangguan',
        severity: ticketForm.severity, branch_id: ticketForm.branch_id, network_element_id: ticketForm.network_element_id || null,
        category: ticketForm.category || null, sub_category: ticketForm.sub_category || null,
        customer_name: ticketForm.customer_name || null, description: ticketForm.description || null,
        created_by: profile!.id,
      })
      await update('nms_alarms', ticketAlarm.id, { ticket_id: row.id, status: 'tiket_dibuat' })
      toast.push(`Tiket ${ticketNo} berhasil dibuat dari alarm`, 'success')
      setTicketOpen(false); setDetail(null); await loadAll()
    } catch (e: any) { toast.push(e.message ?? 'Gagal membuat tiket dari alarm', 'error') }
    finally { setTicketSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Alarm NMS" subtitle="Inbox alarm jaringan dari sistem monitoring — akui, tindak lanjuti jadi tiket, atau abaikan" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Alarm Baru" value={loading ? '…' : kpi.baru} />
        <KpiCard label="Critical Belum Diakui" value={loading ? '…' : kpi.criticalBelumDiakui} tone={kpi.criticalBelumDiakui > 0 ? 'red' : 'emerald'} />
        <KpiCard label="Rata-rata Waktu Pengakuan" value={loading ? '…' : durasi(kpi.rataAkui)} />
        <KpiCard label="Jadi Tiket Hari Ini" value={loading ? '…' : kpi.jadiTiketHariIni} tone="emerald" />
      </div>

      <Card className="mb-4">
        <CardHeader title="Alarm per Jam — 24 Jam Terakhir" />
        <div className="p-4 h-56">
          {loading ? <TableSkeleton rows={3} /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perJam}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="jumlah" name="Jumlah Alarm" radius={[3, 3, 0, 0]}>
                  {perJam.map((_, i) => <Cell key={i} fill={CHART_COLORS[0]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>)}
        </div>
      </Card>

      <Card className="mb-4">
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="px-4" />
      </Card>

      <DataTable
        loading={loading}
        rows={filtered}
        onRowClick={setDetail}
        searchKeys={['alarm_id_ext', 'source_system', 'element_ref', 'alarm_type', 'description']}
        exportName="alarm-nms"
        selectable={writable}
        onSelect={setSelectedIds}
        emptyTitle="Belum ada alarm"
        emptyMessage="Alarm dari sistem monitoring jaringan akan muncul di sini."
        toolbar={writable && selectedIds.length > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={akuiTerpilih}>Akui Terpilih</Button>
            <Button size="sm" variant="danger" onClick={() => openIgnore(selectedIds)}>Abaikan Terpilih</Button>
          </>
        )}
        columns={[
          { key: 'received_at', header: 'Waktu Terima', render: r => tglJam(r.received_at) },
          { key: 'severity', header: 'Keparahan', render: r => <Badge tone={alarmSeverityTone(r.severity)}>{alarmSeverityLabel(r.severity)}</Badge> },
          { key: 'source_system', header: 'Sistem Sumber' },
          { key: 'network_element_id', header: 'Elemen Jaringan', render: r => elName(r.network_element_id, r.element_ref) },
          { key: 'alarm_type', header: 'Jenis Alarm' },
          { key: 'description', header: 'Uraian', render: r => <span className="line-clamp-1 max-w-xs block">{r.description || '-'}</span> },
          { key: 'umur', header: 'Umur Alarm', sortable: false, render: r => {
              const m = umurMenit(r.received_at, r.cleared_at)
              return <span className={warnaUmurAlarm(r.status === 'clear' || r.status === 'diabaikan' ? null : m)}>{formatMenit(m)}</span>
            } },
          { key: 'status', header: 'Status', render: r => <Badge tone={alarmStatusTone(r.status)}>{alarmStatusLabel(r.status)}</Badge> },
          { key: 'aksi', header: 'Aksi', sortable: false, render: r => writable && r.status === 'baru' ? (
              <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="outline" onClick={() => akuiSatu(r.id)}>Akui</Button>
                <Button size="sm" onClick={() => openBuatTiket(r)}>Buat Tiket</Button>
                <Button size="sm" variant="danger" onClick={() => openIgnore([r.id])}>Abaikan</Button>
              </div>
            ) : r.status === 'diakui' && writable ? (
              <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                <Button size="sm" onClick={() => openBuatTiket(r)}>Buat Tiket</Button>
                <Button size="sm" variant="danger" onClick={() => openIgnore([r.id])}>Abaikan</Button>
              </div>
            ) : null },
        ]}
      />
      <p className="text-caption text-ink-400 mt-2">
        Sumber data: tabel <code>nms_alarms</code> (hingga 3.000 alarm terbaru). Ditarik pada {pulledAt ? tglJam(pulledAt.toISOString()) : '-'}.
      </p>

      {/* Drawer detail */}
      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail ? `Alarm ${detail.alarm_id_ext ?? detail.id.slice(0, 8)}` : ''}
        footer={detail && writable && (detail.status === 'baru' || detail.status === 'diakui') && (
          <div className="flex flex-wrap gap-2 w-full">
            {detail.status === 'baru' && <Button size="sm" variant="outline" onClick={() => { akuiSatu(detail.id); setDetail(null) }}>Akui</Button>}
            <Button size="sm" onClick={() => openBuatTiket(detail)}>Buat Tiket</Button>
            <Button size="sm" variant="danger" onClick={() => openIgnore([detail.id])}>Abaikan</Button>
          </div>)}>
        {detail && (
          <Section>
            <Desc cols={2} items={[
              { label: 'Status', value: <Badge tone={alarmStatusTone(detail.status)}>{alarmStatusLabel(detail.status)}</Badge> },
              { label: 'Keparahan', value: <Badge tone={alarmSeverityTone(detail.severity)}>{alarmSeverityLabel(detail.severity)}</Badge> },
              { label: 'ID Alarm Eksternal', value: detail.alarm_id_ext },
              { label: 'Sistem Sumber', value: detail.source_system },
              { label: 'Jenis Alarm', value: detail.alarm_type },
              { label: 'Elemen Jaringan', value: elName(detail.network_element_id, detail.element_ref) },
              { label: 'Waktu Terima', value: tglJam(detail.received_at) },
              { label: 'Waktu Clear', value: tglJam(detail.cleared_at) },
              { label: 'Diakui Oleh', value: detail.acknowledged_by ? `${staffName(detail.acknowledged_by)} · ${tglJam(detail.acknowledged_at)}` : '-' },
              { label: 'Tiket Terkait', value: detail.ticket_id ? detail.ticket_id : '-' },
            ]} />
            {detail.description && (
              <div className="mt-4">
                <h4 className="font-display font-semibold text-caption uppercase tracking-wide text-ink-500 mb-2">Uraian</h4>
                <p className="text-body text-ink-600 dark:text-ink-300 whitespace-pre-line">{detail.description}</p>
              </div>)}
          </Section>
        )}
      </Drawer>

      {/* Modal abaikan */}
      <Modal open={ignoreOpen} onClose={() => setIgnoreOpen(false)} title="Abaikan Alarm"
        footer={<><Button variant="outline" onClick={() => setIgnoreOpen(false)}>Batal</Button>
          <Button variant="danger" loading={ignoreSaving} onClick={submitIgnore}>Abaikan {ignoreTargets.length > 1 ? `(${ignoreTargets.length})` : ''}</Button></>}>
        <Field label="Alasan Mengabaikan" required hint="Wajib diisi — akan dicatat pada uraian alarm.">
          <Textarea value={ignoreReason} onChange={(e: any) => setIgnoreReason(e.target.value)} />
        </Field>
      </Modal>

      {/* Modal buat tiket */}
      <Modal open={ticketOpen} onClose={() => setTicketOpen(false)} title="Buat Tiket dari Alarm" size="lg"
        footer={<><Button variant="outline" onClick={() => setTicketOpen(false)}>Batal</Button>
          <Button loading={ticketSaving} onClick={submitBuatTiket}>Buat Tiket</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="No Tiket"><Input value="Otomatis saat disimpan (TKT/…)" disabled /></Field>
          <Field label="Tingkat Keparahan Tiket" required hint="Dipetakan otomatis dari keparahan alarm — dapat disesuaikan.">
            <Select options={TICKET_SEVERITIES} value={ticketForm.severity} onChange={(e: any) => setTicketForm({ ...ticketForm, severity: e.target.value })} />
          </Field>
          <Field label="Cabang" required><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={ticketForm.branch_id} onChange={(e: any) => setTicketForm({ ...ticketForm, branch_id: e.target.value })} /></Field>
          <Field label="Elemen Jaringan"><Select options={elements.map(e => ({ value: e.id, label: `${e.element_type} · ${e.code} — ${e.name}` }))} value={ticketForm.network_element_id} onChange={(e: any) => setTicketForm({ ...ticketForm, network_element_id: e.target.value })} /></Field>
          <Field label="Nama Pelanggan (bila relevan)"><Input value={ticketForm.customer_name} onChange={(e: any) => setTicketForm({ ...ticketForm, customer_name: e.target.value })} /></Field>
          <Field label="Kategori"><Input value={ticketForm.category} onChange={(e: any) => setTicketForm({ ...ticketForm, category: e.target.value })} /></Field>
          <Field label="Sub Kategori"><Input value={ticketForm.sub_category} onChange={(e: any) => setTicketForm({ ...ticketForm, sub_category: e.target.value })} /></Field>
          <Field label="Deskripsi" className="sm:col-span-2"><Textarea value={ticketForm.description} onChange={(e: any) => setTicketForm({ ...ticketForm, description: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
