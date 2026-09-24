import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListTodo, AlarmClock, CalendarClock, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { list, update } from '@/lib/db'
import supabase from '@/lib/supabase'
import { ALL_ITEMS } from '@/lib/nav'
import { tgl, tglJam, num } from '@/lib/format'
import {
  PageHeader, KpiCard, DataTable, FilterBar, Field, Select, Input, Textarea, Button,
  Drawer, Modal, Badge, Desc, Section, Skeleton, useToast,
} from '@/components/ui'
import {
  MODUL_INBOX, modulLabel, jenisLabel, JENIS_LABEL, prioritasLabel, prioritasTone,
  statusLabel, statusTone, STATUS_AKTIF, KETERLAMBATAN_TONE, keterlambatanLabel, pesanGalat,
} from '../lib/constants'

/** Satu baris view v_inbox_kerja. */
type TugasInbox = {
  id: string
  company_id: string
  modul: string
  jenis: string
  entity_type: string | null
  entity_id: string | null
  judul: string
  keterangan: string | null
  route_path: string | null
  pic_employee_id: string | null
  nama_pic: string | null
  pic_role: string | null
  branch_id: string | null
  nama_cabang: string | null
  eskalasi_role: string | null
  jatuh_tempo: string | null
  prioritas: string
  status: string
  selesai_at: string | null
  selesai_by: string | null
  nama_penyelesai: string | null
  catatan_penyelesaian: string | null
  ditutup_otomatis: boolean
  sumber: string
  created_at: string
  updated_at: string
  hari_terlambat: number | null
  keterlambatan: string | null
}

/** Ringkasan satu baris hasil fn_bangun_inbox_kerja(). */
type RingkasanBangun = { modul: string; jenis: string; dibuat: number; diperbarui: number; ditutup: number }

const TAB = { saya: 'saya', unit: 'unit', terlambat: 'terlambat', selesai: 'selesai' } as const
type TabKey = typeof TAB[keyof typeof TAB]

const kosongFilter = { modul: '', jenis: '', prioritas: '', cabang: '', dari: '', sampai: '', cari: '' }

/** Path yang benar-benar terdaftar di menu — dipakai memvalidasi route_path. */
const PATH_TERDAFTAR = new Set(ALL_ITEMS.map(i => i.path))

export default function InboxKerja() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const nav = useNavigate()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<TugasInbox[]>([])
  const [tab, setTab] = useState<TabKey>(TAB.saya)
  const [f, setF] = useState({ ...kosongFilter })

  const [selected, setSelected] = useState<TugasInbox | null>(null)
  const [selesaiOpen, setSelesaiOpen] = useState(false)
  const [catatan, setCatatan] = useState('')
  const [aksiBusy, setAksiBusy] = useState(false)
  const [segarBusy, setSegarBusy] = useState(false)

  /** Tombol pemindaian ulang: generator menyentuh HR, PRODUCTIVITY, OPERATIONS,
   *  DEPLOYMENT, PROCUREMENT, FINANCE dan INVENTORY. Cukup punya hak tulis pada
   *  salah satu modul itu untuk boleh menjalankannya. */
  const bolehSegarkan = useMemo(
    () => MODUL_INBOX.some(m => can(m, 'write')),
    [profile, can])

  useEffect(() => { if (profile?.company_id) muat() }, [profile?.company_id])

  async function muat() {
    setLoading(true)
    try {
      const data = await list<TugasInbox>('v_inbox_kerja', {
        order: { col: 'jatuh_tempo', asc: true },
        limit: 2000,
      })
      setRows(data)
    } catch (e: any) {
      toast.push(e?.message ?? 'Gagal memuat inbox kerja', 'error')
    } finally {
      setLoading(false)
    }
  }

  /** Tugas yang PIC-nya saya sendiri (orangnya) atau peran saya. */
  const milikSaya = (r: TugasInbox) =>
    (!!profile?.employee_id && r.pic_employee_id === profile.employee_id) ||
    (!!profile?.role && r.pic_role === profile.role)

  const aktif = (r: TugasInbox) => STATUS_AKTIF.includes(r.status)

  /* ---------------- KPI ---------------- */
  const kpi = useMemo(() => {
    const awalBulan = new Date(); awalBulan.setDate(1); awalBulan.setHours(0, 0, 0, 0)
    return {
      saya: rows.filter(r => aktif(r) && milikSaya(r)).length,
      terlambat: rows.filter(r => aktif(r) && r.keterlambatan === 'terlambat').length,
      segera: rows.filter(r => aktif(r) && r.keterlambatan === 'segera').length,
      selesaiBulanIni: rows.filter(r =>
        r.status === 'selesai' && r.selesai_at && new Date(r.selesai_at) >= awalBulan).length,
    }
  }, [rows, profile?.employee_id, profile?.role])

  /* ---------------- Tab ---------------- */
  const dasar = useMemo(() => {
    switch (tab) {
      // Tugas Saya / Unit Saya hanya memuat pekerjaan yang masih menuntut tindakan.
      case TAB.saya: return rows.filter(r => aktif(r) && milikSaya(r))
      case TAB.unit: return rows.filter(r => aktif(r))
      case TAB.terlambat: return rows.filter(r => aktif(r) && r.keterlambatan === 'terlambat')
      case TAB.selesai: return rows.filter(r => r.status === 'selesai')
      default: return rows
    }
  }, [rows, tab, profile?.employee_id, profile?.role])

  const tabs = useMemo(() => [
    { value: TAB.saya, label: 'Tugas Saya', count: rows.filter(r => aktif(r) && milikSaya(r)).length },
    { value: TAB.unit, label: 'Unit Saya', count: rows.filter(r => aktif(r)).length },
    { value: TAB.terlambat, label: 'Terlambat', count: rows.filter(r => aktif(r) && r.keterlambatan === 'terlambat').length },
    { value: TAB.selesai, label: 'Selesai', count: rows.filter(r => r.status === 'selesai').length },
  ], [rows, profile?.employee_id, profile?.role])

  /* ---------------- Pilihan filter (diturunkan dari data yang terlihat) ---------------- */
  const opsiModul = useMemo(() => {
    const ada = Array.from(new Set(rows.map(r => r.modul))).sort()
    return ada.map(m => ({ value: m, label: modulLabel(m) }))
  }, [rows])
  const opsiJenis = useMemo(() => {
    const ada = Array.from(new Set(rows.map(r => r.jenis)))
    return ada.sort((a, b) => jenisLabel(a).localeCompare(jenisLabel(b), 'id'))
      .map(j => ({ value: j, label: JENIS_LABEL[j] ?? jenisLabel(j) }))
  }, [rows])
  const opsiCabang = useMemo(() => {
    const peta = new Map<string, string>()
    rows.forEach(r => { if (r.branch_id) peta.set(r.branch_id, r.nama_cabang ?? 'Tanpa nama') })
    return Array.from(peta, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'id'))
  }, [rows])

  /* ---------------- Filter ---------------- */
  const tersaring = useMemo(() => {
    const cari = f.cari.trim().toLowerCase()
    return dasar.filter(r => {
      if (f.modul && r.modul !== f.modul) return false
      if (f.jenis && r.jenis !== f.jenis) return false
      if (f.prioritas && r.prioritas !== f.prioritas) return false
      if (f.cabang && r.branch_id !== f.cabang) return false
      if (f.dari && (!r.jatuh_tempo || r.jatuh_tempo < f.dari)) return false
      if (f.sampai && (!r.jatuh_tempo || r.jatuh_tempo > f.sampai)) return false
      if (cari && !String(r.judul ?? '').toLowerCase().includes(cari)) return false
      return true
    })
  }, [dasar, f])

  const adaFilter = Object.values(f).some(v => v !== '')

  /* ---------------- Aksi ---------------- */
  async function segarkan() {
    setSegarBusy(true)
    try {
      const { data, error } = await supabase.rpc('fn_bangun_inbox_kerja', { p_company_id: profile!.company_id })
      if (error) throw error
      const ringkas = (data ?? []) as RingkasanBangun[]
      const dibuat = ringkas.reduce((s, r) => s + Number(r.dibuat ?? 0), 0)
      const diperbarui = ringkas.reduce((s, r) => s + Number(r.diperbarui ?? 0), 0)
      const ditutup = ringkas.reduce((s, r) => s + Number(r.ditutup ?? 0), 0)
      await muat()
      toast.push(
        `Pemindaian selesai — ${num(dibuat)} tugas dibuat, ${num(diperbarui)} diperbarui, ${num(ditutup)} ditutup otomatis.`,
        'success')
    } catch (e: any) {
      toast.push(pesanGalat(e, 'segarkan', 'Gagal menyegarkan daftar tugas'), 'error')
    } finally {
      setSegarBusy(false)
    }
  }

  async function tandaiDikerjakan(row: TugasInbox) {
    setAksiBusy(true)
    try {
      await update('inbox_tugas', row.id, { status: 'dikerjakan', updated_at: new Date().toISOString() })
      toast.push('Tugas ditandai sedang dikerjakan', 'success')
      await muat()
      setSelected(s => (s && s.id === row.id ? { ...s, status: 'dikerjakan' } : s))
    } catch (e: any) {
      toast.push(pesanGalat(e, 'dikerjakan', 'Gagal mengubah status tugas'), 'error')
    } finally {
      setAksiBusy(false)
    }
  }

  async function tandaiSelesai() {
    if (!selected) return
    setAksiBusy(true)
    try {
      const { data, error } = await supabase.rpc('fn_selesaikan_tugas_inbox', {
        p_id: selected.id,
        p_catatan: catatan.trim() || null,
      })
      if (error) throw error
      const hasil = (data ?? {}) as { pesan?: string }
      toast.push(hasil.pesan ?? 'Tugas ditandai selesai', 'success')
      setSelesaiOpen(false); setCatatan(''); setSelected(null)
      await muat()
    } catch (e: any) {
      toast.push(pesanGalat(e, 'selesai', 'Gagal menyelesaikan tugas'), 'error')
    } finally {
      setAksiBusy(false)
    }
  }

  const rutePunyaHalaman = !!selected?.route_path && PATH_TERDAFTAR.has(selected.route_path)

  return (
    <div>
      <PageHeader
        title="Inbox Kerja"
        subtitle="Daftar pekerjaan yang belum lengkap di seluruh unit, lengkap dengan PIC dan tenggatnya"
        actions={bolehSegarkan && (
          <Button icon={<RefreshCw size={16} />} loading={segarBusy} onClick={segarkan}>
            Segarkan Daftar Tugas
          </Button>)} />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-md" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <KpiCard label="Total Tugas Saya" value={num(kpi.saya)} sub="PIC saya, belum selesai"
            icon={<ListTodo size={16} />} tone="teal" onClick={() => setTab(TAB.saya)} />
          <KpiCard label="Terlambat" value={num(kpi.terlambat)} sub="Seluruh unit, lewat tenggat"
            icon={<AlarmClock size={16} />} tone="red" onClick={() => setTab(TAB.terlambat)} />
          <KpiCard label="Jatuh Tempo ≤3 Hari" value={num(kpi.segera)} sub="Seluruh unit, segera jatuh tempo"
            icon={<CalendarClock size={16} />} tone="amber" />
          <KpiCard label="Selesai Bulan Ini" value={num(kpi.selesaiBulanIni)} sub="Termasuk yang ditutup otomatis"
            icon={<CheckCircle2 size={16} />} tone="emerald" onClick={() => setTab(TAB.selesai)} />
        </div>
      )}

      <FilterBar>
        <Field label="Modul" className="min-w-[170px]">
          <Select options={opsiModul} value={f.modul} placeholder="Semua modul"
            onChange={(e: any) => setF({ ...f, modul: e.target.value })} />
        </Field>
        <Field label="Jenis Pekerjaan" className="min-w-[230px]">
          <Select options={opsiJenis} value={f.jenis} placeholder="Semua jenis"
            onChange={(e: any) => setF({ ...f, jenis: e.target.value })} />
        </Field>
        <Field label="Prioritas" className="min-w-[140px]">
          <Select value={f.prioritas} placeholder="Semua prioritas"
            options={[{ value: 'tinggi', label: 'Tinggi' }, { value: 'sedang', label: 'Sedang' }, { value: 'rendah', label: 'Rendah' }]}
            onChange={(e: any) => setF({ ...f, prioritas: e.target.value })} />
        </Field>
        <Field label="Cabang" className="min-w-[170px]">
          <Select options={opsiCabang} value={f.cabang} placeholder="Semua cabang"
            onChange={(e: any) => setF({ ...f, cabang: e.target.value })} />
        </Field>
        <Field label="Jatuh Tempo Dari" className="min-w-[150px]">
          <Input type="date" value={f.dari} onChange={(e: any) => setF({ ...f, dari: e.target.value })} />
        </Field>
        <Field label="Sampai" className="min-w-[150px]">
          <Input type="date" value={f.sampai} onChange={(e: any) => setF({ ...f, sampai: e.target.value })} />
        </Field>
        <Field label="Cari Judul" className="min-w-[200px] flex-1">
          <Input placeholder="Ketik sebagian judul tugas…" value={f.cari}
            onChange={(e: any) => setF({ ...f, cari: e.target.value })} />
        </Field>
        {adaFilter && <Button variant="outline" onClick={() => setF({ ...kosongFilter })}>Bersihkan</Button>}
      </FilterBar>

      <DataTable
        loading={loading}
        rows={tersaring}
        onRowClick={(r: TugasInbox) => setSelected(r)}
        searchable={false}
        exportName="inbox-kerja"
        tabs={tabs}
        activeTab={tab}
        onTab={(v: string) => setTab(v as TabKey)}
        emptyTitle={tab === TAB.saya ? 'Tidak ada tugas untuk Anda' : 'Tidak ada tugas'}
        emptyMessage={adaFilter
          ? 'Tidak ada tugas yang cocok dengan filter. Ubah atau bersihkan filter.'
          : 'Tugas akan muncul di sini setelah pemindaian inbox dijalankan.'}
        columns={[
          {
            key: 'prioritas', header: 'Prioritas', width: '110px',
            render: (r: TugasInbox) => <Badge tone={prioritasTone(r.prioritas)}>{prioritasLabel(r.prioritas)}</Badge>,
          },
          {
            key: 'judul', header: 'Judul',
            render: (r: TugasInbox) => (
              <div className="min-w-[240px]">
                <p className="text-body text-ink-800">{r.judul}</p>
                <p className="text-caption text-ink-400">{jenisLabel(r.jenis)}</p>
              </div>),
          },
          { key: 'modul', header: 'Modul', render: (r: TugasInbox) => modulLabel(r.modul) },
          { key: 'nama_pic', header: 'PIC', render: (r: TugasInbox) => r.nama_pic ?? (r.pic_role ? `Peran: ${r.pic_role}` : '-') },
          { key: 'nama_cabang', header: 'Cabang', render: (r: TugasInbox) => r.nama_cabang ?? '-' },
          { key: 'jatuh_tempo', header: 'Jatuh Tempo', render: (r: TugasInbox) => tgl(r.jatuh_tempo) },
          {
            key: 'keterlambatan', header: 'Keterlambatan',
            render: (r: TugasInbox) => (
              <Badge className="normal-case" tone={KETERLAMBATAN_TONE[r.keterlambatan ?? 'aman'] ?? 'slate'}>
                {keterlambatanLabel(r.keterlambatan, r.hari_terlambat)}
              </Badge>),
          },
          { key: 'status', header: 'Status', render: (r: TugasInbox) => <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge> },
        ]}
      />

      {/* -------- Drawer detail tugas -------- */}
      <Drawer
        open={!!selected} onClose={() => setSelected(null)} width="max-w-xl"
        title={selected?.judul ?? ''}
        footer={selected && (
          <div className="flex flex-wrap gap-2 w-full justify-end">
            {selected.route_path && (
              <Button variant="outline" icon={<ExternalLink size={15} />} disabled={!rutePunyaHalaman}
                onClick={() => { const p = selected.route_path!; setSelected(null); nav(p) }}>
                Buka Halaman Terkait
              </Button>)}
            {selected.status === 'terbuka' && (
              <Button variant="secondary" loading={aksiBusy} onClick={() => tandaiDikerjakan(selected)}>
                Tandai Dikerjakan
              </Button>)}
            {STATUS_AKTIF.includes(selected.status) && (
              <Button variant="success" onClick={() => { setCatatan(''); setSelesaiOpen(true) }}>
                Tandai Selesai
              </Button>)}
          </div>)}>
        {selected && (
          <div>
            <Section>
              <Desc cols={2} items={[
                { label: 'Status', value: <Badge tone={statusTone(selected.status)}>{statusLabel(selected.status)}</Badge> },
                { label: 'Prioritas', value: <Badge tone={prioritasTone(selected.prioritas)}>{prioritasLabel(selected.prioritas)}</Badge> },
                { label: 'Modul', value: modulLabel(selected.modul) },
                { label: 'Jenis Pekerjaan', value: jenisLabel(selected.jenis) },
                { label: 'PIC', value: selected.nama_pic ?? (selected.pic_role ? `Peran: ${selected.pic_role}` : '-') },
                { label: 'Eskalasi ke Peran', value: selected.eskalasi_role ?? '-' },
                { label: 'Cabang', value: selected.nama_cabang ?? '-' },
                { label: 'Jatuh Tempo', value: tgl(selected.jatuh_tempo) },
                {
                  label: 'Keterlambatan',
                  value: (
                    <Badge className="normal-case" tone={KETERLAMBATAN_TONE[selected.keterlambatan ?? 'aman'] ?? 'slate'}>
                      {keterlambatanLabel(selected.keterlambatan, selected.hari_terlambat)}
                    </Badge>),
                },
                { label: 'Sumber Tugas', value: selected.sumber === 'otomatis' ? 'Dibuat otomatis oleh pemindaian' : 'Dibuat manual' },
                { label: 'Dibuat', value: tglJam(selected.created_at) },
                { label: 'Pembaruan Terakhir', value: tglJam(selected.updated_at) },
              ]} />
            </Section>

            <Section title="Keterangan">
              <p className="text-body text-ink-700 whitespace-pre-line">{selected.keterangan || 'Tidak ada keterangan tambahan.'}</p>
            </Section>

            {selected.route_path && (
              <Section title="Halaman Terkait">
                <p className="text-body text-ink-600">{selected.route_path}</p>
                {!rutePunyaHalaman && (
                  <p className="text-caption text-red-600 mt-1">
                    Halaman ini belum terdaftar di menu panel, jadi tautannya dinonaktifkan.
                  </p>)}
              </Section>)}

            {selected.status === 'selesai' && (
              <Section title="Penyelesaian">
                <Desc cols={2} items={[
                  { label: 'Diselesaikan Pada', value: tglJam(selected.selesai_at) },
                  {
                    label: 'Diselesaikan Oleh',
                    value: selected.ditutup_otomatis ? 'Ditutup otomatis oleh sistem' : (selected.nama_penyelesai ?? '-'),
                  },
                  { label: 'Catatan Penyelesaian', value: selected.catatan_penyelesaian ?? '-' },
                ]} />
              </Section>)}
          </div>)}
      </Drawer>

      {/* -------- Modal catatan penyelesaian -------- */}
      <Modal
        open={selesaiOpen} onClose={() => setSelesaiOpen(false)} size="sm"
        title="Tandai Tugas Selesai"
        subtitle={selected?.judul}
        footer={<>
          <Button variant="outline" onClick={() => setSelesaiOpen(false)}>Batal</Button>
          <Button variant="success" loading={aksiBusy} onClick={tandaiSelesai}>Tandai Selesai</Button>
        </>}>
        <Field label="Catatan Penyelesaian"
          hint="Opsional, tetapi sangat membantu pemeriksaan berikutnya. Tuliskan apa yang sudah dikerjakan.">
          <Textarea value={catatan} onChange={(e: any) => setCatatan(e.target.value)}
            placeholder="Contoh: Data NIP dan tanggal bergabung sudah dilengkapi pada 18 Sep 2026." />
        </Field>
      </Modal>
    </div>
  )
}
