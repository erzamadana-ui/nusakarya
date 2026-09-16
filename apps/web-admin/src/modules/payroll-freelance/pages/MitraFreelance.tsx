import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import {
 PageHeader, Card, DataTable, Badge, Button, Modal, Field, Input, Select, Checkbox, Textarea,
 Tabs, KpiCard, useToast, Plus, EmptyState, TableSkeleton, Desc,
} from '@/components/ui'
import { rupiah, num, tgl, todayISO, periodCode } from '@/lib/format'
import { PAYROLL_SCHEME_OPTIONS, APPLIES_TO_OPTIONS, periodRange, PRICE_SOURCE_OPTIONS, PRICE_SOURCE_LABEL, priceSourceTone } from '../lib/constants'
import { Copy, Upload } from 'lucide-react'

const isMitra = (e: any) => e.employment_type === 'MITRA' || ['freelance', 'campuran'].includes(e.payroll_scheme)

const emptyRateCard = {
 id: null, appliesTo: 'umum', employee_id: '', vendor_id: '', job_type_id: '',
 rate_amount: 0, min_qty: 1, effective_date: todayISO(), end_date: '', is_active: true, note: '',
 price_source: 'asumsi_sistem', price_source_ref: '',
}

export default function MitraFreelance() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const write = can('PAYROLL', 'write')
 const [tab, setTab] = useState('mitra')

 const [loading, setLoading] = useState(true)
 const [employees, setEmployees] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])
 const [vendors, setVendors] = useState<any[]>([])
 const [jobTypes, setJobTypes] = useState<any[]>([])
 const [rateCards, setRateCards] = useState<any[]>([])
 const [prodByEmployee, setProdByEmployee] = useState<Record<string, { points: number; amount: number }>>({})

 const [schemeModal, setSchemeModal] = useState<any>(null)
 const [schemeSaving, setSchemeSaving] = useState(false)

 const [rcModal, setRcModal] = useState(false)
 const [rcForm, setRcForm] = useState<any>(emptyRateCard)
 const [rcSaving, setRcSaving] = useState(false)

 const [copyModal, setCopyModal] = useState(false)
 const [copySrc, setCopySrc] = useState(''); const [copyDst, setCopyDst] = useState(''); const [copying, setCopying] = useState(false)

 const [importModal, setImportModal] = useState(false)
 const [importTarget, setImportTarget] = useState<any>({ appliesTo: 'umum', employee_id: '', vendor_id: '' })
 const [importText, setImportText] = useState(''); const [importing, setImporting] = useState(false)

 useEffect(() => { loadAll() }, [])

 async function loadAll() {
 setLoading(true)
 try {
 const period = periodCode()
 const [start, end] = periodRange(period)
 const [emp, br, ven, jt, rc, prod] = await Promise.all([
 list<any>('employees', { select: 'id,full_name,npwp,bank_name,bank_account,bank_holder,status,payroll_scheme,employment_type,branch_id,default_rate_card_id', order: { col: 'full_name', asc: true } }),
 list<any>('branches', { order: { col: 'name', asc: true } }),
 list<any>('vendors', { order: { col: 'name', asc: true } }),
 list<any>('job_types', { eq: { is_active: true }, order: { col: 'name', asc: true } }),
 list<any>('freelance_rate_cards', { select: '*,job_types(name,code)', order: { col: 'effective_date', asc: false } }),
 list<any>('productivity_entries', { select: 'employee_id,points,amount', gte: { work_date: start }, lte: { work_date: end } }),
 ])
 setEmployees(emp.filter(isMitra))
 setBranches(br); setVendors(ven); setJobTypes(jt); setRateCards(rc)
 const m: Record<string, { points: number; amount: number }> = {}
 prod.forEach((p: any) => {
 if (!p.employee_id) return
 const cur = m[p.employee_id] || { points: 0, amount: 0 }
 cur.points += Number(p.points || 0); cur.amount += Number(p.amount || 0)
 m[p.employee_id] = cur
 })
 setProdByEmployee(m)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data mitra freelance', 'error') }
 finally { setLoading(false) }
 }

 const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
 const vendorName = (id?: string) => vendors.find(v => v.id === id)?.name ?? '-'
 const employeeName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'
 const rateCardLabel = (id?: string | null) => {
 const rc = rateCards.find(r => r.id === id)
 return rc ? `${rc.job_types?.name ?? '-'} — ${rupiah(rc.rate_amount)}` : '-'
 }

 const mitraTanpaRateCard = useMemo(() => {
 const withCard = new Set(rateCards.filter(r => r.is_active && r.employee_id).map(r => r.employee_id))
 return employees.filter(e => e.status === 'aktif' && !withCard.has(e.id))
 }, [employees, rateCards])

 const kpi = useMemo(() => {
 const aktif = employees.filter(e => e.status === 'aktif')
 const activeCards = rateCards.filter(r => r.is_active)
 const avgRate = activeCards.length ? activeCards.reduce((s, r) => s + Number(r.rate_amount || 0), 0) / activeCards.length : 0
 const tanpaNpwp = aktif.filter(e => !e.npwp).length
 return { aktif: aktif.length, avgRate, tanpaNpwp, tanpaRateCard: mitraTanpaRateCard.length }
 }, [employees, rateCards, mitraTanpaRateCard])

 function openScheme(emp: any) { setSchemeModal({ ...emp }) }
 async function saveScheme() {
 setSchemeSaving(true)
 try {
 await update('employees', schemeModal.id, { payroll_scheme: schemeModal.payroll_scheme })
 toast.push('Skema payroll karyawan diperbarui'); setSchemeModal(null); loadAll()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah skema payroll', 'error') }
 finally { setSchemeSaving(false) }
 }

 function openAddRc() { setRcForm(emptyRateCard); setRcModal(true) }
 function openEditRc(r: any) {
 setRcForm({
 id: r.id, appliesTo: r.employee_id ? 'mitra' : r.vendor_id ? 'vendor' : 'umum',
 employee_id: r.employee_id ?? '', vendor_id: r.vendor_id ?? '', job_type_id: r.job_type_id,
 rate_amount: r.rate_amount, min_qty: r.min_qty, effective_date: r.effective_date, end_date: r.end_date ?? '', is_active: r.is_active, note: r.note ?? '',
 price_source: r.price_source ?? 'asumsi_sistem', price_source_ref: r.price_source_ref ?? '',
 })
 setRcModal(true)
 }
 async function saveRc() {
 if (!rcForm.job_type_id || !rcForm.rate_amount) { toast.push('Jenis pekerjaan dan tarif wajib diisi', 'error'); return }
 if (rcForm.appliesTo === 'mitra' && !rcForm.employee_id) { toast.push('Pilih mitra untuk rate card khusus mitra', 'error'); return }
 if (rcForm.appliesTo === 'vendor' && !rcForm.vendor_id) { toast.push('Pilih vendor untuk rate card vendor', 'error'); return }
 setRcSaving(true)
 try {
 const payload = {
 job_type_id: rcForm.job_type_id, rate_amount: rcForm.rate_amount, min_qty: rcForm.min_qty || 0,
 effective_date: rcForm.effective_date, end_date: rcForm.end_date || null, is_active: rcForm.is_active, note: rcForm.note || null,
 employee_id: rcForm.appliesTo === 'mitra' ? rcForm.employee_id : null,
 vendor_id: rcForm.appliesTo === 'vendor' ? rcForm.vendor_id : null,
 price_source: rcForm.price_source || 'asumsi_sistem', price_source_ref: rcForm.price_source_ref || null,
 }
 if (rcForm.id) { await update('freelance_rate_cards', rcForm.id, payload); toast.push('Rate card diperbarui') }
 else { await insert('freelance_rate_cards', { ...payload, company_id: profile?.company_id, created_by: profile?.id }); toast.push('Rate card ditambahkan') }
 setRcModal(false); loadAll()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan rate card', 'error') }
 finally { setRcSaving(false) }
 }

 async function markRcVerified(row: any) {
 try {
 await update('freelance_rate_cards', row.id, { price_verified_at: new Date().toISOString(), price_verified_by: profile?.id })
 toast.push('Rate card ditandai terverifikasi'); loadAll()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menandai verifikasi', 'error') }
 }

 async function doCopy() {
 if (!copySrc || !copyDst) { toast.push('Pilih mitra sumber dan mitra tujuan', 'error'); return }
 const source = rateCards.filter(r => r.employee_id === copySrc && r.is_active)
 if (!source.length) { toast.push('Mitra sumber tidak punya rate card aktif', 'error'); return }
 setCopying(true)
 try {
 await Promise.all(source.map(r => insert('freelance_rate_cards', {
 company_id: profile?.company_id, created_by: profile?.id, employee_id: copyDst, vendor_id: null,
 job_type_id: r.job_type_id, rate_amount: r.rate_amount, min_qty: r.min_qty, effective_date: todayISO(),
 end_date: null, is_active: true, note: `Disalin dari ${employeeName(copySrc)}`,
 price_source: r.price_source ?? 'asumsi_sistem', price_source_ref: r.price_source_ref ?? null,
 })))
 toast.push(`${source.length} tarif disalin ke ${employeeName(copyDst)}`); setCopyModal(false); setCopySrc(''); setCopyDst(''); loadAll()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyalin rate card', 'error') }
 finally { setCopying(false) }
 }

 async function doImport() {
 const lines = importText.split('\n').map(l => l.trim()).filter(Boolean)
 if (!lines.length) { toast.push('Textarea impor kosong', 'error'); return }
 if (importTarget.appliesTo === 'mitra' && !importTarget.employee_id) { toast.push('Pilih mitra tujuan', 'error'); return }
 if (importTarget.appliesTo === 'vendor' && !importTarget.vendor_id) { toast.push('Pilih vendor tujuan', 'error'); return }
 setImporting(true)
 try {
 let ok = 0; const gagal: string[] = []
 for (const line of lines) {
 const [kode, tarifStr] = line.split('|').map(s => s?.trim())
 const jt = jobTypes.find(j => j.code?.toLowerCase() === kode?.toLowerCase())
 const tarif = Number(tarifStr)
 if (!jt || !tarif) { gagal.push(line); continue }
 await insert('freelance_rate_cards', {
 company_id: profile?.company_id, created_by: profile?.id,
 employee_id: importTarget.appliesTo === 'mitra' ? importTarget.employee_id : null,
 vendor_id: importTarget.appliesTo === 'vendor' ? importTarget.vendor_id : null,
 job_type_id: jt.id, rate_amount: tarif, min_qty: 1, effective_date: todayISO(), end_date: null, is_active: true,
 note: 'Impor cepat',
 })
 ok++
 }
 toast.push(`${ok} tarif berhasil diimpor${gagal.length ? `, ${gagal.length} baris gagal (kode tidak ditemukan)` : ''}`, gagal.length ? 'error' : 'success')
 setImportModal(false); setImportText(''); loadAll()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengimpor rate card', 'error') }
 finally { setImporting(false) }
 }

 return (
 <div>
 <PageHeader title="Mitra Freelance & Rate Card" subtitle="Kelola data mitra pembayaran per satuan pekerjaan dan tarif kerjanya" />

 <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[
 { value: 'mitra', label: 'Mitra' },
 { value: 'rate_card', label: 'Rate Card' },
 ]} />

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
 <KpiCard label="Mitra Aktif" value={kpi.aktif} tone="teal" />
 <KpiCard label="Tarif Rata-rata / Pekerjaan" value={rupiah(kpi.avgRate)} tone="emerald" />
 <KpiCard label="Mitra Tanpa NPWP" value={kpi.tanpaNpwp} tone="amber" sub="Pajak dipotong +20%" />
 <KpiCard label="Mitra Tanpa Rate Card" value={kpi.tanpaRateCard} tone="red" sub="Pekerjaan tak bisa dihitung otomatis" />
 </div>
 <p className="text-caption text-ink-400 -mt-3 mb-5">Sumber data: tabel employees, freelance_rate_cards, productivity_entries — ditarik {tgl(todayISO())}.</p>

 {tab === 'mitra' && (
 <DataTable
 loading={loading} rows={employees} searchKeys={['full_name', 'npwp']} emptyTitle="Belum ada mitra freelance terdaftar"
 columns={[
 { key: 'full_name', header: 'Nama Mitra' },
 { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
 { key: 'npwp', header: 'NPWP', render: r => r.npwp ? r.npwp : <Badge tone="red">Tanpa NPWP</Badge> },
 { key: 'bank', header: 'Rekening Bank', render: r => r.bank_account ? `${r.bank_name ?? '-'} • ${r.bank_account} a.n. ${r.bank_holder ?? '-'}` : '-' },
 { key: 'default_rate_card_id', header: 'Rate Card Default', render: r => rateCardLabel(r.default_rate_card_id) },
 { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
 { key: 'poin', header: 'Poin Bln Ini', align: 'right', render: r => num(prodByEmployee[r.id]?.points ?? 0, 1) },
 { key: 'nilai', header: 'Nilai Bln Ini', align: 'right', render: r => rupiah(prodByEmployee[r.id]?.amount ?? 0) },
 ...(write ? [{ key: 'aksi', header: '', render: (r: any) => <Button size="sm" variant="outline" onClick={(e: any) => { e.stopPropagation(); openScheme(r) }}>Ubah Skema</Button> }] : []),
 ]}
 />
 )}

 {tab === 'rate_card' && (
 <>
 {write && (
 <div className="flex flex-wrap justify-end gap-2 mb-4">
 <Button variant="outline" icon={<Upload size={14} />} onClick={() => setImportModal(true)}>Impor Cepat</Button>
 <Button variant="outline" icon={<Copy size={14} />} onClick={() => setCopyModal(true)}>Salin Rate Card</Button>
 <Button icon={<Plus size={16} />} onClick={openAddRc}>Tambah Rate Card</Button>
 </div>
 )}
 <DataTable
 loading={loading} rows={rateCards} onRowClick={write ? openEditRc : undefined} emptyTitle="Belum ada rate card"
 searchable={false}
 columns={[
 { key: 'berlaku', header: 'Berlaku Untuk', render: r => r.employee_id ? <Badge tone="blue">{employeeName(r.employee_id)}</Badge> : r.vendor_id ? <Badge tone="teal">{vendorName(r.vendor_id)}</Badge> : <Badge tone="slate">Umum</Badge> },
 { key: 'job', header: 'Jenis Pekerjaan', render: r => r.job_types?.name ?? '-' },
 { key: 'rate_amount', header: 'Tarif / Satuan', align: 'right', render: r => rupiah(r.rate_amount) },
 { key: 'min_qty', header: 'Qty Minimum', align: 'right' },
 { key: 'periode', header: 'Periode Berlaku', render: r => `${tgl(r.effective_date)} – ${r.end_date ? tgl(r.end_date) : 'seterusnya'}` },
 {
 key: 'price_source', header: 'Sumber Tarif', render: r => (
 <div className="space-y-0.5">
 <Badge tone={priceSourceTone(r.price_source)}>{r.price_source === 'asumsi_sistem' ? 'ASUMSI' : (PRICE_SOURCE_LABEL[r.price_source] ?? r.price_source)}</Badge>
 {r.price_verified_at && <div className="text-caption text-ink-400 whitespace-nowrap">Terverifikasi {tgl(r.price_verified_at)}</div>}
 </div>
 ),
 },
 { key: 'is_active', header: 'Aktif', render: r => r.is_active ? <Badge tone="emerald">Aktif</Badge> : <Badge tone="slate">Nonaktif</Badge> },
 ...(can('PAYROLL', 'approve') ? [{
 key: 'verif', header: '', width: '160px', sortable: false, render: (r: any) => (
 <div onClick={(e: any) => e.stopPropagation()}>
 {!r.price_verified_at
 ? <Button size="sm" variant="outline" onClick={() => markRcVerified(r)}>Tandai Terverifikasi</Button>
 : <span className="text-caption text-emerald-600">Terverifikasi</span>}
 </div>
 ),
 }] : []),
 ]}
 />
 </>
 )}

 <Modal open={!!schemeModal} onClose={() => setSchemeModal(null)} title="Ubah Skema Payroll"
 footer={<><Button variant="outline" onClick={() => setSchemeModal(null)}>Batal</Button><Button loading={schemeSaving} onClick={saveScheme}>Simpan</Button></>}>
 {schemeModal && <div className="space-y-4">
 <Desc cols={1} items={[{ label: 'Mitra', value: schemeModal.full_name }]} />
 <Field label="Skema Payroll"><Select options={PAYROLL_SCHEME_OPTIONS} value={schemeModal.payroll_scheme} onChange={(e: any) => setSchemeModal({ ...schemeModal, payroll_scheme: e.target.value })} /></Field>
 <p className="text-caption text-ink-400">Gaji tetap dihitung lewat menu Payroll & Slip Gaji; freelance/campuran dihitung lewat menu Payout Mitra Freelance.</p>
 </div>}
 </Modal>

 <Modal open={rcModal} onClose={() => setRcModal(false)} title={rcForm.id ? 'Ubah Rate Card' : 'Tambah Rate Card'}
 footer={<><Button variant="outline" onClick={() => setRcModal(false)}>Batal</Button><Button loading={rcSaving} onClick={saveRc}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Berlaku Untuk" className="sm:col-span-2"><Select options={APPLIES_TO_OPTIONS} value={rcForm.appliesTo} onChange={(e: any) => setRcForm({ ...rcForm, appliesTo: e.target.value })} /></Field>
 {rcForm.appliesTo === 'mitra' && <Field label="Mitra" required className="sm:col-span-2"><Select options={employees.map(e => ({ value: e.id, label: e.full_name }))} value={rcForm.employee_id} onChange={(e: any) => setRcForm({ ...rcForm, employee_id: e.target.value })} /></Field>}
 {rcForm.appliesTo === 'vendor' && <Field label="Vendor" required className="sm:col-span-2"><Select options={vendors.map(v => ({ value: v.id, label: v.name }))} value={rcForm.vendor_id} onChange={(e: any) => setRcForm({ ...rcForm, vendor_id: e.target.value })} /></Field>}
 <Field label="Jenis Pekerjaan" required className="sm:col-span-2"><Select options={jobTypes.map(j => ({ value: j.id, label: `${j.code} — ${j.name}` }))} value={rcForm.job_type_id} onChange={(e: any) => setRcForm({ ...rcForm, job_type_id: e.target.value })} /></Field>
 <Field label="Tarif per Satuan" required><Input type="number" value={rcForm.rate_amount} onChange={(e: any) => setRcForm({ ...rcForm, rate_amount: Number(e.target.value) })} /></Field>
 <Field label="Qty Minimum"><Input type="number" value={rcForm.min_qty} onChange={(e: any) => setRcForm({ ...rcForm, min_qty: Number(e.target.value) })} /></Field>
 <Field label="Tanggal Mulai Berlaku" required><Input type="date" value={rcForm.effective_date} onChange={(e: any) => setRcForm({ ...rcForm, effective_date: e.target.value })} /></Field>
 <Field label="Tanggal Berakhir"><Input type="date" value={rcForm.end_date} onChange={(e: any) => setRcForm({ ...rcForm, end_date: e.target.value })} /></Field>
 <Field label="Sumber Tarif" hint="Asumsi Sistem = angka karangan sistem, belum berdasar kontrak/negosiasi nyata.">
 <Select options={PRICE_SOURCE_OPTIONS} value={rcForm.price_source ?? 'asumsi_sistem'} onChange={(e: any) => setRcForm({ ...rcForm, price_source: e.target.value })} />
 </Field>
 <Field label="Rujukan (No Kontrak/SPK/Dokumen)"><Input value={rcForm.price_source_ref ?? ''} onChange={(e: any) => setRcForm({ ...rcForm, price_source_ref: e.target.value })} /></Field>
 <Field label="Catatan" className="sm:col-span-2"><Textarea value={rcForm.note} onChange={(e: any) => setRcForm({ ...rcForm, note: e.target.value })} /></Field>
 <Checkbox label="Aktif" checked={rcForm.is_active} onChange={(e: any) => setRcForm({ ...rcForm, is_active: e.target.checked })} />
 </div>
 </Modal>

 <Modal open={copyModal} onClose={() => setCopyModal(false)} title="Salin Rate Card"
 footer={<><Button variant="outline" onClick={() => setCopyModal(false)}>Batal</Button><Button loading={copying} onClick={doCopy}>Salin</Button></>}>
 <div className="space-y-4">
 <Field label="Mitra Sumber" required><Select options={employees.map(e => ({ value: e.id, label: e.full_name }))} value={copySrc} onChange={(e: any) => setCopySrc(e.target.value)} /></Field>
 <Field label="Mitra Tujuan" required><Select options={employees.filter(e => e.id !== copySrc).map(e => ({ value: e.id, label: e.full_name }))} value={copyDst} onChange={(e: any) => setCopyDst(e.target.value)} /></Field>
 <p className="text-caption text-ink-400">Seluruh tarif aktif milik mitra sumber akan disalin sebagai rate card baru untuk mitra tujuan, berlaku mulai hari ini.</p>
 </div>
 </Modal>

 <Modal open={importModal} onClose={() => setImportModal(false)} title="Impor Cepat Rate Card"
 footer={<><Button variant="outline" onClick={() => setImportModal(false)}>Batal</Button><Button loading={importing} onClick={doImport}>Impor</Button></>}>
 <div className="space-y-4">
 <Field label="Berlaku Untuk"><Select options={APPLIES_TO_OPTIONS} value={importTarget.appliesTo} onChange={(e: any) => setImportTarget({ ...importTarget, appliesTo: e.target.value })} /></Field>
 {importTarget.appliesTo === 'mitra' && <Field label="Mitra" required><Select options={employees.map(e => ({ value: e.id, label: e.full_name }))} value={importTarget.employee_id} onChange={(e: any) => setImportTarget({ ...importTarget, employee_id: e.target.value })} /></Field>}
 {importTarget.appliesTo === 'vendor' && <Field label="Vendor" required><Select options={vendors.map(v => ({ value: v.id, label: v.name }))} value={importTarget.vendor_id} onChange={(e: any) => setImportTarget({ ...importTarget, vendor_id: e.target.value })} /></Field>}
 <Field label="Daftar Tarif (satu baris per jenis pekerjaan)" hint="Format: kode_job_type|tarif — contoh: PSB-INDIHOME|75000">
 <Textarea rows={6} value={importText} onChange={(e: any) => setImportText(e.target.value)} placeholder={'PSB-INDIHOME|75000\nGGN-ONT|45000'} />
 </Field>
 </div>
 </Modal>
 </div>
 )
}
