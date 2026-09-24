import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import {
  PageHeader, Card, DataTable, Badge, Button, Modal, Drawer, ConfirmDialog, FilterBar,
  Select, Input, Field, Section, Desc, Tabs, TableSkeleton, EmptyState, Checkbox, useToast, Plus,
  type Column,
} from '@/components/ui'
import { useColumnPicker, MultiValueInput, type ColumnDef } from '@/components/ColumnPicker'
import { tgl, todayISO, rupiah } from '@/lib/format'
import {
  EMPLOYMENT_TYPE_OPTIONS, EMPLOYEE_STATUS_OPTIONS, GENDER_OPTIONS, PTKP_OPTIONS, TER_CATEGORY_OPTIONS,
  KEMITRAAN_OPTIONS, GROUP_WFP_OPTIONS, STATUS_TEKNISI_OPTIONS, STATUS_SALARY_OPTIONS,
  PAYROLL_SCHEME_OPTIONS, LEVEL_JABATAN_SARAN, SKILL_SARAN, expiryTone,
} from '../lib/constants'
import { useFieldKustom, InputFieldKustom, kolomFieldKustom, periksaFieldKustom } from '@/lib/konfigurasi'

/** Bentuk awal form — satu kunci per kolom tabel employees yang boleh diisi pengguna. */
const emptyForm = {
  id: null, nip: '', full_name: '', gender: 'L', birth_date: '', phone: '', email: '', address: '',
  branch_id: '', position: '', unit: '', employment_type: 'PKWTT', join_date: todayISO(),
  contract_start: '', contract_end: '', status: 'aktif', ptkp_status: 'TK/0', ter_category: 'A',
  npwp: '', nik_ktp: '', bank_name: '', bank_account: '', bank_holder: '', bpjs_tk_no: '', bpjs_kes_no: '',
  payroll_scheme: 'fix_salary',
  nik_telkom: '', kemitraan: '', group_wfp: '', level_jabatan: '', skill: [] as string[],
  status_teknisi: '', status_salary: '',
}

/** Kunci bantu yang menempel di baris tabel tapi BUKAN kolom employees — harus dibuang sebelum simpan. */
const BUKAN_KOLOM = [
  'branches', 'kolom_perlu_diisi', 'belum_lengkap', 'jumlah_kurang', 'dinilai',
  'photo_url', 'user_id', 'default_rate_card_id',
  'company_id', 'created_at', 'updated_at', 'created_by',
]

const KOLOM_KARYAWAN: ColumnDef[] = [
  { key: 'nip', header: 'NIK Pegawai', locked: true },
  { key: 'full_name', header: 'Nama', locked: true },
  { key: 'nik_telkom', header: 'NIK Telkom' },
  { key: 'position', header: 'Jabatan' },
  { key: 'level_jabatan', header: 'Level' },
  { key: 'cabang', header: 'Cabang' },
  { key: 'kemitraan', header: 'Kemitraan' },
  { key: 'status_teknisi', header: 'Status Teknisi' },
  { key: 'status_salary', header: 'Status Gaji' },
  { key: 'status', header: 'Status' },
  { key: 'kelengkapan', header: 'Kelengkapan Data' },
  { key: 'unit', header: 'Unit', defaultVisible: false },
  { key: 'group_wfp', header: 'Group WFP', defaultVisible: false },
  { key: 'employment_type', header: 'Tipe Kerja', defaultVisible: false },
  { key: 'skill', header: 'Skill', defaultVisible: false },
  { key: 'payroll_scheme', header: 'Skema Payroll', defaultVisible: false },
  { key: 'join_date', header: 'Tgl Masuk', defaultVisible: false },
  { key: 'contract_end', header: 'Kontrak Berakhir', defaultVisible: false },
]

type Baris = Record<string, any>

export default function Karyawan() {
  const { profile, can, canMaster } = useAuth()
  const toast = useToast()
  const navImpor = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Baris[]>([])
  const [branches, setBranches] = useState<Baris[]>([])

  const [fUnit, setFUnit] = useState(''); const [fBranch, setFBranch] = useState('')
  const [fStatus, setFStatus] = useState(''); const [fType, setFType] = useState('')
  const [fLevel, setFLevel] = useState(''); const [fKemitraan, setFKemitraan] = useState('')
  const [fTeknisi, setFTeknisi] = useState(''); const [fBelumLengkap, setFBelumLengkap] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Baris>(emptyForm)
  const fieldKustom = useFieldKustom('employees')

  const [detail, setDetail] = useState<Baris | null>(null)
  const [tab, setTab] = useState('ringkasan')
  const [formasi, setFormasi] = useState<Baris[] | null>(null)
  const [certs, setCerts] = useState<Baris[] | null>(null)
  const [attend, setAttend] = useState<Baris[] | null>(null)
  const [sal, setSal] = useState<Baris[] | null>(null)
  const [confirmOff, setConfirmOff] = useState<Baris | null>(null)

  const { shown, control } = useColumnPicker('kolom.hr.karyawan', KOLOM_KARYAWAN)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [emp, br, kelengkapan] = await Promise.all([
        list<Baris>('employees', { select: '*,branches(id,name,code)', order: { col: 'full_name', asc: true } }),
        list<Baris>('branches', { select: 'id,name,code', order: { col: 'name', asc: true } }),
        list<Baris>('v_inbox_kelengkapan_hr', { select: 'employee_id,kolom_perlu_diisi' }),
      ])
      const peta = new Map<string, string[]>(
        kelengkapan.map(k => [k.employee_id as string, (k.kolom_perlu_diisi ?? []) as string[]]),
      )
      setRows(emp.map(e => {
        // View v_inbox_kelengkapan_hr sengaja tidak memuat karyawan berstatus resign,
        // jadi ketiadaan baris berarti "tidak dinilai", bukan "sudah lengkap".
        const dinilai = peta.has(e.id)
        const kurang = peta.get(e.id) ?? []
        return { ...e, dinilai, kolom_perlu_diisi: kurang, jumlah_kurang: kurang.length, belum_lengkap: dinilai && kurang.length > 0 }
      }))
      setBranches(br)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data karyawan', 'error') }
    finally { setLoading(false) }
  }

  const unitOptions = useMemo(() => Array.from(new Set(rows.map(r => r.unit).filter(Boolean))).sort(), [rows])
  const levelOptions = useMemo(
    () => Array.from(new Set([...rows.map(r => r.level_jabatan), ...LEVEL_JABATAN_SARAN].filter(Boolean))).sort(),
    [rows],
  )
  const skillSaran = useMemo(
    () => Array.from(new Set([...SKILL_SARAN, ...rows.flatMap(r => (r.skill ?? []) as string[])].filter(Boolean))).sort(),
    [rows],
  )

  const filtered = useMemo(() => rows.filter(r =>
    (!fUnit || r.unit === fUnit) && (!fBranch || r.branch_id === fBranch) &&
    (!fStatus || r.status === fStatus) && (!fType || r.employment_type === fType) &&
    (!fLevel || r.level_jabatan === fLevel) && (!fKemitraan || r.kemitraan === fKemitraan) &&
    (!fTeknisi || r.status_teknisi === fTeknisi) && (!fBelumLengkap || r.belum_lengkap)
  ), [rows, fUnit, fBranch, fStatus, fType, fLevel, fKemitraan, fTeknisi, fBelumLengkap])

  const adaFilter = fUnit || fBranch || fStatus || fType || fLevel || fKemitraan || fTeknisi || fBelumLengkap
  const resetFilter = () => {
    setFUnit(''); setFBranch(''); setFStatus(''); setFType('')
    setFLevel(''); setFKemitraan(''); setFTeknisi(''); setFBelumLengkap(false)
  }

  function openAdd() { setForm(emptyForm); setModalOpen(true) }
  function openEdit(r: Baris) {
    setForm({
      ...emptyForm, ...r,
      birth_date: r.birth_date ?? '', join_date: r.join_date ?? '',
      contract_start: r.contract_start ?? '', contract_end: r.contract_end ?? '',
      skill: Array.isArray(r.skill) ? r.skill : [],
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.nip || !form.full_name || !form.position) { toast.push('NIK, nama, dan jabatan wajib diisi', 'error'); return }
    const galatKustom = periksaFieldKustom(fieldKustom, form.custom)
    if (galatKustom) { toast.push(galatKustom, 'error'); return }
    setSaving(true)
    try {
      const payload: Baris = { ...form }
      BUKAN_KOLOM.forEach(k => { delete payload[k] })
      payload.skill = Array.isArray(form.skill) && form.skill.length ? form.skill : null
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      if (form.id) {
        await update('employees', form.id, payload)
        toast.push('Data karyawan diperbarui')
      } else {
        await insert('employees', { ...payload, id: undefined, company_id: profile?.company_id, created_by: profile?.id })
        toast.push('Karyawan baru ditambahkan')
      }
      setModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan data karyawan', 'error') }
    finally { setSaving(false) }
  }

  async function openDetail(r: Baris) {
    setDetail(r); setTab('ringkasan'); setFormasi(null); setCerts(null); setAttend(null); setSal(null)
  }

  async function loadTab(t: string) {
    setTab(t)
    if (!detail) return
    try {
      if (t === 'formasi' && formasi === null) setFormasi(await list('employee_positions', { select: '*,branches(id,name,code)', eq: { employee_id: detail.id }, order: { col: 'object_id', asc: true } }))
      if (t === 'sertifikasi' && certs === null) setCerts(await list('employee_certifications', { eq: { employee_id: detail.id }, order: { col: 'expiry_date', asc: true } }))
      if (t === 'absensi' && attend === null) setAttend(await list('attendances', { eq: { employee_id: detail.id }, order: { col: 'work_date', asc: false }, limit: 30 }))
      if (t === 'gaji' && sal === null) setSal(await list('employee_salaries', { select: '*,salary_components(name,component_type)', eq: { employee_id: detail.id }, order: { col: 'effective_date', asc: false } }))
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data', 'error') }
  }

  async function nonaktifkan() {
    try {
      await update('employees', confirmOff!.id, { status: 'nonaktif' })
      toast.push('Karyawan dinonaktifkan')
      load(); setDetail(null)
    } catch (e: any) { toast.push(e.message ?? 'Gagal menonaktifkan karyawan', 'error') }
    finally { setConfirmOff(null) }
  }

  const kurangDetail: string[] = (detail?.kolom_perlu_diisi ?? []) as string[]

  /** Cara render tiap kolom; digabung dengan definisi kolom yang sedang ditampilkan. */
  const renderKolom: Record<string, Partial<Column>> = {
    nip: { header: 'NIK', width: '110px' },
    nik_telkom: { width: '120px', render: (r: Baris) => r.nik_telkom ?? '-' },
    level_jabatan: { render: (r: Baris) => r.level_jabatan ?? '-' },
    cabang: { sortable: false, render: (r: Baris) => r.branches?.name ?? '-' },
    kemitraan: { render: (r: Baris) => (r.kemitraan ? <Badge tone="slate">{r.kemitraan}</Badge> : '-') },
    status_teknisi: { render: (r: Baris) => (r.status_teknisi ? <Badge tone={r.status_teknisi === 'PERFORMANCE BASED' ? 'teal' : 'slate'}>{r.status_teknisi}</Badge> : '-') },
    status_salary: { render: (r: Baris) => (r.status_salary ? <Badge tone={r.status_salary === 'FIXED' ? 'emerald' : 'amber'}>{r.status_salary}</Badge> : '-') },
    status: { render: (r: Baris) => <Badge>{r.status}</Badge> },
    employment_type: { render: (r: Baris) => (r.employment_type ? <Badge tone="teal">{r.employment_type}</Badge> : '-') },
    group_wfp: { render: (r: Baris) => r.group_wfp ?? '-' },
    skill: { sortable: false, render: (r: Baris) => ((r.skill ?? []) as string[]).join(', ') || '-' },
    payroll_scheme: { render: (r: Baris) => PAYROLL_SCHEME_OPTIONS.find(o => o.value === r.payroll_scheme)?.label ?? r.payroll_scheme ?? '-' },
    join_date: { render: (r: Baris) => tgl(r.join_date) },
    contract_end: { render: (r: Baris) => (r.contract_end ? tgl(r.contract_end) : '-') },
    kelengkapan: {
      sortable: false, width: '170px',
      render: (r: Baris) => (!r.dinilai
        ? <span className="text-ink-300">tidak dinilai</span>
        : r.belum_lengkap
          ? <Badge tone="amber">{`Data belum lengkap (${r.jumlah_kurang})`}</Badge>
          : <Badge tone="emerald">Lengkap</Badge>),
    },
  }
  const kolomTampil: Column[] = [...KOLOM_KARYAWAN
    .filter(c => shown.has(c.key))
    .map(c => ({ key: c.key, header: c.header, ...renderKolom[c.key] })), ...kolomFieldKustom(fieldKustom)]


  return (
    <div>
      <PageHeader title="Data Karyawan" subtitle="Induk data seluruh karyawan perusahaan"
        actions={canMaster('HR') && <>
          <Button variant="outline" icon={<Upload size={16} />}
            onClick={() => navImpor('/pengaturan/impor?dataset=karyawan_wfp')}>Impor dari Excel/CSV</Button>
          <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Karyawan</Button>
        </>} />

      <FilterBar>
        <Field label="Unit" className="w-40"><Select value={fUnit} onChange={(e: any) => setFUnit(e.target.value)} options={unitOptions} placeholder="Semua unit" /></Field>
        <Field label="Cabang" className="w-48"><Select value={fBranch} onChange={(e: any) => setFBranch(e.target.value)} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="Semua cabang" /></Field>
        <Field label="Level" className="w-40"><Select value={fLevel} onChange={(e: any) => setFLevel(e.target.value)} options={levelOptions} placeholder="Semua level" /></Field>
        <Field label="Kemitraan" className="w-44"><Select value={fKemitraan} onChange={(e: any) => setFKemitraan(e.target.value)} options={KEMITRAAN_OPTIONS} placeholder="Semua kemitraan" /></Field>
        <Field label="Status Teknisi" className="w-48"><Select value={fTeknisi} onChange={(e: any) => setFTeknisi(e.target.value)} options={STATUS_TEKNISI_OPTIONS} placeholder="Semua" /></Field>
        <Field label="Status" className="w-40"><Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={EMPLOYEE_STATUS_OPTIONS} placeholder="Semua status" /></Field>
        <Field label="Tipe Kerja" className="w-40"><Select value={fType} onChange={(e: any) => setFType(e.target.value)} options={EMPLOYMENT_TYPE_OPTIONS} placeholder="Semua tipe" /></Field>
        <div className="flex items-end h-11">
          <Checkbox label="Hanya data belum lengkap" checked={fBelumLengkap} onChange={(e: any) => setFBelumLengkap(e.target.checked)} />
        </div>
        {adaFilter && <Button variant="ghost" size="sm" onClick={resetFilter}>Reset</Button>}
      </FilterBar>

      <DataTable
        loading={loading}
        rows={filtered}
        onRowClick={openDetail}
        searchKeys={['nip', 'nik_telkom', 'full_name', 'position', 'level_jabatan', 'unit']}
        exportName="data-karyawan"
        toolbar={control}
        emptyTitle="Belum ada karyawan"
        emptyMessage="Tambahkan karyawan pertama untuk mulai mengelola data HR."
        columns={kolomTampil}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="lg"
        title={form.id ? 'Ubah Data Karyawan' : 'Tambah Karyawan'}
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <Section title="Data Pribadi">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="NIK Pegawai" required><Input value={form.nip} onChange={(e: any) => setForm({ ...form, nip: e.target.value })} /></Field>
            <Field label="Nama Lengkap" required className="sm:col-span-2"><Input value={form.full_name} onChange={(e: any) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="Jenis Kelamin"><Select value={form.gender} onChange={(e: any) => setForm({ ...form, gender: e.target.value })} options={GENDER_OPTIONS} /></Field>
            <Field label="Tanggal Lahir"><Input type="date" value={form.birth_date} onChange={(e: any) => setForm({ ...form, birth_date: e.target.value })} /></Field>
            <Field label="No. KTP"><Input value={form.nik_ktp} onChange={(e: any) => setForm({ ...form, nik_ktp: e.target.value })} /></Field>
            <Field label="Telepon"><Input value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Alamat" className="sm:col-span-3"><Input value={form.address} onChange={(e: any) => setForm({ ...form, address: e.target.value })} /></Field>
          </div>
        </Section>
        <Section title="Data Pekerjaan">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Jabatan" required><Input value={form.position} onChange={(e: any) => setForm({ ...form, position: e.target.value })} /></Field>
            <Field label="Unit"><Input value={form.unit} onChange={(e: any) => setForm({ ...form, unit: e.target.value })} placeholder="mis. OPERATIONS" /></Field>
            <Field label="Cabang"><Select value={form.branch_id} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} options={branches.map(b => ({ value: b.id, label: b.name }))} /></Field>
            <Field label="Tipe Kerja"><Select value={form.employment_type} onChange={(e: any) => setForm({ ...form, employment_type: e.target.value })} options={EMPLOYMENT_TYPE_OPTIONS} /></Field>
            <Field label="Status"><Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={EMPLOYEE_STATUS_OPTIONS} /></Field>
            <Field label="Tanggal Masuk"><Input type="date" value={form.join_date} onChange={(e: any) => setForm({ ...form, join_date: e.target.value })} /></Field>
            {form.employment_type === 'PKWT' && <>
              <Field label="Mulai Kontrak"><Input type="date" value={form.contract_start} onChange={(e: any) => setForm({ ...form, contract_start: e.target.value })} /></Field>
              <Field label="Berakhir Kontrak"><Input type="date" value={form.contract_end} onChange={(e: any) => setForm({ ...form, contract_end: e.target.value })} /></Field>
            </>}
          </div>
        </Section>
        <Section title="Data WFP / Telkom Akses">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="NIK Telkom"><Input value={form.nik_telkom} onChange={(e: any) => setForm({ ...form, nik_telkom: e.target.value })} /></Field>
            <Field label="Kemitraan"><Select value={form.kemitraan} onChange={(e: any) => setForm({ ...form, kemitraan: e.target.value })} options={KEMITRAAN_OPTIONS} placeholder="— pilih —" /></Field>
            <Field label="Group WFP"><Select value={form.group_wfp} onChange={(e: any) => setForm({ ...form, group_wfp: e.target.value })} options={GROUP_WFP_OPTIONS} placeholder="— pilih —" /></Field>
            <Field label="Level Jabatan" hint="Boleh diisi bebas; daftar hanya saran.">
              <Input list="saran-level-jabatan" value={form.level_jabatan} onChange={(e: any) => setForm({ ...form, level_jabatan: e.target.value })} />
            </Field>
            <Field label="Status Teknisi"><Select value={form.status_teknisi} onChange={(e: any) => setForm({ ...form, status_teknisi: e.target.value })} options={STATUS_TEKNISI_OPTIONS} placeholder="— pilih —" /></Field>
            <Field label="Status Gaji"><Select value={form.status_salary} onChange={(e: any) => setForm({ ...form, status_salary: e.target.value })} options={STATUS_SALARY_OPTIONS} placeholder="— pilih —" /></Field>
            <Field label="Skema Payroll"><Select value={form.payroll_scheme} onChange={(e: any) => setForm({ ...form, payroll_scheme: e.target.value })} options={PAYROLL_SCHEME_OPTIONS} /></Field>
            <Field label="Skill" className="sm:col-span-3" hint="Tekan Enter untuk menambah nilai.">
              <MultiValueInput value={form.skill ?? []} suggestions={skillSaran} onChange={(v) => setForm({ ...form, skill: v })} />
            </Field>
          </div>
          <datalist id="saran-level-jabatan">
            {levelOptions.map(l => <option key={l as string} value={l as string} />)}
          </datalist>
        </Section>
        <Section title="Pajak, BPJS & Rekening Bank">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Status PTKP"><Select value={form.ptkp_status} onChange={(e: any) => setForm({ ...form, ptkp_status: e.target.value })} options={PTKP_OPTIONS} /></Field>
            <Field label="Kategori TER"><Select value={form.ter_category} onChange={(e: any) => setForm({ ...form, ter_category: e.target.value })} options={TER_CATEGORY_OPTIONS} /></Field>
            <Field label="NPWP"><Input value={form.npwp} onChange={(e: any) => setForm({ ...form, npwp: e.target.value })} /></Field>
            <Field label="No. BPJS Ketenagakerjaan"><Input value={form.bpjs_tk_no} onChange={(e: any) => setForm({ ...form, bpjs_tk_no: e.target.value })} /></Field>
            <Field label="No. BPJS Kesehatan"><Input value={form.bpjs_kes_no} onChange={(e: any) => setForm({ ...form, bpjs_kes_no: e.target.value })} /></Field>
            <div />
            <Field label="Nama Bank"><Input value={form.bank_name} onChange={(e: any) => setForm({ ...form, bank_name: e.target.value })} /></Field>
            <Field label="No. Rekening"><Input value={form.bank_account} onChange={(e: any) => setForm({ ...form, bank_account: e.target.value })} /></Field>
            <Field label="Nama Pemilik Rekening"><Input value={form.bank_holder} onChange={(e: any) => setForm({ ...form, bank_holder: e.target.value })} /></Field>
          </div>
        </Section>
        {fieldKustom.length > 0 && <Section title="Data Tambahan Perusahaan">
          <InputFieldKustom defs={fieldKustom} value={form.custom} onChange={v => setForm({ ...form, custom: v })} />
        </Section>}
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.full_name} width="max-w-2xl"
        footer={detail?.status !== 'nonaktif' && can('HR', 'approve') &&
          <Button variant="danger" onClick={() => setConfirmOff(detail)}>Nonaktifkan Karyawan</Button>}>
        {detail && <>
          <Tabs value={tab} onChange={loadTab} className="mb-4" tabs={[
            { value: 'ringkasan', label: 'Ringkasan' }, { value: 'formasi', label: 'Formasi / Penugasan' },
            { value: 'sertifikasi', label: 'Sertifikasi' },
            { value: 'absensi', label: 'Riwayat Absensi' }, { value: 'gaji', label: 'Komponen Gaji' },
          ]} />
          {tab === 'ringkasan' && <>
            <Desc cols={2} items={[
              { label: 'NIK Pegawai', value: detail.nip }, { label: 'Status', value: <Badge>{detail.status}</Badge> },
              { label: 'NIK Telkom', value: detail.nik_telkom }, { label: 'Level Jabatan', value: detail.level_jabatan },
              { label: 'Jabatan', value: detail.position }, { label: 'Unit', value: detail.unit },
              { label: 'Cabang', value: detail.branches?.name }, { label: 'Tipe Kerja', value: detail.employment_type },
              { label: 'Kemitraan', value: detail.kemitraan }, { label: 'Group WFP', value: detail.group_wfp },
              { label: 'Status Teknisi', value: detail.status_teknisi }, { label: 'Status Gaji', value: detail.status_salary },
              { label: 'Skema Payroll', value: PAYROLL_SCHEME_OPTIONS.find(o => o.value === detail.payroll_scheme)?.label ?? detail.payroll_scheme },
              { label: 'Skill', value: ((detail.skill ?? []) as string[]).join(', ') || '-' },
              { label: 'Tanggal Masuk', value: tgl(detail.join_date) },
              { label: 'Kontrak Berakhir', value: detail.contract_end ? tgl(detail.contract_end) : '-' },
              { label: 'Telepon', value: detail.phone }, { label: 'Email', value: detail.email },
              { label: 'PTKP', value: detail.ptkp_status }, { label: 'Kategori TER', value: detail.ter_category },
              { label: 'NPWP', value: detail.npwp }, { label: 'No. KTP', value: detail.nik_ktp },
              { label: 'BPJS Ketenagakerjaan', value: detail.bpjs_tk_no }, { label: 'BPJS Kesehatan', value: detail.bpjs_kes_no },
              { label: 'Bank', value: detail.bank_name ? `${detail.bank_name} · ${detail.bank_account ?? '-'} a.n ${detail.bank_holder ?? '-'}` : '-' },
            ]} />

            <div className="mt-5">
              <p className="text-body font-semibold text-ink-800 mb-2">Data yang masih perlu diisi</p>
              {!detail.dinilai
                ? <Card className="p-3 text-body text-ink-600">Karyawan berstatus resign tidak ikut dinilai kelengkapan datanya.</Card>
                : kurangDetail.length === 0
                ? <Card className="p-3 text-body text-ink-600">Semua data identitas wajib sudah lengkap.</Card>
                : <Card className="p-3">
                  <p className="text-caption text-ink-500 mb-2">{kurangDetail.length} isian belum terisi:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {kurangDetail.map(k => <li key={k} className="text-body text-ink-700">{k}</li>)}
                  </ul>
                </Card>}
            </div>

            {canMaster('HR') && <Button className="mt-5" variant="outline" onClick={() => { setDetail(null); openEdit(detail) }}>Ubah Data</Button>}
          </>}
          {tab === 'formasi' && (formasi === null ? <TableSkeleton /> : formasi.length === 0 ? (
            <EmptyState title="Belum ada formasi" message="Karyawan ini belum dikaitkan ke OBJECT ID / formasi mana pun." />
          ) : (
            <DataTable searchable={false} pageSize={10} dense rows={formasi} columns={[
              { key: 'object_id', header: 'Object ID', render: (r: Baris) => r.object_id ?? '-' },
              { key: 'position_name', header: 'Nama Formasi', render: (r: Baris) => r.position_name ?? '-' },
              { key: 'position_title', header: 'Jabatan', render: (r: Baris) => r.position_title ?? '-' },
              { key: 'cabang', header: 'Cabang', sortable: false, render: (r: Baris) => r.branches?.name ?? '-' },
              { key: 'psa', header: 'PSA', render: (r: Baris) => r.psa ?? '-' },
              { key: 'portofolio', header: 'Portofolio', render: (r: Baris) => r.portofolio ?? '-' },
              { key: 'nama_program', header: 'Program', render: (r: Baris) => r.nama_program ?? '-' },
              { key: 'sto', header: 'STO', render: (r: Baris) => r.sto ?? r.sto_kode ?? '-' },
              { key: 'gaji_per_teknisi', header: 'Gaji', align: 'right', render: (r: Baris) => rupiah(r.gaji_per_teknisi) },
              { key: 'status_penugasan', header: 'Penugasan', render: (r: Baris) => r.status_penugasan ? <Badge tone="teal">{r.status_penugasan}</Badge> : '-' },
              { key: 'aktif', header: 'Aktif', render: (r: Baris) => <Badge tone={r.aktif ? 'emerald' : 'slate'}>{r.aktif ? 'Aktif' : 'Nonaktif'}</Badge> },
            ]} />))}
          {tab === 'sertifikasi' && (certs === null ? <TableSkeleton /> : certs.length === 0 ? <EmptyState title="Belum ada sertifikasi" /> : (
            <div className="space-y-2">{certs.map(c => { const t = expiryTone(c.expiry_date); return (
              <Card key={c.id} className="p-3 flex items-center justify-between">
                <div><p className="text-body font-medium text-ink-800">{c.cert_name}</p><p className="text-caption text-ink-400">{c.cert_type} · berakhir {tgl(c.expiry_date)}</p></div>
                <Badge tone={t.tone}>{t.label}</Badge>
              </Card>) })}</div>))}
          {tab === 'absensi' && (attend === null ? <TableSkeleton /> : attend.length === 0 ? <EmptyState title="Belum ada riwayat absensi" /> : (
            <DataTable searchable={false} pageSize={10} columns={[
              { key: 'work_date', header: 'Tanggal', render: (r: Baris) => tgl(r.work_date) },
              { key: 'status', header: 'Status', render: (r: Baris) => <Badge>{r.status}</Badge> },
              { key: 'late_minutes', header: 'Terlambat', align: 'right', render: (r: Baris) => `${r.late_minutes ?? 0} mnt` },
            ]} rows={attend} />))}
          {tab === 'gaji' && (sal === null ? <TableSkeleton /> : sal.length === 0 ? <EmptyState title="Belum ada komponen gaji ditetapkan" /> : (
            <DataTable searchable={false} pageSize={10} columns={[
              { key: 'nama', header: 'Komponen', render: (r: Baris) => r.salary_components?.name ?? '-' },
              { key: 'tipe', header: 'Tipe', render: (r: Baris) => <Badge tone={r.salary_components?.component_type === 'deduction' ? 'red' : 'emerald'}>{r.salary_components?.component_type}</Badge> },
              { key: 'amount', header: 'Nominal', align: 'right', render: (r: Baris) => (r.amount ?? 0).toLocaleString('id-ID') },
              { key: 'effective_date', header: 'Berlaku Sejak', render: (r: Baris) => tgl(r.effective_date) },
            ]} rows={sal} />))}
        </>}
      </Drawer>

      <ConfirmDialog open={!!confirmOff} onClose={() => setConfirmOff(null)} onConfirm={nonaktifkan} danger
        title="Nonaktifkan Karyawan" confirmLabel="Ya, Nonaktifkan"
        message={`Karyawan "${confirmOff?.full_name}" akan ditandai nonaktif. Lanjutkan?`} />
    </div>
  )
}
