import React, { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { list, insert, update, remove } from '@/lib/db'
import { useAuth } from '@/lib/auth'
import {
 PageHeader, DataTable, Badge, Modal, Drawer, Field, Input, Checkbox, Button, ConfirmDialog, useToast, Plus, type Column,
} from '@/components/ui'

type Branch = { id: string; code: string; name: string; city: string | null; province: string | null; lat: number | null; lng: number | null; is_active: boolean }
const empty = { code: '', name: '', city: '', province: '', lat: '', lng: '', is_active: true }

export default function Cabang() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<Branch[]>([])
 const [loading, setLoading] = useState(true)
 const [form, setForm] = useState<any>(null)
 const [saving, setSaving] = useState(false)
 const [locating, setLocating] = useState(false)
 const [del, setDel] = useState<Branch | null>(null)

 const load = async () => {
 setLoading(true)
 try { setRows(await list<Branch>('branches', { order: { col: 'name', asc: true } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat cabang', 'error') } finally { setLoading(false) }
 }
 useEffect(() => { if (profile) load() }, [profile])

 const ambilKoordinat = () => {
 if (!navigator.geolocation) { toast.push('Perangkat tidak mendukung geolokasi', 'error'); return }
 setLocating(true)
 navigator.geolocation.getCurrentPosition(
 (pos) => { setForm((f: any) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude })); setLocating(false); toast.push('Koordinat berhasil diambil') },
 (err) => { setLocating(false); toast.push(err.message || 'Gagal mengambil koordinat', 'error') },
 { enableHighAccuracy: true, timeout: 10000 }
 )
 }

 const save = async () => {
 if (!profile || !form) return
 if (!form.code || !form.name) { toast.push('Kode dan nama cabang wajib diisi', 'error'); return }
 setSaving(true)
 try {
 const payload = {
 code: form.code, name: form.name, city: form.city || null, province: form.province || null,
 lat: form.lat === '' || form.lat == null ? null : Number(form.lat),
 lng: form.lng === '' || form.lng == null ? null : Number(form.lng),
 is_active: form.is_active,
 }
 if (form.id) await update('branches', form.id, payload)
 else await insert('branches', { company_id: profile.company_id, ...payload })
 toast.push('Cabang disimpan'); setForm(null); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan cabang', 'error') } finally { setSaving(false) }
 }

 const doDelete = async () => {
 if (!del) return
 try { await remove('branches', del.id); toast.push('Cabang dihapus'); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus. Cabang mungkin masih dipakai data lain.', 'error') }
 }

 const columns: Column[] = [
 { key: 'code', header: 'Kode', width: '100px' },
 { key: 'name', header: 'Nama Cabang' },
 { key: 'city', header: 'Kota', render: r => r.city ?? '-' },
 { key: 'province', header: 'Provinsi', render: r => r.province ?? '-' },
 { key: 'koordinat', header: 'Koordinat', render: r => r.lat != null && r.lng != null ? `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}` : '-' },
 { key: 'is_active', header: 'Status', align: 'center', render: r => <Badge>{r.is_active ? 'Aktif' : 'Nonaktif'}</Badge> },
 ]

 return (
 <div>
 <PageHeader title="Cabang" subtitle="Daftar cabang/wilayah operasional perusahaan"
 actions={can('CORE', 'write') && <Button icon={<Plus size={16} />} onClick={() => setForm({ ...empty })}>Tambah Cabang</Button>} />

 <DataTable
 columns={columns} rows={rows} loading={loading}
 onRowClick={can('CORE', 'write') ? (r) => setForm({ ...r }) : undefined}
 searchKeys={['code', 'name', 'city', 'province']} exportName="cabang" emptyTitle="Belum ada cabang"
 />

 <Drawer open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Ubah Cabang' : 'Tambah Cabang'}
 footer={<>
 <Button variant="outline" onClick={() => setForm(null)}>Batal</Button>
 {form?.id && can('CORE', 'approve') && <Button variant="danger" onClick={() => { setDel(form); setForm(null) }}>Hapus</Button>}
 <Button loading={saving} onClick={save}>Simpan</Button>
 </>}>
 {form && (
 <div className="space-y-4">
 <Field label="Kode Cabang" required><Input value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="mis. JKT" /></Field>
 <Field label="Nama Cabang" required><Input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="mis. Cabang Jakarta" /></Field>
 <Field label="Kota"><Input value={form.city ?? ''} onChange={(e: any) => setForm({ ...form, city: e.target.value })} /></Field>
 <Field label="Provinsi"><Input value={form.province ?? ''} onChange={(e: any) => setForm({ ...form, province: e.target.value })} /></Field>
 <Field label="Koordinat (Lat, Lng)" hint="Klik Ambil Lokasi untuk mengisi otomatis dari posisi perangkat">
 <div className="flex items-center gap-2">
 <Input type="number" step="any" placeholder="Lintang" value={form.lat ?? ''} onChange={(e: any) => setForm({ ...form, lat: e.target.value })} />
 <Input type="number" step="any" placeholder="Bujur" value={form.lng ?? ''} onChange={(e: any) => setForm({ ...form, lng: e.target.value })} />
 <Button type="button" variant="outline" size="sm" icon={<MapPin size={14} />} loading={locating} onClick={ambilKoordinat}>Ambil Lokasi</Button>
 </div>
 </Field>
 <Checkbox label="Cabang aktif" checked={form.is_active} onChange={(e: any) => setForm({ ...form, is_active: e.target.checked })} />
 </div>
 )}
 </Drawer>

 <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={doDelete} danger
 title="Hapus Cabang" message={`Yakin ingin menghapus cabang "${del?.name}"? Tindakan ini tidak dapat dibatalkan.`} />
 </div>
 )
}
