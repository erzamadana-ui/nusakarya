import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import {
  PageHeader, DataTable, Badge, Button, Modal, ConfirmDialog, FilterBar, KpiCard,
  Select, Input, Money, Field, Section, Checkbox, useToast, Plus, type Column,
} from '@/components/ui'
import { useColumnPicker, MultiValueInput, type ColumnDef } from '@/components/ColumnPicker'
import { rupiah, tgl } from '@/lib/format'
import { STATUS_PENUGASAN_OPTIONS, OBJECT_ID_HINT, objectIdValid } from '../lib/constants'

type Baris = Record<string, any>

const emptyForm = {
  id: null as string | null,
  employee_id: '', object_id: '', position_name: '', position_title: '',
  branch_id: '', psa: '', portofolio: '', group_fungsi: '', sub_group: '',
  nama_program: '', program_ref_id: '', gaji_per_teknisi: 0,
  sto: '', sto_kode: '', sto_ref_id: '', sektor_ditangani: [] as string[],
  status_penugasan: 'DEFINITIF', is_formasi_kosong: false, aktif: true,
  berlaku_mulai: '', berlaku_sampai: '',
}

/** Kunci hasil embed PostgREST — bukan kolom employee_positions, harus dibuang sebelum simpan. */
const BUKAN_KOLOM = ['employees', 'branches', 'company_id', 'created_at', 'updated_at', 'created_by']

const KOLOM_FORMASI: ColumnDef[] = [
  { key: 'object_id', header: 'Object ID', locked: true },
  { key: 'position_name', header: 'Nama Formasi', locked: true },
  { key: 'position_title', header: 'Jabatan' },
  { key: 'karyawan', header: 'Karyawan' },
  { key: 'cabang', header: 'Cabang' },
  { key: 'psa', header: 'PSA' },
  { key: 'portofolio', header: 'Portofolio' },
  { key: 'nama_program', header: 'Program' },
  { key: 'sto', header: 'STO' },
  { key: 'gaji_per_teknisi', header: 'Gaji / Teknisi' },
  { key: 'status_penugasan', header: 'Status Penugasan' },
  { key: 'group_fungsi', header: 'Group Fungsi', defaultVisible: false },
  { key: 'sub_group', header: 'Sub Group', defaultVisible: false },
  { key: 'sektor_ditangani', header: 'Sektor Ditangani', defaultVisible: false },
  { key: 'aktif', header: 'Aktif', defaultVisible: false },
  { key: 'periode', header: 'Periode Berlaku', defaultVisible: false },
]

export default function Formasi() {
  const { profile, can, canMaster } = useAuth()
  const toast = useToast()
  const bolehTulis = canMaster('HR')
  const bolehHapus = canMaster('HR') && can('HR', 'approve')

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Baris[]>([])
  const [branches, setBranches] = useState<Baris[]>([])
  const [employees, setEmployees] = useState<Baris[]>([])
  const [stoRef, setStoRef] = useState<Baris[]>([])
  const [programRef, setProgramRef] = useState<Baris[]>([])

  const [fBranch, setFBranch] = useState(''); const [fPsa, setFPsa] = useState('')
  const [fPorto, setFPorto] = useState(''); const [fPenugasan, setFPenugasan] = useState('')
  const [fTerisi, setFTerisi] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Baris>(emptyForm)
  const [confirmDel, setConfirmDel] = useState<Baris | null>(null)

  const { shown, control } = useColumnPicker('kolom.hr.formasi', KOLOM_FORMASI)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [ep, br, emp, sto, prog] = await Promise.all([
        list<Baris>('employee_positions', {
          select: '*,employees(id,nip,full_name),branches(id,name,code)',
          order: { col: 'object_id', asc: true },
        }),
        list<Baris>('branches', { select: 'id,name,code', order: { col: 'name', asc: true } }),
        list<Baris>('employees', { select: 'id,nip,full_name', order: { col: 'full_name', asc: true } }),
        list<Baris>('sto_ref', { select: 'id,kode,nama,psa', order: { col: 'kode', asc: true } }),
        list<Baris>('program_ref', { select: 'id,nama_program', order: { col: 'nama_program', asc: true } }),
      ])
      setRows(ep); setBranches(br); setEmployees(emp); setStoRef(sto); setProgramRef(prog)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data formasi', 'error') }
    finally { setLoading(false) }
  }

  const terisi = (r: Baris) => !!r.employee_id && !r.is_formasi_kosong

  const psaOptions = useMemo(() => Array.from(new Set(rows.map(r => r.psa).filter(Boolean))).sort(), [rows])
  const portoOptions = useMemo(() => Array.from(new Set(rows.map(r => r.portofolio).filter(Boolean))).sort(), [rows])
  const fungsiSaran = useMemo(() => Array.from(new Set(rows.map(r => r.group_fungsi).filter(Boolean))).sort(), [rows])
  const sektorSaran = useMemo(
    () => Array.from(new Set(rows.flatMap(r => (r.sektor_ditangani ?? []) as string[]).filter(Boolean))).sort(),
    [rows],
  )

  const kpi = useMemo(() => {
    const total = rows.length
    const jmlTerisi = rows.filter(terisi).length
    const hitung = new Map<string, number>()
    rows.filter(terisi).forEach(r => hitung.set(r.employee_id, (hitung.get(r.employee_id) ?? 0) + 1))
    const rangkap = Array.from(hitung.values()).filter(n => n > 1).length
    return { total, terisi: jmlTerisi, kosong: total - jmlTerisi, rangkap }
  }, [rows])

  const filtered = useMemo(() => rows.filter(r =>
    (!fBranch || r.branch_id === fBranch) && (!fPsa || r.psa === fPsa) &&
    (!fPorto || r.portofolio === fPorto) && (!fPenugasan || r.status_penugasan === fPenugasan) &&
    (!fTerisi || (fTerisi === 'terisi' ? terisi(r) : !terisi(r)))
  ), [rows, fBranch, fPsa, fPorto, fPenugasan, fTerisi])

  const adaFilter = fBranch || fPsa || fPorto || fPenugasan || fTerisi
  const resetFilter = () => { setFBranch(''); setFPsa(''); setFPorto(''); setFPenugasan(''); setFTerisi('') }

  function openAdd() { setForm(emptyForm); setModalOpen(true) }
  function openEdit(r: Baris) {
    setForm({
      ...emptyForm, ...r,
      employee_id: r.employee_id ?? '', branch_id: r.branch_id ?? '',
      program_ref_id: r.program_ref_id ?? '', sto_ref_id: r.sto_ref_id ?? '',
      gaji_per_teknisi: r.gaji_per_teknisi ?? 0,
      sektor_ditangani: Array.isArray(r.sektor_ditangani) ? r.sektor_ditangani : [],
      is_formasi_kosong: !!r.is_formasi_kosong, aktif: r.aktif !== false,
      berlaku_mulai: r.berlaku_mulai ?? '', berlaku_sampai: r.berlaku_sampai ?? '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.position_name && !form.position_title) { toast.push('Nama formasi atau jabatan wajib diisi', 'error'); return }
    if (!objectIdValid(form.object_id)) { toast.push(`Object ID tidak sesuai format: ${OBJECT_ID_HINT}`, 'error'); return }
    if (form.berlaku_mulai && form.berlaku_sampai && form.berlaku_sampai < form.berlaku_mulai) {
      toast.push('Tanggal "berlaku sampai" tidak boleh lebih awal dari "berlaku mulai"', 'error'); return
    }
    setSaving(true)
    try {
      const payload: Baris = { ...form }
      BUKAN_KOLOM.forEach(k => { delete payload[k] })
      payload.sektor_ditangani = Array.isArray(form.sektor_ditangani) && form.sektor_ditangani.length ? form.sektor_ditangani : null
      payload.gaji_per_teknisi = Number(form.gaji_per_teknisi) || null
      payload.is_formasi_kosong = !!form.is_formasi_kosong
      payload.aktif = !!form.aktif
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      if (form.id) {
        await update('employee_positions', form.id, payload)
        toast.push('Formasi diperbarui')
      } else {
        await insert('employee_positions', { ...payload, id: undefined, company_id: profile?.company_id, created_by: profile?.id })
        toast.push('Formasi baru ditambahkan')
      }
      setModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan formasi', 'error') }
    finally { setSaving(false) }
  }

  async function hapus() {
    if (!confirmDel) return
    try {
      await remove('employee_positions', confirmDel.id)
      toast.push('Formasi dihapus')
      load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menghapus formasi', 'error') }
    finally { setConfirmDel(null) }
  }

  /** Saat STO dipilih dari referensi, ikut mengisi kode & PSA agar konsisten dengan sto_ref. */
  function pilihSto(id: string) {
    const s = stoRef.find(x => x.id === id)
    setForm((f: Baris) => ({
      ...f, sto_ref_id: id,
      sto: s?.nama ?? f.sto, sto_kode: s?.kode ?? f.sto_kode, psa: s?.psa ?? f.psa,
    }))
  }
  function pilihProgram(id: string) {
    const p = programRef.find(x => x.id === id)
    setForm((f: Baris) => ({ ...f, program_ref_id: id, nama_program: p?.nama_program ?? f.nama_program }))
  }

  /** Cara render tiap kolom; digabung dengan definisi kolom yang sedang ditampilkan. */
  const renderKolom: Record<string, Partial<Column>> = {
    object_id: { width: '170px', render: (r: Baris) => r.object_id ?? '-' },
    position_name: { render: (r: Baris) => r.position_name ?? '-' },
    position_title: { render: (r: Baris) => r.position_title ?? '-' },
    karyawan: {
      sortable: false,
      render: (r: Baris) => (terisi(r)
        ? <span className="text-ink-800">{r.employees?.full_name ?? '-'}<span className="block text-caption text-ink-400">{r.employees?.nip ?? ''}</span></span>
        : <Badge tone="amber">FORMASI KOSONG</Badge>),
    },
    cabang: { sortable: false, render: (r: Baris) => r.branches?.name ?? '-' },
    psa: { render: (r: Baris) => r.psa ?? '-' },
    portofolio: { render: (r: Baris) => r.portofolio ?? '-' },
    nama_program: { render: (r: Baris) => r.nama_program ?? '-' },
    sto: { render: (r: Baris) => ((r.sto || r.sto_kode) ? `${r.sto ?? '-'}${r.sto_kode ? ` (${r.sto_kode})` : ''}` : '-') },
    gaji_per_teknisi: { align: 'right', render: (r: Baris) => rupiah(r.gaji_per_teknisi) },
    status_penugasan: { render: (r: Baris) => (r.status_penugasan ? <Badge tone="teal">{r.status_penugasan}</Badge> : '-') },
    group_fungsi: { render: (r: Baris) => r.group_fungsi ?? '-' },
    sub_group: { render: (r: Baris) => r.sub_group ?? '-' },
    sektor_ditangani: { sortable: false, render: (r: Baris) => ((r.sektor_ditangani ?? []) as string[]).join(', ') || '-' },
    aktif: { render: (r: Baris) => <Badge tone={r.aktif ? 'emerald' : 'slate'}>{r.aktif ? 'Aktif' : 'Nonaktif'}</Badge> },
    periode: { sortable: false, render: (r: Baris) => `${r.berlaku_mulai ? tgl(r.berlaku_mulai) : '-'} s/d ${r.berlaku_sampai ? tgl(r.berlaku_sampai) : '-'}` },
  }
  const kolomTampil: Column[] = KOLOM_FORMASI
    .filter(c => shown.has(c.key))
    .map(c => ({ key: c.key, header: c.header, ...renderKolom[c.key] }))

  return (
    <div>
      <PageHeader title="Formasi & Jabatan" subtitle="Daftar formasi (OBJECT ID) dan karyawan yang memegangnya"
        actions={bolehTulis && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Formasi</Button>} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label="Total Formasi" value={kpi.total} tone="teal" />
        <KpiCard label="Formasi Terisi" value={kpi.terisi} tone="emerald"
          sub={kpi.total ? `${Math.round((kpi.terisi / kpi.total) * 100)}% dari total` : undefined} />
        <KpiCard label="Formasi Kosong" value={kpi.kosong} tone="amber" />
        <KpiCard label="Karyawan Rangkap Formasi" value={kpi.rangkap} tone="slate" sub="memegang lebih dari satu formasi" />
      </div>

      <FilterBar>
        <Field label="Cabang" className="w-48"><Select value={fBranch} onChange={(e: any) => setFBranch(e.target.value)} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="Semua cabang" /></Field>
        <Field label="PSA" className="w-40"><Select value={fPsa} onChange={(e: any) => setFPsa(e.target.value)} options={psaOptions} placeholder="Semua PSA" /></Field>
        <Field label="Portofolio" className="w-44"><Select value={fPorto} onChange={(e: any) => setFPorto(e.target.value)} options={portoOptions} placeholder="Semua portofolio" /></Field>
        <Field label="Status Penugasan" className="w-44"><Select value={fPenugasan} onChange={(e: any) => setFPenugasan(e.target.value)} options={STATUS_PENUGASAN_OPTIONS} placeholder="Semua" /></Field>
        <Field label="Keterisian" className="w-40">
          <Select value={fTerisi} onChange={(e: any) => setFTerisi(e.target.value)} placeholder="Semua"
            options={[{ value: 'terisi', label: 'Terisi' }, { value: 'kosong', label: 'Formasi Kosong' }]} />
        </Field>
        {adaFilter && <Button variant="ghost" size="sm" onClick={resetFilter}>Reset</Button>}
      </FilterBar>

      <DataTable
        loading={loading}
        rows={filtered}
        toolbar={control}
        searchKeys={['object_id', 'position_name', 'position_title', 'psa', 'portofolio', 'nama_program', 'sto', 'sto_kode']}
        exportName="formasi-jabatan"
        emptyTitle="Belum ada formasi"
        emptyMessage="Data formasi belum diisi. Tambahkan manual atau impor dari berkas WFP."
        onRowClick={bolehTulis ? openEdit : undefined}
        rowActions={bolehTulis ? (r: Baris) => [
          { label: 'Ubah', onClick: () => openEdit(r) },
          ...(bolehHapus ? [{ label: 'Hapus', danger: true, onClick: () => setConfirmDel(r) }] : []),
        ] : undefined}
        columns={kolomTampil}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="lg"
        title={form.id ? 'Ubah Formasi' : 'Tambah Formasi'}
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <Section title="Identitas Formasi">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Object ID" hint={OBJECT_ID_HINT} error={!objectIdValid(form.object_id) && 'Format Object ID tidak sesuai'}>
              <Input value={form.object_id} onChange={(e: any) => setForm({ ...form, object_id: e.target.value })} />
            </Field>
            <Field label="Nama Formasi" className="sm:col-span-2"><Input value={form.position_name} onChange={(e: any) => setForm({ ...form, position_name: e.target.value })} /></Field>
            <Field label="Jabatan (Position Title)" className="sm:col-span-2"><Input value={form.position_title} onChange={(e: any) => setForm({ ...form, position_title: e.target.value })} /></Field>
            <Field label="Status Penugasan"><Select value={form.status_penugasan} onChange={(e: any) => setForm({ ...form, status_penugasan: e.target.value })} options={STATUS_PENUGASAN_OPTIONS} /></Field>
            <Field label="Karyawan Pemegang" className="sm:col-span-2" hint="Kosongkan bila formasi belum terisi.">
              <Select value={form.employee_id} onChange={(e: any) => setForm({ ...form, employee_id: e.target.value })}
                placeholder="— belum terisi —"
                options={employees.map(e => ({ value: e.id, label: `${e.full_name} (${e.nip})` }))} />
            </Field>
            <div className="flex items-end gap-4 h-11">
              <Checkbox label="Formasi kosong" checked={!!form.is_formasi_kosong} onChange={(e: any) => setForm({ ...form, is_formasi_kosong: e.target.checked })} />
              <Checkbox label="Aktif" checked={!!form.aktif} onChange={(e: any) => setForm({ ...form, aktif: e.target.checked })} />
            </div>
          </div>
        </Section>
        <Section title="Penempatan">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Cabang"><Select value={form.branch_id} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} options={branches.map(b => ({ value: b.id, label: b.name }))} /></Field>
            <Field label="PSA"><Input value={form.psa} onChange={(e: any) => setForm({ ...form, psa: e.target.value })} /></Field>
            <Field label="Portofolio"><Input value={form.portofolio} onChange={(e: any) => setForm({ ...form, portofolio: e.target.value })} /></Field>
            <Field label="Group Fungsi">
              <Input list="saran-group-fungsi" value={form.group_fungsi} onChange={(e: any) => setForm({ ...form, group_fungsi: e.target.value })} />
            </Field>
            <Field label="Sub Group"><Input value={form.sub_group} onChange={(e: any) => setForm({ ...form, sub_group: e.target.value })} /></Field>
            <div />
            <Field label="STO (referensi)" hint="Memilih STO ikut mengisi nama, kode, dan PSA.">
              <Select value={form.sto_ref_id} onChange={(e: any) => pilihSto(e.target.value)}
                options={stoRef.map(s => ({ value: s.id, label: `${s.kode} — ${s.nama}` }))} />
            </Field>
            <Field label="Nama STO"><Input value={form.sto} onChange={(e: any) => setForm({ ...form, sto: e.target.value })} /></Field>
            <Field label="Kode STO"><Input value={form.sto_kode} onChange={(e: any) => setForm({ ...form, sto_kode: e.target.value })} /></Field>
            <Field label="Sektor Ditangani" className="sm:col-span-3" hint="Tekan Enter untuk menambah nilai.">
              <MultiValueInput value={form.sektor_ditangani ?? []} suggestions={sektorSaran}
                onChange={(v) => setForm({ ...form, sektor_ditangani: v })} />
            </Field>
          </div>
          <datalist id="saran-group-fungsi">
            {fungsiSaran.map(g => <option key={g as string} value={g as string} />)}
          </datalist>
        </Section>
        <Section title="Program & Biaya">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Program (referensi)">
              <Select value={form.program_ref_id} onChange={(e: any) => pilihProgram(e.target.value)}
                options={programRef.map(p => ({ value: p.id, label: p.nama_program }))} />
            </Field>
            <Field label="Nama Program" className="sm:col-span-2"><Input value={form.nama_program} onChange={(e: any) => setForm({ ...form, nama_program: e.target.value })} /></Field>
            <Field label="Gaji per Teknisi"><Money value={form.gaji_per_teknisi} onChange={(v: number) => setForm({ ...form, gaji_per_teknisi: v })} /></Field>
            <Field label="Berlaku Mulai"><Input type="date" value={form.berlaku_mulai} onChange={(e: any) => setForm({ ...form, berlaku_mulai: e.target.value })} /></Field>
            <Field label="Berlaku Sampai"><Input type="date" value={form.berlaku_sampai} onChange={(e: any) => setForm({ ...form, berlaku_sampai: e.target.value })} /></Field>
          </div>
        </Section>
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={hapus} danger
        title="Hapus Formasi" confirmLabel="Ya, Hapus"
        message={`Formasi "${confirmDel?.position_name ?? confirmDel?.object_id ?? ''}" akan dihapus permanen. Lanjutkan?`} />
    </div>
  )
}
