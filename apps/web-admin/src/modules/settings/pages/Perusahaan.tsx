import React, { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import supabase from '@/lib/supabase'
import { getOne, update, uploadFile, signedUrl } from '@/lib/db'
import { useAuth } from '@/lib/auth'
import {
 PageHeader, Card, CardHeader, Section, Field, Input, Button, Badge, DataTable, Modal,
 useToast, Skeleton, Plus, type Column,
} from '@/components/ui'
import { tgl } from '@/lib/format'

type Company = {
 id: string; name: string; code?: string; npwp: string | null; address: string | null; phone: string | null
 email: string | null; logo_url: string | null; is_demo: boolean | null; is_active?: boolean; plan?: string; created_at?: string
}

const emptyAddForm = { name: '', code: '', npwp: '', address: '', phone: '', email: '' }

export default function Perusahaan() {
 const { profile, can, refresh } = useAuth()
 const toast = useToast()
 const [data, setData] = useState<Company | null>(null)
 const [loading, setLoading] = useState(true)
 const [saving, setSaving] = useState(false)
 const [logoPreview, setLogoPreview] = useState<string | null>(null)
 const [logoFile, setLogoFile] = useState<File | null>(null)

 const isSuperAdmin = profile?.role === 'super_admin'

 // ---- Daftar seluruh perusahaan (khusus super_admin) ----
 const [companies, setCompanies] = useState<Company[]>([])
 const [companiesLoading, setCompaniesLoading] = useState(true)
 const [addOpen, setAddOpen] = useState(false)
 const [addForm, setAddForm] = useState<any>(emptyAddForm)
 const [addSaving, setAddSaving] = useState(false)

 const load = async () => {
 if (!profile) return
 setLoading(true)
 try {
 const c = await getOne<Company>('companies', profile.company_id)
 setData(c)
 setLogoPreview(await signedUrl(c?.logo_url))
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data perusahaan', 'error') } finally { setLoading(false) }
 }
 useEffect(() => { load() }, [profile])

 const loadCompanies = async () => {
 if (!profile || !isSuperAdmin) { setCompaniesLoading(false); return }
 setCompaniesLoading(true)
 try {
 const { data: rows, error } = await supabase.rpc('fn_daftar_perusahaan')
 if (error) throw error
 setCompanies((rows ?? []) as Company[])
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat daftar perusahaan', 'error') }
 finally { setCompaniesLoading(false) }
 }
 useEffect(() => { loadCompanies() }, [profile])

 const save = async () => {
 if (!data || !profile) return
 setSaving(true)
 try {
 let logo_url = data.logo_url
 if (logoFile) logo_url = await uploadFile(profile.company_id, 'company', logoFile)
 await update('companies', data.id, { name: data.name, npwp: data.npwp || null, address: data.address || null, phone: data.phone || null, email: data.email || null, logo_url })
 toast.push('Profil perusahaan disimpan')
 setLogoFile(null); await load(); await refresh(); await loadCompanies()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') } finally { setSaving(false) }
 }

 const clearDemo = async () => {
 if (!data) return
 try { await update('companies', data.id, { is_demo: false }); toast.push('Ditandai sebagai data produksi'); await load(); await refresh(); await loadCompanies() }
 catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui', 'error') }
 }

 const openAdd = () => { setAddForm({ ...emptyAddForm }); setAddOpen(true) }

 const saveAdd = async () => {
 if (!addForm.name.trim()) { toast.push('Nama perusahaan wajib diisi', 'error'); return }
 if (!addForm.code.trim()) { toast.push('Kode perusahaan wajib diisi', 'error'); return }
 setAddSaving(true)
 try {
 const { error } = await supabase.rpc('fn_tambah_perusahaan', {
 p_name: addForm.name.trim(),
 p_code: addForm.code.trim(),
 p_npwp: addForm.npwp.trim() || null,
 p_address: addForm.address.trim() || null,
 p_phone: addForm.phone.trim() || null,
 p_email: addForm.email.trim() || null,
 })
 if (error) throw error
 toast.push('Perusahaan baru berhasil dibuat — cabang pusat & hak akses standar sudah disiapkan')
 setAddOpen(false); setAddForm({ ...emptyAddForm }); await loadCompanies()
 } catch (e: any) {
 toast.push(e.message?.includes('permission') || e.code === '42501'
 ? 'Anda tidak punya hak Super Admin untuk menambah perusahaan (modul CORE).'
 : (e.message ?? 'Gagal membuat perusahaan baru'), 'error')
 } finally { setAddSaving(false) }
 }

 const companyColumns: Column[] = [
 { key: 'code', header: 'Kode', width: '110px', render: r => <span className="font-mono text-caption">{r.code}</span> },
 { key: 'name', header: 'Nama Perusahaan', render: r => (
 <span className="flex items-center gap-2">{r.name}{r.is_demo && <Badge tone="amber">Data Contoh</Badge>}{r.id === profile?.company_id && <Badge tone="teal">Perusahaan Anda</Badge>}</span>
 ) },
 { key: 'npwp', header: 'NPWP', render: r => r.npwp ?? '-' },
 { key: 'email', header: 'Email', render: r => r.email ?? '-' },
 { key: 'is_active', header: 'Status', align: 'center', render: r => <Badge tone={r.is_active ? 'emerald' : 'zinc'}>{r.is_active ? 'Aktif' : 'Nonaktif'}</Badge> },
 { key: 'created_at', header: 'Dibuat', render: r => tgl(r.created_at) },
 ]

 const writable = can('CORE', 'write')

 if (loading) return (<div><PageHeader title="Profil Perusahaan" /><Skeleton className="h-80 w-full rounded-md" /></div>)
 if (!data) return null

 return (
 <div>
 <PageHeader title="Profil Perusahaan" subtitle="Data identitas perusahaan yang tampil pada dokumen & laporan"
 actions={data.is_demo && <Badge tone="amber">Data Contoh</Badge>} />

 {data.is_demo && (
 <Card className="mb-4 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
 <div className="p-4 flex flex-wrap items-center justify-between gap-3">
 <p className="text-body text-ink-700">Perusahaan ini masih ditandai sebagai <b>data contoh</b> untuk peragaan. Bersihkan penanda ini sebelum digunakan untuk operasional sesungguhnya.</p>
 {writable && <Button size="sm" variant="outline" onClick={clearDemo}>Tandai Bukan Data Contoh</Button>}
 </div>
 </Card>
 )}

 <Card>
 <CardHeader title="Identitas Perusahaan" />
 <div className="p-5 grid sm:grid-cols-2 gap-4">
 <div className="sm:col-span-2 flex items-center gap-4">
 <div className="w-16 h-16 rounded-md bg-ink-100 grid place-items-center overflow-hidden shrink-0">
 {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Building2 size={24} className="text-ink-400" />}
 </div>
 {writable && (
 <Field label="Ganti Logo" className="flex-1">
 <input type="file" accept="image/*" disabled={!writable}
 onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)) } }}
 className="text-caption text-ink-500 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 </Field>
 )}
 </div>
 <Field label="Nama Perusahaan" required><Input disabled={!writable} value={data.name} onChange={(e: any) => setData({ ...data, name: e.target.value })} /></Field>
 <Field label="NPWP"><Input disabled={!writable} value={data.npwp ?? ''} onChange={(e: any) => setData({ ...data, npwp: e.target.value })} /></Field>
 <Field label="Telepon"><Input disabled={!writable} value={data.phone ?? ''} onChange={(e: any) => setData({ ...data, phone: e.target.value })} /></Field>
 <Field label="Email"><Input disabled={!writable} type="email" value={data.email ?? ''} onChange={(e: any) => setData({ ...data, email: e.target.value })} /></Field>
 <Field label="Alamat" className="sm:col-span-2"><Input disabled={!writable} value={data.address ?? ''} onChange={(e: any) => setData({ ...data, address: e.target.value })} /></Field>
 </div>
 {writable && (
 <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-ink-200">
 <Button loading={saving} onClick={save}>Simpan Perubahan</Button>
 </div>
 )}
 </Card>

 {isSuperAdmin && (
 <Section title="Seluruh Perusahaan (Super Admin)" className="mt-6">
 <p className="text-caption text-ink-500 mb-3">
 Aplikasi ini multi-perusahaan. Sebagai Super Admin, Anda dapat melihat seluruh perusahaan (tenant) yang terdaftar dan mendaftarkan perusahaan baru. Perusahaan baru otomatis disiapkan dengan satu cabang pusat dan matriks hak akses standar disalin dari perusahaan yang sudah ada — tanpa data contoh apa pun.
 </p>
 <DataTable
 columns={companyColumns} rows={companies} loading={companiesLoading}
 searchKeys={['code', 'name', 'npwp', 'email']} exportName="perusahaan"
 emptyTitle="Belum ada perusahaan lain" emptyMessage="Baru ada satu perusahaan terdaftar di sistem."
 toolbar={writable && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah Perusahaan</Button>}
 />
 </Section>
 )}

 <Modal open={addOpen} onClose={() => !addSaving && setAddOpen(false)} title="Tambah Perusahaan Baru"
 subtitle="Membuat tenant baru — cabang pusat & hak akses standar disiapkan otomatis"
 footer={<>
 <Button variant="outline" disabled={addSaving} onClick={() => setAddOpen(false)}>Batal</Button>
 <Button loading={addSaving} onClick={saveAdd}>Buat Perusahaan</Button>
 </>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Nama Perusahaan" required className="sm:col-span-2">
 <Input value={addForm.name} onChange={(e: any) => setAddForm({ ...addForm, name: e.target.value })} placeholder="mis. PT Contoh Mitra Sejahtera" />
 </Field>
 <Field label="Kode Perusahaan" required hint="Unik, huruf besar, mis. PCMS">
 <Input value={addForm.code} onChange={(e: any) => setAddForm({ ...addForm, code: e.target.value.toUpperCase() })} placeholder="mis. PCMS" />
 </Field>
 <Field label="NPWP">
 <Input value={addForm.npwp} onChange={(e: any) => setAddForm({ ...addForm, npwp: e.target.value })} />
 </Field>
 <Field label="Telepon">
 <Input value={addForm.phone} onChange={(e: any) => setAddForm({ ...addForm, phone: e.target.value })} />
 </Field>
 <Field label="Email">
 <Input type="email" value={addForm.email} onChange={(e: any) => setAddForm({ ...addForm, email: e.target.value })} />
 </Field>
 <Field label="Alamat" className="sm:col-span-2">
 <Input value={addForm.address} onChange={(e: any) => setAddForm({ ...addForm, address: e.target.value })} />
 </Field>
 </div>
 </Modal>
 </div>
 )
}
