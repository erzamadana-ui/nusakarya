import React, { useEffect, useMemo, useState } from 'react'
import { Eye, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo, uploadFile, signedUrl } from '@/lib/db'
import {
 PageHeader, Card, CardHeader, Badge, Button, Modal, Field, Input, Select, Textarea, ConfirmDialog,
 useToast, TableSkeleton, EmptyState, Section, Desc, cx,
} from '@/components/ui'
import { tglJam } from '@/lib/format'
import { KA_KATEGORI_DEFAULT } from '../lib/constants'

const emptyForm = () => ({ title: '', category: '', symptom: '', root_cause: '', resolution_steps: '', applicable_to: '' })

export default function Pengetahuan() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('OPERATIONS', 'write')
 const approver = can('OPERATIONS', 'approve')

 const [loading, setLoading] = useState(true)
 const [articles, setArticles] = useState<any[]>([])
 const [authors, setAuthors] = useState<any[]>([])
 const [q, setQ] = useState('')
 const [kategori, setKategori] = useState('')
 const [selected, setSelected] = useState<any>(null)
 const [attUrls, setAttUrls] = useState<Record<string, string>>({})

 const [modal, setModal] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>(emptyForm())
 const [formAttachments, setFormAttachments] = useState<any[]>([])
 const [saving, setSaving] = useState(false)
 const [uploading, setUploading] = useState(false)
 const [delId, setDelId] = useState<string | null>(null)

 useEffect(() => { if (profile?.company_id) loadAll() }, [profile?.company_id])

 async function loadAll() {
 setLoading(true)
 try {
 const [a, pr] = await Promise.all([
 list('knowledge_articles', { eq: { company_id: profile!.company_id }, order: { col: 'updated_at', asc: false }, limit: 2000 }),
 list('profiles', { select: 'id,full_name', eq: { company_id: profile!.company_id } }),
 ])
 setArticles(a); setAuthors(pr)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat basis pengetahuan', 'error') }
 finally { setLoading(false) }
 }

 const authorName = (id?: string) => authors.find(a => a.id === id)?.full_name ?? '-'
 const kategoriOptions = useMemo(() => {
 const extra = Array.from(new Set(articles.map(a => a.category).filter(Boolean))).filter(c => !KA_KATEGORI_DEFAULT.some(k => k.value === c))
 return [...KA_KATEGORI_DEFAULT, ...extra.map(c => ({ value: c, label: c }))]
 }, [articles])
 const kategoriLabel = (v?: string) => kategoriOptions.find(k => k.value === v)?.label ?? (v || '-')

 const filtered = useMemo(() => {
 let r = articles
 if (kategori) r = r.filter(a => a.category === kategori)
 if (q.trim()) {
 const s = q.toLowerCase()
 r = r.filter(a => [a.title, a.symptom, a.root_cause].some(v => String(v || '').toLowerCase().includes(s)))
 }
 return r
 }, [articles, kategori, q])

 const populer = useMemo(() => [...articles].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5), [articles])

 async function bukaArtikel(a: any) {
 setSelected(a)
 try {
 const updated = await update('knowledge_articles', a.id, { view_count: (a.view_count || 0) + 1 })
 setArticles(list => list.map(x => x.id === a.id ? updated : x))
 setSelected(updated)
 const atts: any[] = Array.isArray(updated.attachments) ? updated.attachments : []
 const urls: Record<string, string> = {}
 await Promise.all(atts.map(async (att: any) => { if (att.path) urls[att.path] = (await signedUrl(att.path)) ?? '' }))
 setAttUrls(urls)
 } catch { /* biarkan tampil walau gagal menambah view_count */ }
 }

 /* ---------------- CRUD ---------------- */
 function openNew() { setEditing(null); setForm(emptyForm()); setFormAttachments([]); setModal(true) }
 function openEdit(a: any) {
 setEditing(a)
 setForm({ title: a.title, category: a.category || '', symptom: a.symptom || '', root_cause: a.root_cause || '', resolution_steps: a.resolution_steps || '', applicable_to: a.applicable_to || '' })
 setFormAttachments(Array.isArray(a.attachments) ? a.attachments : [])
 setModal(true)
 }
 async function onUpload(file?: File | null) {
 if (!file) return
 setUploading(true)
 try {
 const path = await uploadFile(profile!.company_id, 'knowledge_articles', file)
 setFormAttachments(l => [...l, { file_name: file.name, path }])
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah lampiran', 'error') }
 finally { setUploading(false) }
 }
 async function submit() {
 if (!form.title.trim()) { toast.push('Judul artikel wajib diisi', 'error'); return }
 setSaving(true)
 try {
 const payload = { ...form, attachments: formAttachments }
 if (editing) await update('knowledge_articles', editing.id, payload)
 else {
 const articleNo = await nextDocNo(profile!.company_id, 'KA')
 await insert('knowledge_articles', { ...payload, article_no: articleNo, company_id: profile!.company_id, author_id: profile!.id, created_by: profile!.id })
 }
 toast.push(editing ? 'Artikel berhasil diperbarui' : 'Artikel berhasil ditambahkan', 'success')
 setModal(false); await loadAll()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan artikel', 'error') }
 finally { setSaving(false) }
 }
 async function doDelete() {
 if (!delId) return
 try {
 await remove('knowledge_articles', delId); toast.push('Artikel dihapus', 'success')
 if (selected?.id === delId) setSelected(null)
 await loadAll()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menghapus artikel', 'error') }
 finally { setDelId(null) }
 }
 async function togglePublish(a: any) {
 try {
 const updated = await update('knowledge_articles', a.id, { is_published: !a.is_published })
 toast.push(updated.is_published ? 'Artikel diterbitkan' : 'Artikel ditarik dari publikasi', 'success')
 setArticles(list => list.map(x => x.id === a.id ? updated : x))
 if (selected?.id === a.id) setSelected(updated)
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status publikasi', 'error') }
 }

 return (
 <div>
 <PageHeader title="Basis Pengetahuan" subtitle="Panduan troubleshooting jaringan & perangkat untuk tim operasional"
 actions={writable && <Button onClick={openNew}>Tambah Artikel</Button>} />

 <Card className="mb-5">
 <CardHeader title="Artikel Terpopuler" subtitle="Berdasarkan jumlah kali dibuka" />
 {loading ? <TableSkeleton rows={2} /> : populer.length === 0 ? (
 <div className="p-5"><EmptyState title="Belum ada artikel" message="Artikel yang ditambahkan akan muncul di sini." /></div>
 ) : (
 <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
 {populer.map(a => (
 <button key={a.id} onClick={() => bukaArtikel(a)} className="text-left p-3 rounded-md border border-ink-200 hover:shadow-e1 transition-shadow">
 <p className="text-body font-medium text-ink-800 line-clamp-2">{a.title}</p>
 <p className="mt-1.5 text-caption text-ink-400 flex items-center gap-1"><Eye size={12} /> {a.view_count || 0} kali dibuka</p>
 </button>))}
 </div>
 )}
 </Card>

 <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
 <Card className="overflow-hidden">
 <div className="p-3 border-b border-ink-200 space-y-2">
 <div className="relative">
 <Search size={15} className="absolute left-3 top-2.5 text-ink-400" />
 <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari judul, gejala, akar masalah…"
 className="w-full h-9 pl-9 pr-3 rounded-sm border border-ink-200 bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-400" />
 </div>
 <Select options={[{ value: '', label: 'Semua Kategori' }, ...kategoriOptions]} value={kategori} onChange={(e: any) => setKategori(e.target.value)} />
 </div>
 <div className="max-h-[calc(100vh-460px)] min-h-[300px] overflow-y-auto">
 {loading ? <TableSkeleton rows={6} /> : filtered.length === 0 ? (
 <EmptyState title="Tidak ada artikel" message="Ubah kata kunci pencarian atau kategori." />
 ) : filtered.map(a => (
 <button key={a.id} onClick={() => bukaArtikel(a)}
 className={cx('block w-full text-left px-4 py-3 border-b border-ink-100 hover:bg-primary-50/50',
 selected?.id === a.id && 'bg-primary-50')}>
 <div className="flex items-start justify-between gap-2">
 <p className="text-body font-medium text-ink-800 line-clamp-1">{a.title}</p>
 {!a.is_published && <Badge tone="slate">Draf</Badge>}
 </div>
 <p className="text-caption text-ink-400 mt-0.5 line-clamp-1">{a.symptom || 'Belum ada uraian gejala'}</p>
 <div className="flex items-center gap-2 mt-1 text-caption text-ink-400">
 {a.category && <span>{kategoriLabel(a.category)}</span>}
 <span className="flex items-center gap-0.5"><Eye size={11} /> {a.view_count || 0}</span>
 </div>
 </button>))}
 </div>
 </Card>

 <Card className="min-h-[400px]">
 {!selected ? (
 <div className="p-6"><EmptyState title="Pilih artikel" message="Pilih salah satu artikel di sebelah kiri untuk melihat detail troubleshooting." /></div>
 ) : (
 <div>
 <CardHeader title={selected.title} subtitle={`${selected.article_no} · ${kategoriLabel(selected.category)} · ${selected.view_count || 0} kali dibuka`}
 action={
 <div className="flex gap-2">
 {writable && <Button size="sm" variant="outline" onClick={() => openEdit(selected)}>Ubah</Button>}
 {approver && <Button size="sm" variant={selected.is_published ? 'secondary' : 'success'} onClick={() => togglePublish(selected)}>{selected.is_published ? 'Tarik' : 'Terbitkan'}</Button>}
 {approver && <Button size="sm" variant="danger" onClick={() => setDelId(selected.id)}>Hapus</Button>}
 </div>} />
 <div className="p-5 space-y-5">
 <Desc cols={2} items={[
 { label: 'Status', value: <Badge tone={selected.is_published ? 'emerald' : 'slate'}>{selected.is_published ? 'Terbit' : 'Draf'}</Badge> },
 { label: 'Berlaku Untuk', value: selected.applicable_to || '-' },
 { label: 'Penulis', value: authorName(selected.author_id) },
 { label: 'Terakhir Diperbarui', value: tglJam(selected.updated_at) },
 ]} />
 <Section title="Gejala">
 <p className="text-body text-ink-700 whitespace-pre-line">{selected.symptom || '-'}</p>
 </Section>
 <Section title="Akar Masalah">
 <p className="text-body text-ink-700 whitespace-pre-line">{selected.root_cause || '-'}</p>
 </Section>
 <Section title="Langkah Penyelesaian">
 <p className="text-body text-ink-700 whitespace-pre-line">{selected.resolution_steps || '-'}</p>
 </Section>
 <Section title="Lampiran">
 {(!selected.attachments || selected.attachments.length === 0) ? <p className="text-caption text-ink-400">Tidak ada lampiran.</p> : (
 <div className="flex flex-wrap gap-2">
 {selected.attachments.map((att: any, i: number) => (
 <a key={i} href={attUrls[att.path] || '#'} target="_blank" rel="noreferrer"
 className="text-caption px-3 py-1.5 rounded-sm border border-ink-200 text-primary-600 hover:bg-ink-50">
 {att.file_name || `Lampiran ${i + 1}`}
 </a>))}
 </div>
 )}
 </Section>
 </div>
 </div>
 )}
 </Card>
 </div>

 {/* Modal tambah/ubah artikel */}
 <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Ubah Artikel' : 'Tambah Artikel'} size="lg"
 footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={submit}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Judul" required className="sm:col-span-2"><Input value={form.title} onChange={(e: any) => setForm({ ...form, title: e.target.value })} /></Field>
 <Field label="Kategori"><Select options={KA_KATEGORI_DEFAULT} value={form.category} onChange={(e: any) => setForm({ ...form, category: e.target.value })} /></Field>
 <Field label="Berlaku Untuk" hint="mis. Perangkat ONT ZTE, Segmen FTTH"><Input value={form.applicable_to} onChange={(e: any) => setForm({ ...form, applicable_to: e.target.value })} /></Field>
 <Field label="Gejala" className="sm:col-span-2"><Textarea value={form.symptom} onChange={(e: any) => setForm({ ...form, symptom: e.target.value })} /></Field>
 <Field label="Akar Masalah" className="sm:col-span-2"><Textarea value={form.root_cause} onChange={(e: any) => setForm({ ...form, root_cause: e.target.value })} /></Field>
 <Field label="Langkah Penyelesaian" className="sm:col-span-2"><Textarea value={form.resolution_steps} onChange={(e: any) => setForm({ ...form, resolution_steps: e.target.value })} /></Field>
 <div className="sm:col-span-2">
 <Field label="Lampiran">
 <label className="inline-block">
 <span className="inline-flex items-center h-9 px-3 rounded-sm border border-ink-200 text-body cursor-pointer hover:bg-ink-50">
 {uploading ? 'Mengunggah…' : 'Unggah Berkas'}
 </span>
 <input type="file" className="hidden" disabled={uploading} onChange={e => onUpload(e.target.files?.[0])} />
 </label>
 {formAttachments.length > 0 && (
 <ul className="mt-2 space-y-1">
 {formAttachments.map((att, i) => (
 <li key={i} className="flex items-center justify-between text-caption text-ink-600">
 <span>{att.file_name}</span>
 <button type="button" className="text-red-600 hover:underline" onClick={() => setFormAttachments(l => l.filter((_, x) => x !== i))}>Hapus</button>
 </li>))}
 </ul>)}
 </Field>
 </div>
 </div>
 </Modal>

 <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} title="Hapus Artikel" danger
 message="Artikel ini akan dihapus permanen dari basis pengetahuan. Lanjutkan?" onConfirm={doDelete} />
 </div>
 )
}
