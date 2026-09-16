import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, uploadFile, signedUrl, nextDocNo } from '@/lib/db'
import {
  PageHeader, Card, DataTable, Badge, Button, Modal, Drawer, Field, Select, Input, Textarea, Money, Tabs, Desc, Section,
  KpiCard, EmptyState, useToast, Plus,
} from '@/components/ui'
import { tgl, todayISO } from '@/lib/format'
import { VACANCY_STATUS_OPTIONS, EMPLOYMENT_TYPE_OPTIONS, APPLICANT_STAGES, APPLICANT_SOURCE_OPTIONS } from '../lib/constants'

const emptyVacancy = {
  id: null, title: '', position: '', unit: '', branch_id: '', employment_type: 'PKWTT', qty: 1,
  salary_range_min: 0, salary_range_max: 0, open_date: todayISO(), close_date: '', requirements: '', status: 'draft',
}
const emptyApplicant = { vacancy_id: '', full_name: '', email: '', phone: '', education: '', experience_years: 0, source: 'Job Portal' }

export default function Rekrutmen() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('pelamar')
  const [loading, setLoading] = useState(true)
  const [vacancies, setVacancies] = useState<any[]>([])
  const [applicants, setApplicants] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])

  const [vModalOpen, setVModalOpen] = useState(false)
  const [vSaving, setVSaving] = useState(false)
  const [vForm, setVForm] = useState<any>(emptyVacancy)

  const [fVacancy, setFVacancy] = useState('')
  const [aModalOpen, setAModalOpen] = useState(false)
  const [aSaving, setASaving] = useState(false)
  const [aForm, setAForm] = useState<any>(emptyApplicant)
  const [cvFile, setCvFile] = useState<File | null>(null)

  const [detail, setDetail] = useState<any>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [vc, ap, br] = await Promise.all([
        list<any>('job_vacancies', { select: '*,branches(name)', order: { col: 'open_date', asc: false } }),
        list<any>('job_applicants', { select: '*,job_vacancies(title,position)', order: { col: 'applied_at', asc: false } }),
        list<any>('branches', { select: 'id,name', order: { col: 'name', asc: true } }),
      ])
      setVacancies(vc); setApplicants(ap); setBranches(br)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data rekrutmen', 'error') }
    finally { setLoading(false) }
  }

  function openAddVacancy() { setVForm(emptyVacancy); setVModalOpen(true) }
  function openEditVacancy(r: any) { setVForm({ ...emptyVacancy, ...r }); setVModalOpen(true) }
  async function saveVacancy() {
    if (!vForm.title || !vForm.position) { toast.push('Judul dan posisi lowongan wajib diisi', 'error'); return }
    setVSaving(true)
    try {
      const payload: any = { ...vForm }; delete payload.branches
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      if (vForm.id) { await update('job_vacancies', vForm.id, payload); toast.push('Lowongan diperbarui') }
      else {
        const vacancy_no = await nextDocNo(profile!.company_id, 'LOW')
        await insert('job_vacancies', { ...payload, id: undefined, vacancy_no, company_id: profile?.company_id, created_by: profile?.id })
        toast.push('Lowongan baru dibuat')
      }
      setVModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan lowongan', 'error') }
    finally { setVSaving(false) }
  }

  function openAddApplicant() { setAForm({ ...emptyApplicant, vacancy_id: fVacancy || vacancies[0]?.id || '' }); setCvFile(null); setAModalOpen(true) }
  async function saveApplicant() {
    if (!aForm.vacancy_id || !aForm.full_name) { toast.push('Lowongan dan nama pelamar wajib diisi', 'error'); return }
    setASaving(true)
    try {
      let cv_url: string | null = null
      if (cvFile) cv_url = await uploadFile(profile!.company_id, 'rekrutmen', cvFile)
      await insert('job_applicants', {
        company_id: profile?.company_id, vacancy_id: aForm.vacancy_id, full_name: aForm.full_name, email: aForm.email || null,
        phone: aForm.phone || null, education: aForm.education || null, experience_years: aForm.experience_years || null,
        source: aForm.source || null, cv_url, stage: 'baru', created_by: profile?.id,
      })
      toast.push('Pelamar baru ditambahkan'); setAModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menambahkan pelamar', 'error') }
    finally { setASaving(false) }
  }

  async function moveStage(r: any, stage: string) {
    setBusyId(r.id)
    try {
      const decided = stage === 'diterima' || stage === 'ditolak'
      await update('job_applicants', r.id, { stage, ...(decided ? { decided_at: new Date().toISOString(), decided_by: profile?.id } : {}) })
      toast.push('Tahap pelamar diperbarui'); load()
      if (detail?.id === r.id) setDetail({ ...detail, stage })
    } catch (e: any) { toast.push(e.message ?? 'Gagal memindahkan tahap', 'error') }
    finally { setBusyId(null) }
  }

  async function downloadCv(path?: string | null) {
    const url = await signedUrl(path)
    if (url) window.open(url, '_blank'); else toast.push('CV belum tersedia', 'error')
  }

  const filteredApplicants = useMemo(() => fVacancy ? applicants.filter(a => a.vacancy_id === fVacancy) : applicants, [applicants, fVacancy])
  const board = useMemo(() => {
    const map: Record<string, any[]> = {}
    APPLICANT_STAGES.forEach(s => { map[s.value] = [] })
    map.ditolak = []
    filteredApplicants.forEach(a => { (map[a.stage] ?? (map[a.stage] = [])).push(a) })
    return map
  }, [filteredApplicants])

  const lowonganTerbuka = vacancies.filter(v => v.status === 'dibuka').length
  const pelamarMasuk = applicants.length
  const decided = applicants.filter(a => a.stage === 'diterima' || a.stage === 'ditolak')
  const rasioLolos = decided.length ? (applicants.filter(a => a.stage === 'diterima').length / decided.length) * 100 : 0

  return (
    <div>
      <PageHeader title="Rekrutmen" subtitle="Lowongan pekerjaan dan pipeline pelamar"
        actions={can('HR', 'write') && (tab === 'pelamar'
          ? <Button icon={<Plus size={16} />} onClick={openAddApplicant}>Tambah Pelamar</Button>
          : <Button icon={<Plus size={16} />} onClick={openAddVacancy}>Buat Lowongan</Button>)} />

      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Lowongan Terbuka" value={lowonganTerbuka} />
        <KpiCard label="Pelamar Masuk" value={pelamarMasuk} />
        <KpiCard label="Rasio Lolos" value={`${rasioLolos.toFixed(1)}%`} sub="Diterima / total keputusan" />
      </div>

      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'pelamar', label: 'Pelamar' }, { value: 'lowongan', label: 'Lowongan' }]} />

      {tab === 'lowongan' && (
        <DataTable
          loading={loading} rows={vacancies} searchKeys={['title', 'position', 'vacancy_no']} emptyTitle="Belum ada lowongan"
          onRowClick={can('HR', 'write') ? openEditVacancy : undefined}
          columns={[
            { key: 'vacancy_no', header: 'No. Lowongan' },
            { key: 'title', header: 'Judul' },
            { key: 'position', header: 'Posisi' },
            { key: 'unit', header: 'Unit' },
            { key: 'branch', header: 'Cabang', render: r => r.branches?.name ?? '-' },
            { key: 'qty', header: 'Kuota', align: 'right' },
            { key: 'open_date', header: 'Dibuka', render: r => tgl(r.open_date) },
            { key: 'close_date', header: 'Ditutup', render: r => tgl(r.close_date) },
            { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
          ]}
        />
      )}

      {tab === 'pelamar' && (
        <>
          <div className="mb-4 max-w-xs">
            <Field label="Filter Lowongan"><Select value={fVacancy} onChange={(e: any) => setFVacancy(e.target.value)} placeholder="Semua lowongan" options={vacancies.map(v => ({ value: v.id, label: v.title }))} /></Field>
          </div>
          {!loading && filteredApplicants.length === 0 ? <EmptyState title="Belum ada pelamar" /> : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[...APPLICANT_STAGES, { value: 'ditolak', label: 'Ditolak' }].map(stage => (
                <div key={stage.value} className="min-w-[260px] w-[260px] shrink-0">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-caption font-semibold text-ink-600 dark:text-ink-300 uppercase tracking-wide">{stage.label}</span>
                    <span className="text-caption text-ink-400">{board[stage.value]?.length ?? 0}</span>
                  </div>
                  <div className="space-y-2">
                    {(board[stage.value] ?? []).map(a => {
                      const idx = APPLICANT_STAGES.findIndex(s => s.value === a.stage)
                      const next = APPLICANT_STAGES[idx + 1]
                      return (
                        <Card key={a.id} className="p-3 cursor-pointer hover:shadow-e2" onClick={() => setDetail(a)}>
                          <p className="font-medium text-body text-ink-800 dark:text-ink-100">{a.full_name}</p>
                          <p className="text-caption text-ink-400 mt-0.5">{a.job_vacancies?.title ?? '-'}</p>
                          {a.score != null && <p className="text-caption text-ink-500 mt-1">Skor: {a.score}</p>}
                          {can('HR', 'write') && a.stage !== 'diterima' && a.stage !== 'ditolak' && (
                            <div className="flex items-center gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                              {next && <Button size="sm" variant="outline" loading={busyId === a.id} onClick={() => moveStage(a, next.value)}>Lanjut →</Button>}
                              <Button size="sm" variant="ghost" className="text-red-600" loading={busyId === a.id} onClick={() => moveStage(a, 'ditolak')}>Tolak</Button>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={vModalOpen} onClose={() => setVModalOpen(false)} title={vForm.id ? 'Ubah Lowongan' : 'Buat Lowongan'} size="lg"
        footer={<><Button variant="outline" onClick={() => setVModalOpen(false)}>Batal</Button><Button loading={vSaving} onClick={saveVacancy}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Judul Lowongan" required><Input value={vForm.title} onChange={(e: any) => setVForm({ ...vForm, title: e.target.value })} /></Field>
          <Field label="Posisi" required><Input value={vForm.position} onChange={(e: any) => setVForm({ ...vForm, position: e.target.value })} /></Field>
          <Field label="Unit"><Input value={vForm.unit} onChange={(e: any) => setVForm({ ...vForm, unit: e.target.value })} /></Field>
          <Field label="Cabang"><Select value={vForm.branch_id} onChange={(e: any) => setVForm({ ...vForm, branch_id: e.target.value })} options={branches.map(b => ({ value: b.id, label: b.name }))} /></Field>
          <Field label="Jenis Hubungan Kerja"><Select value={vForm.employment_type} onChange={(e: any) => setVForm({ ...vForm, employment_type: e.target.value })} options={EMPLOYMENT_TYPE_OPTIONS} /></Field>
          <Field label="Kuota"><Input type="number" min={1} value={vForm.qty} onChange={(e: any) => setVForm({ ...vForm, qty: Number(e.target.value) })} /></Field>
          <Field label="Gaji Minimum"><Money value={vForm.salary_range_min} onChange={(v: number) => setVForm({ ...vForm, salary_range_min: v })} /></Field>
          <Field label="Gaji Maksimum"><Money value={vForm.salary_range_max} onChange={(v: number) => setVForm({ ...vForm, salary_range_max: v })} /></Field>
          <Field label="Tanggal Dibuka"><Input type="date" value={vForm.open_date} onChange={(e: any) => setVForm({ ...vForm, open_date: e.target.value })} /></Field>
          <Field label="Tanggal Ditutup"><Input type="date" value={vForm.close_date} onChange={(e: any) => setVForm({ ...vForm, close_date: e.target.value })} /></Field>
          <Field label="Status"><Select value={vForm.status} onChange={(e: any) => setVForm({ ...vForm, status: e.target.value })} options={VACANCY_STATUS_OPTIONS} /></Field>
          <Field label="Persyaratan" className="sm:col-span-2"><Textarea value={vForm.requirements} onChange={(e: any) => setVForm({ ...vForm, requirements: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={aModalOpen} onClose={() => setAModalOpen(false)} title="Tambah Pelamar"
        footer={<><Button variant="outline" onClick={() => setAModalOpen(false)}>Batal</Button><Button loading={aSaving} onClick={saveApplicant}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Lowongan" required className="sm:col-span-2"><Select value={aForm.vacancy_id} onChange={(e: any) => setAForm({ ...aForm, vacancy_id: e.target.value })} options={vacancies.map(v => ({ value: v.id, label: v.title }))} /></Field>
          <Field label="Nama Lengkap" required className="sm:col-span-2"><Input value={aForm.full_name} onChange={(e: any) => setAForm({ ...aForm, full_name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={aForm.email} onChange={(e: any) => setAForm({ ...aForm, email: e.target.value })} /></Field>
          <Field label="Telepon"><Input value={aForm.phone} onChange={(e: any) => setAForm({ ...aForm, phone: e.target.value })} /></Field>
          <Field label="Pendidikan"><Input value={aForm.education} onChange={(e: any) => setAForm({ ...aForm, education: e.target.value })} /></Field>
          <Field label="Pengalaman (tahun)"><Input type="number" min={0} value={aForm.experience_years} onChange={(e: any) => setAForm({ ...aForm, experience_years: Number(e.target.value) })} /></Field>
          <Field label="Sumber Lamaran"><Select value={aForm.source} onChange={(e: any) => setAForm({ ...aForm, source: e.target.value })} options={APPLICANT_SOURCE_OPTIONS} /></Field>
          <Field label="Unggah CV"><input type="file" onChange={e => setCvFile(e.target.files?.[0] ?? null)}
            className="block w-full text-body text-ink-600 dark:text-ink-300 file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" /></Field>
        </div>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.full_name}>
        {detail && (
          <>
            <div className="mb-4"><Badge>{APPLICANT_STAGES.find(s => s.value === detail.stage)?.label ?? detail.stage}</Badge></div>
            <Desc items={[
              { label: 'Lowongan', value: detail.job_vacancies?.title },
              { label: 'Email', value: detail.email },
              { label: 'Telepon', value: detail.phone },
              { label: 'Pendidikan', value: detail.education },
              { label: 'Pengalaman', value: detail.experience_years != null ? `${detail.experience_years} tahun` : '-' },
              { label: 'Sumber Lamaran', value: detail.source },
              { label: 'Skor', value: detail.score },
              { label: 'Dilamar', value: tgl(detail.applied_at) },
              { label: 'Catatan', value: detail.note },
            ]} />
            <div className="mt-4">
              <Button variant="outline" onClick={() => downloadCv(detail.cv_url)} disabled={!detail.cv_url}>Unduh CV</Button>
            </div>
          </>
        )}
      </Drawer>
    </div>
  )
}
