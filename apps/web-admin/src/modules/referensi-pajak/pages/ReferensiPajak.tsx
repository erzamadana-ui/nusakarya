import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, update, insert } from '@/lib/db'
import { rupiah, tgl, tglJam, exportCSV, todayISO } from '@/lib/format'
import {
  PageHeader, KpiCard, Tabs, DataTable, Badge, Modal, Field, Input, Textarea, Money, Button,
  useToast, ConfirmDialog, Card, CardHeader, Desc,
} from '@/components/ui'
import { AlertTriangle, ShieldCheck, ExternalLink, Download, Plus } from 'lucide-react'
import { FOOTNOTE_PAJAK, TER_CATEGORY_PTKP, TER_CATEGORY_TABS, pctRate } from '../lib/constants'

type TaxRateRef = {
  id: string; tax_code: string; tax_name: string; rate: number; basis_note: string | null
  legal_basis: string | null; source_url: string | null; effective_from: string; effective_to: string | null
  is_verified: boolean; verified_by: string | null; verified_at: string | null; note: string | null
}
type TerRate = {
  id: string; category: string; min_income: number; max_income: number | null; rate: number
  source_note: string | null; effective_from: string | null
  is_verified: boolean; verified_by: string | null; verified_at: string | null
}
type Art17 = {
  id: string; min_income: number; max_income: number | null; rate: number
  source_note: string | null; effective_from: string
  is_verified: boolean; verified_by: string | null; verified_at: string | null
}

const MAIN_TABS = [
  { value: 'umum', label: 'Tarif Umum' },
  { value: 'ter', label: 'TER PPh 21' },
  { value: 'art17', label: 'Pasal 17' },
]

export default function ReferensiPajak() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [taxRates, setTaxRates] = useState<TaxRateRef[]>([])
  const [terRates, setTerRates] = useState<TerRate[]>([])
  const [art17, setArt17] = useState<Art17[]>([])
  const [profiles, setProfiles] = useState<Record<string, string>>({})
  const [tab, setTab] = useState('umum')

  const canFinanceWrite = can('FINANCE', 'write')
  const canFinanceApprove = can('FINANCE', 'approve')
  const canPayrollWrite = can('PAYROLL', 'write')
  const canPayrollApprove = can('PAYROLL', 'approve')

  useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

  async function load() {
    setLoading(true)
    try {
      const [tr, ter, a17, pf] = await Promise.all([
        list<TaxRateRef>('tax_rates_ref', { eq: { company_id: profile!.company_id }, order: { col: 'tax_code', asc: true }, limit: 200 }),
        list<TerRate>('ter_rates', { order: { col: 'min_income', asc: true }, limit: 500 }),
        list<Art17>('tax_brackets_art17', { eq: { company_id: profile!.company_id }, order: { col: 'min_income', asc: true }, limit: 200 }),
        list<any>('profiles', { select: 'id,full_name', order: { col: 'full_name', asc: true }, limit: 500 }),
      ])
      setTaxRates(tr); setTerRates(ter); setArt17(a17)
      const pm: Record<string, string> = {}
      pf.forEach(p => { pm[p.id] = p.full_name })
      setProfiles(pm)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat referensi tarif pajak', 'error') } finally { setLoading(false) }
  }

  const totalTarif = taxRates.length + terRates.length + art17.length
  const totalVerified = taxRates.filter(r => r.is_verified).length + terRates.filter(r => r.is_verified).length + art17.filter(r => r.is_verified).length
  const belum = totalTarif - totalVerified

  return (
    <div>
      <PageHeader title="Referensi Tarif Pajak" subtitle="Seluruh tarif pajak yang dipakai aplikasi, siap ditinjau dan disahkan tim pajak — bukan konstanta tersembunyi di kode." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <KpiCard label="Total Tarif Terdaftar" value={String(totalTarif)} icon={<ShieldCheck size={16} />} sub="Tarif Umum + TER (125 lapisan) + Pasal 17" />
        <KpiCard label="Sudah Diverifikasi" value={`${totalVerified} / ${totalTarif}`} tone="teal" icon={<ShieldCheck size={16} />} />
        {belum > 0 ? (
          <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-body font-semibold text-amber-800 dark:text-amber-300">{belum} tarif belum diverifikasi</div>
                <div className="text-caption text-amber-700 dark:text-amber-400">Jangan dipakai sebagai dasar pemotongan resmi sebelum tim pajak memeriksa dan menandai terverifikasi.</div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900">
            <div className="flex items-start gap-2">
              <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-body font-semibold text-emerald-800 dark:text-emerald-300">Seluruh tarif sudah diverifikasi tim pajak</div>
            </div>
          </Card>
        )}
      </div>

      <Tabs tabs={MAIN_TABS} value={tab} onChange={setTab} className="mb-4" />

      {tab === 'umum' && (
        <TabUmum rows={taxRates} loading={loading} profiles={profiles} canWrite={canFinanceWrite} canApprove={canFinanceApprove}
          onSaved={load} toast={toast} />
      )}
      {tab === 'ter' && (
        <TabTer rows={terRates} loading={loading} profiles={profiles} canWrite={canPayrollWrite} canApprove={canPayrollApprove}
          onSaved={load} toast={toast} />
      )}
      {tab === 'art17' && (
        <TabArt17 rows={art17} loading={loading} profiles={profiles} canWrite={canPayrollWrite} canApprove={canPayrollApprove}
          onSaved={load} toast={toast} />
      )}

      <Card className="p-4 mt-4 bg-ink-50 dark:bg-ink-900/40">
        <p className="text-caption text-ink-500">
          <strong>Catatan:</strong> {FOOTNOTE_PAJAK} Ditarik: {todayISO()}.
        </p>
      </Card>
    </div>
  )
}

/* ============================== TAB: TARIF UMUM ============================== */
const emptyTaxRateForm = {
  tax_code: '', tax_name: '', rate_pct: '', basis_note: '', legal_basis: '', source_url: '',
  effective_from: todayISO(), effective_to: '', note: '',
}

function TabUmum({ rows, loading, profiles, canWrite, canApprove, onSaved, toast }: {
  rows: TaxRateRef[]; loading: boolean; profiles: Record<string, string>; canWrite: boolean; canApprove: boolean
  onSaved: () => void; toast: any
}) {
  const [editing, setEditing] = useState<TaxRateRef | null>(null)
  const [form, setForm] = useState<any>({})
  const [busy, setBusy] = useState(false)
  const [confirmVerify, setConfirmVerify] = useState<TaxRateRef | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<any>(emptyTaxRateForm)
  const { profile } = useAuth()

  function openAdd() { setAddForm(emptyTaxRateForm); setAddOpen(true) }

  function pesanGagal(e: any, aksi: string) {
    const msg = String(e?.message ?? '')
    if (/row-level security|permission denied|RLS/i.test(msg)) {
      return `Gagal ${aksi}: Anda tidak memiliki hak Tulis pada modul Finance untuk referensi pajak. Hubungi admin untuk memberi hak akses.`
    }
    return msg || `Gagal ${aksi}`
  }

  async function tambah() {
    if (!addForm.tax_code.trim()) { toast.push('Kode tarif wajib diisi.', 'error'); return }
    if (!addForm.tax_name.trim()) { toast.push('Nama tarif wajib diisi.', 'error'); return }
    if (addForm.rate_pct === '' || isNaN(Number(addForm.rate_pct))) { toast.push('Tarif (%) wajib diisi.', 'error'); return }
    if (!addForm.effective_from) { toast.push('Berlaku sejak wajib diisi.', 'error'); return }
    setBusy(true)
    try {
      await insert('tax_rates_ref', {
        company_id: profile!.company_id, tax_code: addForm.tax_code.trim().toUpperCase().replace(/\s+/g, '_'),
        tax_name: addForm.tax_name.trim(), rate: Number(addForm.rate_pct) / 100, basis_note: addForm.basis_note || null,
        legal_basis: addForm.legal_basis || null, source_url: addForm.source_url || null,
        effective_from: addForm.effective_from, effective_to: addForm.effective_to || null, note: addForm.note || null,
        is_verified: false,
      })
      toast.push('Tarif baru ditambahkan. Perlu diverifikasi tim pajak sebelum dipakai sebagai dasar resmi.', 'success')
      setAddOpen(false); onSaved()
    } catch (e: any) { toast.push(pesanGagal(e, 'menambah tarif'), 'error') } finally { setBusy(false) }
  }

  function openEdit(row: TaxRateRef) {
    setEditing(row)
    setForm({
      tax_name: row.tax_name, rate_pct: (Number(row.rate) * 100).toString(), basis_note: row.basis_note ?? '',
      legal_basis: row.legal_basis ?? '', source_url: row.source_url ?? '', effective_from: row.effective_from,
      effective_to: row.effective_to ?? '', note: row.note ?? '',
    })
  }

  async function simpan() {
    if (!editing) return
    setBusy(true)
    try {
      await update('tax_rates_ref', editing.id, {
        tax_name: form.tax_name, rate: Number(form.rate_pct) / 100, basis_note: form.basis_note || null,
        legal_basis: form.legal_basis || null, source_url: form.source_url || null,
        effective_from: form.effective_from, effective_to: form.effective_to || null, note: form.note || null,
        // isi diubah => wajib diverifikasi ulang tim pajak
        is_verified: false, verified_by: null, verified_at: null,
      })
      toast.push('Tarif diperbarui. Status verifikasi direset — perlu diverifikasi ulang.', 'success')
      setEditing(null); onSaved()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan tarif', 'error') } finally { setBusy(false) }
  }

  async function verifikasi() {
    if (!confirmVerify) return
    try {
      await update('tax_rates_ref', confirmVerify.id, { is_verified: true, verified_by: profile!.id, verified_at: new Date().toISOString() })
      toast.push('Tarif ditandai terverifikasi.', 'success')
      setConfirmVerify(null); onSaved()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menandai verifikasi', 'error') }
  }

  function exportVerifikasi() {
    exportCSV(rows.map(r => ({
      Kode: r.tax_code, Nama: r.tax_name, 'Tarif (%)': (Number(r.rate) * 100).toFixed(2),
      'Dasar Pengenaan': r.basis_note ?? '', 'Dasar Hukum': r.legal_basis ?? '', 'Sumber': r.source_url ?? '',
      'Berlaku Sejak': r.effective_from, 'Berlaku Sampai': r.effective_to ?? '',
      'Status Verifikasi': r.is_verified ? 'Terverifikasi' : 'Belum Diverifikasi',
      'Diverifikasi Oleh': r.verified_by ? (profiles[r.verified_by] ?? r.verified_by) : '',
      'Diverifikasi Pada': r.verified_at ?? '',
      'Sesuai PMK? (Ya/Tidak)': '', 'Catatan Pemeriksa': '',
    })), 'verifikasi-tarif-umum-pajak')
  }

  return (
    <>
      <DataTable
        loading={loading} rows={rows} rowKey="id" searchKeys={['tax_code', 'tax_name']}
        toolbar={<div className="flex gap-2">
          <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={exportVerifikasi}>Ekspor untuk Verifikasi</Button>
          {canWrite && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Tarif Baru</Button>}
        </div>}
        emptyTitle="Belum ada tarif umum" emptyMessage="Tarif PPN, PPh 23, dan lainnya akan tampil di sini."
        columns={[
          { key: 'tax_code', header: 'Kode', width: '190px' },
          { key: 'tax_name', header: 'Nama Tarif' },
          { key: 'rate', header: 'Tarif', align: 'right', width: '90px', render: r => pctRate(r.rate) },
          { key: 'basis_note', header: 'Dasar Pengenaan', render: r => <span className="text-caption">{r.basis_note ?? '-'}</span> },
          { key: 'legal_basis', header: 'Dasar Hukum', render: r => <span className="text-caption">{r.legal_basis ?? '-'}</span> },
          { key: 'source_url', header: 'Sumber', render: r => r.source_url ? <a href={r.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-600 hover:underline text-caption"><ExternalLink size={12} />Tautan</a> : '-' },
          { key: 'effective_from', header: 'Berlaku Sejak', render: r => tgl(r.effective_from) },
          { key: 'is_verified', header: 'Status', render: r => r.is_verified ? <Badge tone="emerald">Terverifikasi</Badge> : <Badge tone="orange">Belum Diverifikasi</Badge> },
          {
            key: 'aksi', header: '', sortable: false, align: 'right', render: r => (
              <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                {canWrite && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>}
                {canApprove && !r.is_verified && <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => setConfirmVerify(r)}>Tandai Terverifikasi</Button>}
              </div>
            ),
          },
        ]}
      />

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Ubah Tarif Pajak" size="md"
        footer={<Button loading={busy} onClick={simpan}>Simpan</Button>}>
        <div className="space-y-3">
          <Field label="Nama Tarif" required><Input value={form.tax_name ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, tax_name: e.target.value }))} /></Field>
          <Field label="Tarif (%)" required hint="Contoh: 11 untuk 11%"><Input type="number" step="0.01" value={form.rate_pct ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, rate_pct: e.target.value }))} /></Field>
          <Field label="Dasar Pengenaan Pajak"><Textarea rows={2} value={form.basis_note ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, basis_note: e.target.value }))} /></Field>
          <Field label="Dasar Hukum"><Textarea rows={2} value={form.legal_basis ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, legal_basis: e.target.value }))} /></Field>
          <Field label="URL Sumber"><Input value={form.source_url ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, source_url: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Berlaku Sejak"><Input type="date" value={form.effective_from ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, effective_from: e.target.value }))} /></Field>
            <Field label="Berlaku Sampai"><Input type="date" value={form.effective_to ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, effective_to: e.target.value }))} /></Field>
          </div>
          <Field label="Catatan"><Textarea rows={2} value={form.note ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, note: e.target.value }))} /></Field>
          <p className="text-caption text-ink-400">Menyimpan perubahan akan mereset status verifikasi — tim pajak perlu memeriksa ulang.</p>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmVerify} onClose={() => setConfirmVerify(null)} onConfirm={verifikasi}
        title="Tandai Terverifikasi" message={`Nyatakan tarif "${confirmVerify?.tax_name}" telah dicocokkan ke peraturan resmi oleh tim pajak?`} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Tambah Tarif Baru" size="md"
        footer={<Button loading={busy} onClick={tambah}>Simpan</Button>}>
        <div className="space-y-3">
          <Field label="Kode Tarif" required hint="Kode unik, huruf besar & garis bawah. Cth: PPN_BARANG_MEWAH">
            <Input value={addForm.tax_code ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, tax_code: e.target.value }))} placeholder="cth. PPN_BARANG_MEWAH" />
          </Field>
          <Field label="Nama Tarif" required><Input value={addForm.tax_name ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, tax_name: e.target.value }))} /></Field>
          <Field label="Tarif (%)" required hint="Contoh: 11 untuk 11%"><Input type="number" step="0.01" value={addForm.rate_pct ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, rate_pct: e.target.value }))} /></Field>
          <Field label="Dasar Pengenaan Pajak"><Textarea rows={2} value={addForm.basis_note ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, basis_note: e.target.value }))} /></Field>
          <Field label="Dasar Hukum"><Textarea rows={2} value={addForm.legal_basis ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, legal_basis: e.target.value }))} /></Field>
          <Field label="URL Sumber"><Input value={addForm.source_url ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, source_url: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Berlaku Sejak" required><Input type="date" value={addForm.effective_from ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, effective_from: e.target.value }))} /></Field>
            <Field label="Berlaku Sampai" hint="Kosongkan bila masih berlaku."><Input type="date" value={addForm.effective_to ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, effective_to: e.target.value }))} /></Field>
          </div>
          <Field label="Catatan"><Textarea rows={2} value={addForm.note ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, note: e.target.value }))} /></Field>
          <p className="text-caption text-ink-400">Baris tarif lama TIDAK dihapus otomatis — bila tarif ini menggantikan tarif lama, buka tarif lama lalu isi "Berlaku Sampai" agar riwayat perhitungan lama tetap utuh.</p>
        </div>
      </Modal>
    </>
  )
}

/* ============================== TAB: TER PPh 21 ============================== */
function TabTer({ rows, loading, profiles, canWrite, canApprove, onSaved, toast }: {
  rows: TerRate[]; loading: boolean; profiles: Record<string, string>; canWrite: boolean; canApprove: boolean
  onSaved: () => void; toast: any
}) {
  const [category, setCategory] = useState('A')
  const [gross, setGross] = useState<number>(0)
  const [editing, setEditing] = useState<TerRate | null>(null)
  const [form, setForm] = useState<any>({})
  const [busy, setBusy] = useState(false)
  const [confirmVerify, setConfirmVerify] = useState<TerRate | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<any>({ category: 'A', min_income: '', max_income: '', rate_pct: '', effective_from: todayISO(), source_note: '' })
  const { profile } = useAuth()

  function pesanGagal(e: any, aksi: string) {
    const msg = String(e?.message ?? '')
    if (/row-level security|permission denied|RLS/i.test(msg)) {
      return `Gagal ${aksi}: Anda tidak memiliki hak Tulis pada modul Payroll untuk referensi TER. Hubungi admin untuk memberi hak akses.`
    }
    return msg || `Gagal ${aksi}`
  }

  function openAdd() { setAddForm({ category, min_income: '', max_income: '', rate_pct: '', effective_from: todayISO(), source_note: '' }); setAddOpen(true) }

  async function tambah() {
    if (!addForm.category) { toast.push('Kategori wajib dipilih.', 'error'); return }
    if (addForm.min_income === '' || isNaN(Number(addForm.min_income))) { toast.push('Batas bawah wajib diisi.', 'error'); return }
    if (addForm.rate_pct === '' || isNaN(Number(addForm.rate_pct))) { toast.push('Tarif (%) wajib diisi.', 'error'); return }
    setBusy(true)
    try {
      await insert('ter_rates', {
        category: addForm.category, min_income: Number(addForm.min_income), max_income: addForm.max_income === '' ? null : Number(addForm.max_income),
        rate: Number(addForm.rate_pct) / 100, source_note: addForm.source_note || null, effective_from: addForm.effective_from || null,
        is_verified: false,
      })
      toast.push('Lapisan TER baru ditambahkan. Perlu diverifikasi tim payroll.', 'success')
      setAddOpen(false); onSaved()
    } catch (e: any) { toast.push(pesanGagal(e, 'menambah lapisan TER'), 'error') } finally { setBusy(false) }
  }

  const catRows = useMemo(() => rows.filter(r => r.category === category), [rows, category])
  const matched = useMemo(() => {
    if (!gross || gross <= 0) return null
    return catRows.find(r => gross >= Number(r.min_income) && gross <= Number(r.max_income ?? Infinity)) ?? null
  }, [catRows, gross])

  function openEdit(row: TerRate) {
    setEditing(row)
    setForm({ rate_pct: (Number(row.rate) * 100).toString(), source_note: row.source_note ?? '', effective_from: row.effective_from ?? '' })
  }

  async function simpan() {
    if (!editing) return
    setBusy(true)
    try {
      await update('ter_rates', editing.id, {
        rate: Number(form.rate_pct) / 100, source_note: form.source_note || null, effective_from: form.effective_from || null,
        is_verified: false, verified_by: null, verified_at: null,
      })
      toast.push('Lapisan TER diperbarui. Status verifikasi direset.', 'success')
      setEditing(null); onSaved()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan lapisan TER', 'error') } finally { setBusy(false) }
  }

  async function verifikasi() {
    if (!confirmVerify) return
    try {
      await update('ter_rates', confirmVerify.id, { is_verified: true, verified_by: profile!.id, verified_at: new Date().toISOString() })
      toast.push('Lapisan TER ditandai terverifikasi.', 'success')
      setConfirmVerify(null); onSaved()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menandai verifikasi', 'error') }
  }

  function exportVerifikasi() {
    exportCSV(rows.map(r => ({
      Kategori: r.category, 'Batas Bawah': r.min_income, 'Batas Atas': r.max_income ?? '',
      'Tarif (%)': (Number(r.rate) * 100).toFixed(4), 'Sumber': r.source_note ?? '', 'Berlaku Sejak': r.effective_from ?? '',
      'Status Verifikasi': r.is_verified ? 'Terverifikasi' : 'Belum Diverifikasi',
      'Diverifikasi Oleh': r.verified_by ? (profiles[r.verified_by] ?? r.verified_by) : '',
      'Diverifikasi Pada': r.verified_at ?? '',
      'Sesuai PMK 168/2023? (Ya/Tidak)': '', 'Catatan Pemeriksa': '',
    })), 'verifikasi-ter-pph21')
  }

  return (
    <>
      <Card className="p-4 mb-3">
        <CardHeader title="Cari Lapisan TER" subtitle="Ketik penghasilan bruto sebulan untuk melihat lapisan mana yang terambil dan tarifnya — cocokkan dengan Lampiran PMK 168/2023." />
        <div className="flex flex-wrap items-end gap-3 mt-2">
          <Tabs tabs={TER_CATEGORY_TABS} value={category} onChange={setCategory} />
          <Field label="Penghasilan Bruto Sebulan" className="w-64"><Money value={gross} onChange={setGross} /></Field>
        </div>
        <p className="text-caption text-ink-400 mt-2">
          Kategori A: PTKP {TER_CATEGORY_PTKP.A.join(', ')} · Kategori B: PTKP {TER_CATEGORY_PTKP.B.join(', ')} · Kategori C: PTKP {TER_CATEGORY_PTKP.C.join(', ')}
        </p>
        {gross > 0 && (
          matched ? (
            <div className="mt-3 rounded-sm border border-primary-200 bg-primary-50 dark:bg-primary-950/30 dark:border-primary-900 p-3">
              <Desc cols={3} items={[
                { label: 'Lapisan Terambil', value: `${rupiah(matched.min_income)} – ${matched.max_income ? rupiah(matched.max_income) : 'tanpa batas'}` },
                { label: 'Tarif TER', value: <span className="font-semibold text-primary-600">{pctRate(matched.rate, 4)}</span> },
                { label: 'Status Verifikasi', value: matched.is_verified ? <Badge tone="emerald">Terverifikasi</Badge> : <Badge tone="orange">Belum Diverifikasi</Badge> },
              ]} />
            </div>
          ) : (
            <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-body text-amber-700 dark:text-amber-300">
              Tidak ada lapisan Kategori {category} yang mencakup Rp {rupiah(gross).replace('Rp ', '')}.
            </div>
          )
        )}
      </Card>

      <DataTable
        loading={loading} rows={catRows} rowKey="id" searchable={false}
        toolbar={<div className="flex gap-2">
          <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={exportVerifikasi}>Ekspor untuk Verifikasi</Button>
          {canWrite && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Lapisan Baru</Button>}
        </div>}
        emptyTitle="Belum ada lapisan TER" emptyMessage="Lapisan TER kategori ini belum tersedia."
        columns={[
          { key: 'min_income', header: 'Batas Bawah', align: 'right', render: r => rupiah(r.min_income) },
          { key: 'max_income', header: 'Batas Atas', align: 'right', render: r => r.max_income ? rupiah(r.max_income) : 'Tanpa batas' },
          { key: 'rate', header: 'Tarif', align: 'right', width: '110px', render: r => pctRate(r.rate, 4) },
          { key: '_match', header: 'Pencarian', render: r => matched?.id === r.id ? <Badge tone="emerald">Lapisan Ditemukan</Badge> : '-' },
          { key: 'is_verified', header: 'Status', render: r => r.is_verified ? <Badge tone="emerald">Terverifikasi</Badge> : <Badge tone="orange">Belum Diverifikasi</Badge> },
          {
            key: 'aksi', header: '', sortable: false, align: 'right', render: r => (
              <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                {canWrite && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>}
                {canApprove && !r.is_verified && <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => setConfirmVerify(r)}>Tandai Terverifikasi</Button>}
              </div>
            ),
          },
        ]}
      />

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Ubah Lapisan TER" size="sm"
        footer={<Button loading={busy} onClick={simpan}>Simpan</Button>}>
        <div className="space-y-3">
          <Desc cols={2} items={[
            { label: 'Kategori', value: editing?.category },
            { label: 'Rentang', value: editing ? `${rupiah(editing.min_income)} – ${editing.max_income ? rupiah(editing.max_income) : 'tanpa batas'}` : '-' },
          ]} />
          <Field label="Tarif (%)" required hint="Contoh: 1.5 untuk 1,5%"><Input type="number" step="0.0001" value={form.rate_pct ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, rate_pct: e.target.value }))} /></Field>
          <Field label="Sumber / Catatan"><Textarea rows={2} value={form.source_note ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, source_note: e.target.value }))} /></Field>
          <Field label="Berlaku Sejak"><Input type="date" value={form.effective_from ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, effective_from: e.target.value }))} /></Field>
          <p className="text-caption text-ink-400">Menyimpan perubahan akan mereset status verifikasi — tim pajak perlu memeriksa ulang.</p>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmVerify} onClose={() => setConfirmVerify(null)} onConfirm={verifikasi}
        title="Tandai Terverifikasi" message={confirmVerify ? `Nyatakan lapisan TER ${confirmVerify.category} (${rupiah(confirmVerify.min_income)} – ${confirmVerify.max_income ? rupiah(confirmVerify.max_income) : 'tanpa batas'}) sudah dicocokkan ke Lampiran PMK 168/2023?` : ''} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Tambah Lapisan TER Baru" size="sm"
        footer={<Button loading={busy} onClick={tambah}>Simpan</Button>}>
        <div className="space-y-3">
          <Field label="Kategori" required><Tabs tabs={TER_CATEGORY_TABS} value={addForm.category} onChange={(v: any) => setAddForm((f: any) => ({ ...f, category: v }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Batas Bawah" required><Money value={addForm.min_income === '' ? 0 : Number(addForm.min_income)} onChange={(v: number) => setAddForm((f: any) => ({ ...f, min_income: v }))} /></Field>
            <Field label="Batas Atas" hint="Kosongkan bila tanpa batas atas."><Money value={addForm.max_income === '' ? 0 : Number(addForm.max_income)} onChange={(v: number) => setAddForm((f: any) => ({ ...f, max_income: v }))} /></Field>
          </div>
          <Field label="Tarif (%)" required hint="Contoh: 1.5 untuk 1,5%"><Input type="number" step="0.0001" value={addForm.rate_pct ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, rate_pct: e.target.value }))} /></Field>
          <Field label="Sumber / Catatan"><Textarea rows={2} value={addForm.source_note ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, source_note: e.target.value }))} /></Field>
          <Field label="Berlaku Sejak"><Input type="date" value={addForm.effective_from ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, effective_from: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  )
}

/* ============================== TAB: PASAL 17 ============================== */
function TabArt17({ rows, loading, profiles, canWrite, canApprove, onSaved, toast }: {
  rows: Art17[]; loading: boolean; profiles: Record<string, string>; canWrite: boolean; canApprove: boolean
  onSaved: () => void; toast: any
}) {
  const [editing, setEditing] = useState<Art17 | null>(null)
  const [form, setForm] = useState<any>({})
  const [busy, setBusy] = useState(false)
  const [confirmVerify, setConfirmVerify] = useState<Art17 | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<any>({ min_income: '', max_income: '', rate_pct: '', effective_from: todayISO(), source_note: '' })
  const { profile } = useAuth()

  function pesanGagal(e: any, aksi: string) {
    const msg = String(e?.message ?? '')
    if (/row-level security|permission denied|RLS/i.test(msg)) {
      return `Gagal ${aksi}: Anda tidak memiliki hak Setujui pada modul Payroll untuk menambah lapisan Pasal 17. Hubungi admin untuk memberi hak akses.`
    }
    return msg || `Gagal ${aksi}`
  }

  function openAdd() { setAddForm({ min_income: '', max_income: '', rate_pct: '', effective_from: todayISO(), source_note: '' }); setAddOpen(true) }

  async function tambah() {
    if (addForm.min_income === '' || isNaN(Number(addForm.min_income))) { toast.push('Batas bawah wajib diisi.', 'error'); return }
    if (addForm.rate_pct === '' || isNaN(Number(addForm.rate_pct))) { toast.push('Tarif (%) wajib diisi.', 'error'); return }
    if (!addForm.effective_from) { toast.push('Berlaku sejak wajib diisi.', 'error'); return }
    setBusy(true)
    try {
      await insert('tax_brackets_art17', {
        company_id: profile!.company_id, min_income: Number(addForm.min_income),
        max_income: addForm.max_income === '' ? null : Number(addForm.max_income),
        rate: Number(addForm.rate_pct) / 100, source_note: addForm.source_note || null, effective_from: addForm.effective_from,
        is_verified: false,
      })
      toast.push('Lapisan Pasal 17 baru ditambahkan. Perlu diverifikasi tim payroll.', 'success')
      setAddOpen(false); onSaved()
    } catch (e: any) { toast.push(pesanGagal(e, 'menambah lapisan Pasal 17'), 'error') } finally { setBusy(false) }
  }

  function openEdit(row: Art17) {
    setEditing(row)
    setForm({ rate_pct: (Number(row.rate) * 100).toString(), source_note: row.source_note ?? '', effective_from: row.effective_from })
  }

  async function simpan() {
    if (!editing) return
    setBusy(true)
    try {
      await update('tax_brackets_art17', editing.id, {
        rate: Number(form.rate_pct) / 100, source_note: form.source_note || null, effective_from: form.effective_from,
        is_verified: false, verified_by: null, verified_at: null,
      })
      toast.push('Lapisan Pasal 17 diperbarui. Status verifikasi direset.', 'success')
      setEditing(null); onSaved()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan lapisan Pasal 17', 'error') } finally { setBusy(false) }
  }

  async function verifikasi() {
    if (!confirmVerify) return
    try {
      await update('tax_brackets_art17', confirmVerify.id, { is_verified: true, verified_by: profile!.id, verified_at: new Date().toISOString() })
      toast.push('Lapisan Pasal 17 ditandai terverifikasi.', 'success')
      setConfirmVerify(null); onSaved()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menandai verifikasi', 'error') }
  }

  function exportVerifikasi() {
    exportCSV(rows.map(r => ({
      'Batas Bawah': r.min_income, 'Batas Atas': r.max_income ?? '', 'Tarif (%)': (Number(r.rate) * 100).toFixed(2),
      'Sumber': r.source_note ?? '', 'Berlaku Sejak': r.effective_from,
      'Status Verifikasi': r.is_verified ? 'Terverifikasi' : 'Belum Diverifikasi',
      'Diverifikasi Oleh': r.verified_by ? (profiles[r.verified_by] ?? r.verified_by) : '',
      'Diverifikasi Pada': r.verified_at ?? '',
      'Sesuai UU HPP? (Ya/Tidak)': '', 'Catatan Pemeriksa': '',
    })), 'verifikasi-pph-pasal17')
  }

  return (
    <>
      <DataTable
        loading={loading} rows={rows} rowKey="id" searchable={false}
        toolbar={<div className="flex gap-2">
          <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={exportVerifikasi}>Ekspor untuk Verifikasi</Button>
          {canApprove && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Lapisan Baru</Button>}
        </div>}
        emptyTitle="Belum ada lapisan Pasal 17" emptyMessage="Tarif progresif Pasal 17 belum tersedia."
        columns={[
          { key: 'min_income', header: 'Batas Bawah', align: 'right', render: r => rupiah(r.min_income) },
          { key: 'max_income', header: 'Batas Atas', align: 'right', render: r => r.max_income ? rupiah(r.max_income) : 'Tanpa batas' },
          { key: 'rate', header: 'Tarif', align: 'right', width: '90px', render: r => pctRate(r.rate) },
          { key: 'effective_from', header: 'Berlaku Sejak', render: r => tgl(r.effective_from) },
          { key: 'is_verified', header: 'Status', render: r => r.is_verified ? <Badge tone="emerald">Terverifikasi</Badge> : <Badge tone="orange">Belum Diverifikasi</Badge> },
          {
            key: 'aksi', header: '', sortable: false, align: 'right', render: r => (
              <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                {canWrite && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>}
                {canApprove && !r.is_verified && <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => setConfirmVerify(r)}>Tandai Terverifikasi</Button>}
              </div>
            ),
          },
        ]}
      />

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Ubah Lapisan Pasal 17" size="sm"
        footer={<Button loading={busy} onClick={simpan}>Simpan</Button>}>
        <div className="space-y-3">
          <Desc cols={2} items={[
            { label: 'Rentang', value: editing ? `${rupiah(editing.min_income)} – ${editing.max_income ? rupiah(editing.max_income) : 'tanpa batas'}` : '-' },
          ]} />
          <Field label="Tarif (%)" required hint="Contoh: 5 untuk 5%"><Input type="number" step="0.01" value={form.rate_pct ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, rate_pct: e.target.value }))} /></Field>
          <Field label="Sumber / Catatan"><Textarea rows={2} value={form.source_note ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, source_note: e.target.value }))} /></Field>
          <Field label="Berlaku Sejak" required><Input type="date" value={form.effective_from ?? ''} onChange={(e: any) => setForm((f: any) => ({ ...f, effective_from: e.target.value }))} /></Field>
          <p className="text-caption text-ink-400">Menyimpan perubahan akan mereset status verifikasi — tim pajak perlu memeriksa ulang.</p>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmVerify} onClose={() => setConfirmVerify(null)} onConfirm={verifikasi}
        title="Tandai Terverifikasi" message={confirmVerify ? `Nyatakan lapisan Pasal 17 (${rupiah(confirmVerify.min_income)} – ${confirmVerify.max_income ? rupiah(confirmVerify.max_income) : 'tanpa batas'}) sudah dicocokkan ke UU HPP?` : ''} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Tambah Lapisan Pasal 17 Baru" size="sm"
        footer={<Button loading={busy} onClick={tambah}>Simpan</Button>}>
        <div className="space-y-3">
          <p className="text-caption text-ink-400">Menambah lapisan baru memerlukan hak Setujui Payroll — perubahan tarif progresif berdampak luas ke seluruh perhitungan gaji.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Batas Bawah" required><Money value={addForm.min_income === '' ? 0 : Number(addForm.min_income)} onChange={(v: number) => setAddForm((f: any) => ({ ...f, min_income: v }))} /></Field>
            <Field label="Batas Atas" hint="Kosongkan bila tanpa batas atas."><Money value={addForm.max_income === '' ? 0 : Number(addForm.max_income)} onChange={(v: number) => setAddForm((f: any) => ({ ...f, max_income: v }))} /></Field>
          </div>
          <Field label="Tarif (%)" required hint="Contoh: 5 untuk 5%"><Input type="number" step="0.01" value={addForm.rate_pct ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, rate_pct: e.target.value }))} /></Field>
          <Field label="Sumber / Catatan"><Textarea rows={2} value={addForm.source_note ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, source_note: e.target.value }))} /></Field>
          <Field label="Berlaku Sejak" required><Input type="date" value={addForm.effective_from ?? ''} onChange={(e: any) => setAddForm((f: any) => ({ ...f, effective_from: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  )
}
