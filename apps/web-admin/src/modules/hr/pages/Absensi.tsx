import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, update, signedUrl } from '@/lib/db'
import {
  PageHeader, DataTable, Badge, Button, Modal, Field, Select, Input, FilterBar,
  KpiCard, useToast,
} from '@/components/ui'
import { tgl, tglJam, todayISO } from '@/lib/format'
import { mapsLink } from '../lib/constants'
import { MapPin, Image as ImageIcon } from 'lucide-react'

function PhotoThumb({ path, onZoom }: { path?: string | null; onZoom: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let alive = true; if (path) signedUrl(path).then(u => { if (alive) setUrl(u) }); return () => { alive = false } }, [path])
  if (!path) return <span className="text-ink-300">-</span>
  if (!url) return <div className="w-9 h-9 rounded-sm bg-ink-100 dark:bg-ink-800 grid place-items-center"><ImageIcon size={14} className="text-ink-400" /></div>
  return <img src={url} onClick={() => onZoom(url)} className="w-9 h-9 rounded-sm object-cover cursor-zoom-in border border-ink-200 dark:border-ink-700" />
}

export default function Absensi() {
  const { can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [start, setStart] = useState(() => todayISO().slice(0, 8) + '01')
  const [end, setEnd] = useState(todayISO())
  const [branch, setBranch] = useState('')
  const [zoom, setZoom] = useState<string | null>(null)
  const [koreksi, setKoreksi] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [start, end])

  async function load() {
    setLoading(true)
    try {
      const [att, br] = await Promise.all([
        list<any>('attendances', { select: '*,employees(full_name,branch_id,branches(name))', gte: { work_date: start }, lte: { work_date: end }, order: { col: 'work_date', asc: false } }),
        list<any>('branches', { select: 'id,name', order: { col: 'name', asc: true } }),
      ])
      setRows(att); setBranches(br)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data absensi', 'error') }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => rows.filter(r => !branch || r.employees?.branch_id === branch), [rows, branch])
  const kpi = useMemo(() => ({
    hadir: filtered.filter(r => r.status === 'hadir').length,
    terlambat: filtered.filter(r => r.status === 'terlambat' || (r.late_minutes ?? 0) > 0).length,
    alpa: filtered.filter(r => r.status === 'alpa').length,
    cuti: filtered.filter(r => r.status === 'cuti' || r.status === 'izin').length,
  }), [filtered])

  function openKoreksi(r: any) {
    setKoreksi({ ...r, check_in_time: r.check_in_at ? r.check_in_at.slice(11, 16) : '', check_out_time: r.check_out_at ? r.check_out_at.slice(11, 16) : '' })
  }
  async function simpanKoreksi() {
    setSaving(true)
    try {
      const payload: any = {
        status: koreksi.status, late_minutes: Number(koreksi.late_minutes) || 0, note: koreksi.note || null,
        check_in_at: koreksi.check_in_time ? `${koreksi.work_date}T${koreksi.check_in_time}:00` : null,
        check_out_at: koreksi.check_out_time ? `${koreksi.work_date}T${koreksi.check_out_time}:00` : null,
      }
      await update('attendances', koreksi.id, payload)
      toast.push('Koreksi absensi disimpan'); setKoreksi(null); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan koreksi', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Absensi Lapangan" subtitle="Rekap kehadiran karyawan per tanggal dan cabang" />

      <FilterBar>
        <Field label="Dari Tanggal"><Input type="date" value={start} onChange={(e: any) => setStart(e.target.value)} /></Field>
        <Field label="Sampai Tanggal"><Input type="date" value={end} onChange={(e: any) => setEnd(e.target.value)} /></Field>
        <Field label="Cabang" className="w-48"><Select value={branch} onChange={(e: any) => setBranch(e.target.value)} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="Semua cabang" /></Field>
      </FilterBar>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label="Hadir" value={kpi.hadir} tone="emerald" />
        <KpiCard label="Terlambat" value={kpi.terlambat} tone="orange" />
        <KpiCard label="Alpa" value={kpi.alpa} tone="red" />
        <KpiCard label="Cuti/Izin" value={kpi.cuti} tone="amber" />
      </div>

      <DataTable
        loading={loading} rows={filtered} searchKeys={['status']} exportName="rekap-absensi"
        emptyTitle="Belum ada data absensi pada rentang ini"
        columns={[
          { key: 'nama', header: 'Nama', render: r => r.employees?.full_name ?? '-' },
          { key: 'cabang', header: 'Cabang', render: r => r.employees?.branches?.name ?? '-' },
          { key: 'work_date', header: 'Tanggal', render: r => tgl(r.work_date) },
          { key: 'check_in_at', header: 'Jam Masuk', render: r => r.check_in_at ? r.check_in_at.slice(11, 16) : '-' },
          { key: 'check_out_at', header: 'Jam Keluar', render: r => r.check_out_at ? r.check_out_at.slice(11, 16) : '-' },
          { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
          { key: 'late_minutes', header: 'Terlambat', align: 'right', render: r => `${r.late_minutes ?? 0} mnt` },
          { key: 'lokasi', header: 'Lokasi', render: r => { const link = mapsLink(r.check_in_lat, r.check_in_lng); return link
            ? <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-300 hover:underline"><MapPin size={13} />Peta</a>
            : <span className="text-ink-300">-</span> } },
          { key: 'foto', header: 'Selfie', align: 'center', render: r => <PhotoThumb path={r.check_in_photo_url} onZoom={setZoom} /> },
          ...(can('HR', 'approve') ? [{ key: 'aksi', header: 'Aksi', align: 'center' as const, sortable: false, render: (r: any) => <Button size="sm" variant="outline" onClick={(e: any) => { e.stopPropagation(); openKoreksi(r) }}>Koreksi</Button> }] : []),
        ]}
      />

      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Foto Selfie Absensi" size="sm">
        {zoom && <img src={zoom} className="w-full rounded-md" />}
      </Modal>

      <Modal open={!!koreksi} onClose={() => setKoreksi(null)} title="Koreksi Absensi Manual"
        footer={<><Button variant="outline" onClick={() => setKoreksi(null)}>Batal</Button><Button loading={saving} onClick={simpanKoreksi}>Simpan</Button></>}>
        {koreksi && <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Karyawan" className="sm:col-span-2"><Input value={koreksi.employees?.full_name ?? '-'} disabled /></Field>
          <Field label="Jam Masuk"><Input type="time" value={koreksi.check_in_time} onChange={(e: any) => setKoreksi({ ...koreksi, check_in_time: e.target.value })} /></Field>
          <Field label="Jam Keluar"><Input type="time" value={koreksi.check_out_time} onChange={(e: any) => setKoreksi({ ...koreksi, check_out_time: e.target.value })} /></Field>
          <Field label="Status"><Select value={koreksi.status ?? ''} onChange={(e: any) => setKoreksi({ ...koreksi, status: e.target.value })} options={['hadir', 'terlambat', 'alpa', 'cuti', 'izin', 'dinas']} /></Field>
          <Field label="Terlambat (menit)"><Input type="number" value={koreksi.late_minutes ?? 0} onChange={(e: any) => setKoreksi({ ...koreksi, late_minutes: e.target.value })} /></Field>
          <Field label="Catatan Koreksi" className="sm:col-span-2"><Input value={koreksi.note ?? ''} onChange={(e: any) => setKoreksi({ ...koreksi, note: e.target.value })} /></Field>
        </div>}
      </Modal>
    </div>
  )
}
