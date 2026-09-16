import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, uploadFile, signedUrl, nextDocNo } from '@/lib/db'
import {
  PageHeader, DataTable, Badge, Button, Modal, Drawer, Field, Select, Input, Money, Tabs, FilterBar, Section,
  KpiCard, useToast, Plus,
} from '@/components/ui'
import { rupiah, tgl, todayISO } from '@/lib/format'
import {
  COMPETENCY_LEVEL_OPTIONS, COMPETENCY_LEVEL_TONE, COMPETENCY_CATEGORY_OPTIONS, TRAINING_TYPE_OPTIONS,
  TRAINING_STATUS_OPTIONS, ATTENDANCE_OPTIONS, isPast, isThisMonth,
} from '../lib/constants'

const emptyAssess = { employee_id: '', competency_id: '', level: 'dasar', assessed_at: todayISO(), expiry_date: '' }
const emptyTraining = { id: null, title: '', provider: '', training_type: 'Internal', competency_id: '', start_date: todayISO(), end_date: '', location: '', quota: 20, cost: 0, status: 'rencana' }

export default function Kompetensi() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('matriks')
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<any[]>([])
  const [competencies, setCompetencies] = useState<any[]>([])
  const [empComp, setEmpComp] = useState<any[]>([])
  const [trainings, setTrainings] = useState<any[]>([])

  const [fUnit, setFUnit] = useState(''); const [fBranch, setFBranch] = useState('')
  const [branches, setBranches] = useState<any[]>([])

  const [assessOpen, setAssessOpen] = useState(false)
  const [assessSaving, setAssessSaving] = useState(false)
  const [assessForm, setAssessForm] = useState<any>(emptyAssess)
  const [evidence, setEvidence] = useState<File | null>(null)

  const [tModalOpen, setTModalOpen] = useState(false)
  const [tSaving, setTSaving] = useState(false)
  const [tForm, setTForm] = useState<any>(emptyTraining)

  const [tDetail, setTDetail] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [pLoading, setPLoading] = useState(false)
  const [addPartId, setAddPartId] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [emp, comp, ec, tr, br] = await Promise.all([
        list<any>('employees', { select: 'id,full_name,position,unit,branch_id', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
        list<any>('competencies', { select: '*', order: { col: 'name', asc: true } }),
        list<any>('employee_competencies', { select: '*' }),
        list<any>('trainings', { select: '*,competencies(name)', order: { col: 'start_date', asc: false } }),
        list<any>('branches', { select: 'id,name', order: { col: 'name', asc: true } }),
      ])
      setEmployees(emp); setCompetencies(comp); setEmpComp(ec); setTrainings(tr); setBranches(br)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data kompetensi', 'error') }
    finally { setLoading(false) }
  }

  const unitOptions = useMemo(() => Array.from(new Set(employees.map(e => e.unit).filter(Boolean))).sort(), [employees])
  const filteredEmployees = useMemo(() => employees.filter(e => (!fUnit || e.unit === fUnit) && (!fBranch || e.branch_id === fBranch)), [employees, fUnit, fBranch])

  function cellFor(employeeId: string, competencyId: string) {
    return empComp.find(c => c.employee_id === employeeId && c.competency_id === competencyId)
  }

  function openAssess(employeeId?: string) {
    setAssessForm({ ...emptyAssess, employee_id: employeeId || '' }); setEvidence(null); setAssessOpen(true)
  }
  async function saveAssess() {
    if (!assessForm.employee_id || !assessForm.competency_id) { toast.push('Karyawan dan kompetensi wajib dipilih', 'error'); return }
    setAssessSaving(true)
    try {
      let evidence_url: string | null = null
      if (evidence) evidence_url = await uploadFile(profile!.company_id, 'kompetensi', evidence)
      const existing = cellFor(assessForm.employee_id, assessForm.competency_id)
      const payload: any = {
        level: assessForm.level, assessed_at: assessForm.assessed_at, expiry_date: assessForm.expiry_date || null,
        assessed_by: profile?.id, ...(evidence_url ? { evidence_url } : {}),
      }
      if (existing) await update('employee_competencies', existing.id, payload)
      else await insert('employee_competencies', { company_id: profile?.company_id, employee_id: assessForm.employee_id, competency_id: assessForm.competency_id, created_by: profile?.id, ...payload })
      toast.push('Penilaian kompetensi disimpan'); setAssessOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan penilaian kompetensi', 'error') }
    finally { setAssessSaving(false) }
  }

  function openAddTraining() { setTForm(emptyTraining); setTModalOpen(true) }
  function openEditTraining(r: any) { setTForm({ ...emptyTraining, ...r }); setTModalOpen(true) }
  async function saveTraining() {
    if (!tForm.title || !tForm.start_date) { toast.push('Judul dan tanggal mulai pelatihan wajib diisi', 'error'); return }
    setTSaving(true)
    try {
      const payload: any = { ...tForm }; delete payload.competencies
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      if (tForm.id) { await update('trainings', tForm.id, payload); toast.push('Pelatihan diperbarui') }
      else {
        const training_no = await nextDocNo(profile!.company_id, 'PLT')
        await insert('trainings', { ...payload, id: undefined, training_no, company_id: profile?.company_id, created_by: profile?.id })
        toast.push('Pelatihan baru dibuat')
      }
      setTModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan pelatihan', 'error') }
    finally { setTSaving(false) }
  }

  async function openTrainingDetail(r: any) {
    setTDetail(r); setPLoading(true); setAddPartId('')
    try {
      const p = await list<any>('training_participants', { select: '*,employees(full_name,position)', eq: { training_id: r.id } })
      setParticipants(p)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat peserta pelatihan', 'error') }
    finally { setPLoading(false) }
  }
  async function addParticipant() {
    if (!addPartId) { toast.push('Pilih karyawan terlebih dahulu', 'error'); return }
    try {
      await insert('training_participants', { company_id: profile?.company_id, training_id: tDetail.id, employee_id: addPartId, attendance: 'terdaftar', created_by: profile?.id })
      toast.push('Peserta didaftarkan'); setAddPartId(''); openTrainingDetail(tDetail)
    } catch (e: any) { toast.push(e.message ?? 'Gagal mendaftarkan peserta', 'error') }
  }
  async function updateParticipant(p: any, values: any) {
    try { await update('training_participants', p.id, values); openTrainingDetail(tDetail) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui peserta', 'error') }
  }
  async function uploadCertificate(p: any, file: File) {
    try {
      const certificate_url = await uploadFile(profile!.company_id, 'sertifikat-pelatihan', file)
      await updateParticipant(p, { certificate_url })
      toast.push('Sertifikat diunggah')
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah sertifikat', 'error') }
  }
  async function viewCertificate(path?: string | null) {
    const url = await signedUrl(path)
    if (url) window.open(url, '_blank'); else toast.push('Sertifikat belum tersedia', 'error')
  }

  const kompetensiKedaluwarsa = empComp.filter(c => isPast(c.expiry_date)).length
  const pelatihanBulanIni = trainings.filter(t => isThisMonth(t.start_date)).length
  const biayaPelatihanBulanIni = trainings.filter(t => isThisMonth(t.start_date)).reduce((s, t) => s + Number(t.cost ?? 0), 0)

  return (
    <div>
      <PageHeader title="Kompetensi & Pelatihan" subtitle="Matriks kompetensi karyawan dan penyelenggaraan pelatihan"
        actions={can('HR', 'write') && (tab === 'matriks'
          ? <Button icon={<Plus size={16} />} onClick={() => openAssess()}>Nilai Kompetensi</Button>
          : <Button icon={<Plus size={16} />} onClick={openAddTraining}>Buat Pelatihan</Button>)} />

      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Kompetensi Kedaluwarsa" value={kompetensiKedaluwarsa} tone={kompetensiKedaluwarsa > 0 ? 'red' : 'teal'} />
        <KpiCard label="Pelatihan Bulan Ini" value={pelatihanBulanIni} />
        <KpiCard label="Biaya Pelatihan Bulan Ini" value={rupiah(biayaPelatihanBulanIni)} />
      </div>

      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'matriks', label: 'Matriks Kompetensi' }, { value: 'pelatihan', label: 'Pelatihan' }]} />

      {tab === 'matriks' && (
        <>
          <FilterBar>
            <Field label="Unit"><Select value={fUnit} onChange={(e: any) => setFUnit(e.target.value)} placeholder="Semua unit" options={unitOptions} /></Field>
            <Field label="Cabang"><Select value={fBranch} onChange={(e: any) => setFBranch(e.target.value)} placeholder="Semua cabang" options={branches.map(b => ({ value: b.id, label: b.name }))} /></Field>
          </FilterBar>
          <DataTable
            loading={loading} rows={filteredEmployees} searchKeys={['full_name']} pageSize={50} dense
            emptyTitle="Belum ada karyawan" exportName="matriks-kompetensi"
            columns={[
              { key: 'full_name', header: 'Karyawan', width: '200px', render: r => <div><p className="font-medium text-ink-800 dark:text-ink-100">{r.full_name}</p><p className="text-caption text-ink-400">{r.position}</p></div> },
              ...competencies.map(c => ({
                key: c.id, header: c.name, align: 'center' as const, sortable: false,
                render: (r: any) => {
                  const cell = cellFor(r.id, c.id)
                  if (!cell) return <button onClick={() => can('HR', 'write') && (setAssessForm({ ...emptyAssess, employee_id: r.id, competency_id: c.id }), setEvidence(null), setAssessOpen(true))} className="text-ink-300 hover:text-ink-500">—</button>
                  const expired = isPast(cell.expiry_date)
                  const tone = expired ? 'red' : COMPETENCY_LEVEL_TONE[cell.level] ?? 'slate'
                  return <button onClick={() => can('HR', 'write') && (setAssessForm({ employee_id: r.id, competency_id: c.id, level: cell.level, assessed_at: cell.assessed_at ?? todayISO(), expiry_date: cell.expiry_date ?? '' }), setEvidence(null), setAssessOpen(true))}>
                    <Badge tone={tone as any}>{COMPETENCY_LEVEL_OPTIONS.find(l => l.value === cell.level)?.label ?? cell.level}</Badge>
                  </button>
                },
              })),
            ]}
          />
        </>
      )}

      {tab === 'pelatihan' && (
        <DataTable
          loading={loading} rows={trainings} searchKeys={['title', 'provider', 'training_no']} emptyTitle="Belum ada pelatihan"
          onRowClick={openTrainingDetail}
          columns={[
            { key: 'training_no', header: 'No. Pelatihan' },
            { key: 'title', header: 'Judul' },
            { key: 'provider', header: 'Penyelenggara' },
            { key: 'training_type', header: 'Jenis' },
            { key: 'competencies', header: 'Kompetensi Terkait', render: r => r.competencies?.name ?? '-' },
            { key: 'periode', header: 'Periode', render: r => `${tgl(r.start_date)} – ${tgl(r.end_date)}` },
            { key: 'quota', header: 'Kuota', align: 'right' },
            { key: 'cost', header: 'Biaya', align: 'right', render: r => rupiah(r.cost) },
            { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
          ]}
        />
      )}

      <Modal open={assessOpen} onClose={() => setAssessOpen(false)} title="Nilai Kompetensi" size="sm"
        footer={<><Button variant="outline" onClick={() => setAssessOpen(false)}>Batal</Button><Button loading={assessSaving} onClick={saveAssess}>Simpan</Button></>}>
        <div className="grid gap-4">
          <Field label="Karyawan" required><Select value={assessForm.employee_id} onChange={(e: any) => setAssessForm({ ...assessForm, employee_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: e.full_name }))} /></Field>
          <Field label="Kompetensi" required><Select value={assessForm.competency_id} onChange={(e: any) => setAssessForm({ ...assessForm, competency_id: e.target.value })} options={competencies.map(c => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Level"><Select value={assessForm.level} onChange={(e: any) => setAssessForm({ ...assessForm, level: e.target.value })} options={COMPETENCY_LEVEL_OPTIONS} /></Field>
          <Field label="Tanggal Penilaian"><Input type="date" value={assessForm.assessed_at} onChange={(e: any) => setAssessForm({ ...assessForm, assessed_at: e.target.value })} /></Field>
          <Field label="Berlaku Hingga (opsional)"><Input type="date" value={assessForm.expiry_date} onChange={(e: any) => setAssessForm({ ...assessForm, expiry_date: e.target.value })} /></Field>
          <Field label="Bukti/Sertifikat"><input type="file" onChange={e => setEvidence(e.target.files?.[0] ?? null)}
            className="block w-full text-body text-ink-600 dark:text-ink-300 file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" /></Field>
        </div>
      </Modal>

      <Modal open={tModalOpen} onClose={() => setTModalOpen(false)} title={tForm.id ? 'Ubah Pelatihan' : 'Buat Pelatihan'} size="lg"
        footer={<><Button variant="outline" onClick={() => setTModalOpen(false)}>Batal</Button><Button loading={tSaving} onClick={saveTraining}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Judul Pelatihan" required className="sm:col-span-2"><Input value={tForm.title} onChange={(e: any) => setTForm({ ...tForm, title: e.target.value })} /></Field>
          <Field label="Penyelenggara"><Input value={tForm.provider} onChange={(e: any) => setTForm({ ...tForm, provider: e.target.value })} /></Field>
          <Field label="Jenis Pelatihan"><Select value={tForm.training_type} onChange={(e: any) => setTForm({ ...tForm, training_type: e.target.value })} options={TRAINING_TYPE_OPTIONS} /></Field>
          <Field label="Kompetensi Terkait"><Select value={tForm.competency_id} onChange={(e: any) => setTForm({ ...tForm, competency_id: e.target.value })} options={competencies.map(c => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Lokasi"><Input value={tForm.location} onChange={(e: any) => setTForm({ ...tForm, location: e.target.value })} /></Field>
          <Field label="Tanggal Mulai" required><Input type="date" value={tForm.start_date} onChange={(e: any) => setTForm({ ...tForm, start_date: e.target.value })} /></Field>
          <Field label="Tanggal Selesai"><Input type="date" value={tForm.end_date} onChange={(e: any) => setTForm({ ...tForm, end_date: e.target.value })} /></Field>
          <Field label="Kuota Peserta"><Input type="number" min={1} value={tForm.quota} onChange={(e: any) => setTForm({ ...tForm, quota: Number(e.target.value) })} /></Field>
          <Field label="Biaya"><Money value={tForm.cost} onChange={(v: number) => setTForm({ ...tForm, cost: v })} /></Field>
          <Field label="Status"><Select value={tForm.status} onChange={(e: any) => setTForm({ ...tForm, status: e.target.value })} options={TRAINING_STATUS_OPTIONS} /></Field>
        </div>
      </Modal>

      <Drawer open={!!tDetail} onClose={() => setTDetail(null)} title={tDetail?.title} width="max-w-2xl">
        {tDetail && (
          <>
            <Section title="Peserta Pelatihan">
              {can('HR', 'write') && (
                <div className="flex items-end gap-2 mb-3">
                  <div className="flex-1"><Field label="Tambah Peserta"><Select value={addPartId} onChange={(e: any) => setAddPartId(e.target.value)} options={employees.filter(e => !participants.some(p => p.employee_id === e.id)).map(e => ({ value: e.id, label: e.full_name }))} /></Field></div>
                  <Button onClick={addParticipant}>Daftarkan</Button>
                </div>
              )}
              <DataTable
                loading={pLoading} rows={participants} searchable={false} pageSize={100} emptyTitle="Belum ada peserta terdaftar"
                columns={[
                  { key: 'nama', header: 'Nama', render: r => r.employees?.full_name ?? '-' },
                  { key: 'attendance', header: 'Kehadiran', render: r => can('HR', 'write')
                    ? <Select value={r.attendance} onChange={(e: any) => updateParticipant(r, { attendance: e.target.value })} options={ATTENDANCE_OPTIONS} />
                    : <Badge>{r.attendance}</Badge> },
                  { key: 'score', header: 'Nilai', align: 'right', render: r => can('HR', 'write')
                    ? <Input type="number" defaultValue={r.score ?? ''} className="w-20 text-right" onBlur={(e: any) => updateParticipant(r, { score: e.target.value === '' ? null : Number(e.target.value) })} />
                    : (r.score ?? '-') },
                  { key: 'certificate_url', header: 'Sertifikat', align: 'center', render: (r: any) => r.certificate_url
                    ? <Button size="sm" variant="ghost" onClick={() => viewCertificate(r.certificate_url)}>Lihat</Button>
                    : can('HR', 'write') ? <label className="text-caption text-primary-600 cursor-pointer">Unggah<input type="file" className="hidden" onChange={e => e.target.files?.[0] && uploadCertificate(r, e.target.files[0])} /></label> : '-' },
                ]}
              />
            </Section>
          </>
        )}
      </Drawer>
    </div>
  )
}
