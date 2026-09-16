import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth, ROLE_LABEL } from '@/lib/auth'
import { list, update } from '@/lib/db'
import {
 PageHeader, Tabs, KpiCard, FilterBar, DataTable, Badge, Button, Modal, Field, Input, Textarea, Select,
 EmptyState, useToast, cx, type Column,
} from '@/components/ui'
import { tglJam } from '@/lib/format'
import { ENTITY_MAP, ENTITY_ROUTES } from '../lib/entityMap'

const AUDIENCE_OPTIONS = [
 { value: 'perusahaan', label: 'Seluruh Pengguna Perusahaan' },
 { value: 'jabatan', label: 'Satu Jabatan' },
 { value: 'cabang', label: 'Satu Cabang' },
 { value: 'orang', label: 'Orang Tertentu' },
]

type Profil = { id: string; full_name: string; email: string | null; role: string; branch_id: string | null; is_active: boolean }
type Cabang = { id: string; code: string; name: string }

export default function Notifikasi() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const navigate = useNavigate()
 const writable = can('CORE', 'write')

 const [tab, setTab] = useState<'masuk' | 'terkirim'>('masuk')

 // ---- Tab Masuk (inbox) ----
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [onlyUnread, setOnlyUnread] = useState(false)
 const [busyId, setBusyId] = useState<string | null>(null)
 const [busyAll, setBusyAll] = useState(false)

 // ---- Data pendukung pengumuman (pengguna & cabang perusahaan) ----
 const [profiles, setProfiles] = useState<Profil[]>([])
 const [branches, setBranches] = useState<Cabang[]>([])

 // ---- Tab Terkirim (riwayat pengumuman) ----
 const [sentRows, setSentRows] = useState<any[]>([])
 const [sentLoading, setSentLoading] = useState(true)

 // ---- Modal Kirim Pengumuman ----
 const [sendOpen, setSendOpen] = useState(false)
 const [sendBusy, setSendBusy] = useState(false)
 const [audienceType, setAudienceType] = useState('perusahaan')
 const [audienceRole, setAudienceRole] = useState('')
 const [audienceBranch, setAudienceBranch] = useState('')
 const [audienceUser, setAudienceUser] = useState('')
 const [announceTitle, setAnnounceTitle] = useState('')
 const [announceBody, setAnnounceBody] = useState('')

 useEffect(() => { load() }, [profile?.id])
 useEffect(() => { if (profile && writable) { loadPendukung(); loadSent() } }, [profile?.id, writable])

 async function load() {
 if (!profile) return
 setLoading(true)
 try {
 const data = await list<any>('notifications', { eq: { user_id: profile.id }, order: { col: 'created_at', asc: false }, limit: 300 })
 setRows(data)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat notifikasi', 'error') }
 finally { setLoading(false) }
 }

 async function loadPendukung() {
 try {
 const [p, b] = await Promise.all([
 list<Profil>('profiles', { select: 'id,full_name,email,role,branch_id,is_active', order: { col: 'full_name', asc: true } }),
 list<Cabang>('branches', { select: 'id,code,name', order: { col: 'name', asc: true } }),
 ])
 setProfiles(p); setBranches(b)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data pengguna/cabang', 'error') }
 }

 async function loadSent() {
 setSentLoading(true)
 try {
 const data = await list<any>('notifications', { eq: { entity_type: 'pengumuman' }, order: { col: 'created_at', asc: false }, limit: 5000 })
 setSentRows(data)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat riwayat pengumuman', 'error') }
 finally { setSentLoading(false) }
 }

 const filtered = useMemo(() => onlyUnread ? rows.filter(r => !r.is_read) : rows, [rows, onlyUnread])
 const unreadCount = useMemo(() => rows.filter(r => !r.is_read).length, [rows])

 async function markRead(row: any) {
 if (row.is_read) return
 setBusyId(row.id)
 try {
 await update('notifications', row.id, { is_read: true })
 setRows(rs => rs.map(r => r.id === row.id ? { ...r, is_read: true } : r))
 } catch (e: any) { toast.push(e.message ?? 'Gagal menandai dibaca', 'error') }
 finally { setBusyId(null) }
 }

 async function markAllRead() {
 setBusyAll(true)
 try {
 const unread = rows.filter(r => !r.is_read)
 for (const r of unread) await update('notifications', r.id, { is_read: true })
 setRows(rs => rs.map(r => ({ ...r, is_read: true })))
 toast.push('Semua notifikasi ditandai sudah dibaca')
 } catch (e: any) { toast.push(e.message ?? 'Gagal menandai semua dibaca', 'error') }
 finally { setBusyAll(false) }
 }

 function openRow(row: any) {
 markRead(row)
 const route = row.entity_type ? ENTITY_ROUTES[row.entity_type] : null
 if (route) navigate(route)
 }

 // ---- Kirim Pengumuman ----
 const roleOptions = useMemo(
 () => Array.from(new Set(profiles.map(p => p.role))).sort().map(r => ({ value: r, label: ROLE_LABEL[r] ?? r })),
 [profiles]
 )
 const branchOptions = useMemo(() => branches.map(b => ({ value: b.id, label: `${b.code} — ${b.name}` })), [branches])
 const userOptions = useMemo(() => profiles.filter(p => p.is_active).map(p => ({ value: p.id, label: `${p.full_name}${p.email ? ' (' + p.email + ')' : ''}` })), [profiles])
 const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles])

 const recipients = useMemo(() => {
 const aktif = profiles.filter(p => p.is_active)
 switch (audienceType) {
 case 'perusahaan': return aktif
 case 'jabatan': return audienceRole ? aktif.filter(p => p.role === audienceRole) : []
 case 'cabang': return audienceBranch ? aktif.filter(p => p.branch_id === audienceBranch) : []
 case 'orang': return audienceUser ? aktif.filter(p => p.id === audienceUser) : []
 default: return []
 }
 }, [profiles, audienceType, audienceRole, audienceBranch, audienceUser])

 function openSend() {
 setAudienceType('perusahaan'); setAudienceRole(''); setAudienceBranch(''); setAudienceUser('')
 setAnnounceTitle(''); setAnnounceBody('')
 setSendOpen(true)
 }

 async function kirimPengumuman() {
 if (!profile) return
 if (!announceTitle.trim()) { toast.push('Judul pengumuman wajib diisi', 'error'); return }
 if (!announceBody.trim()) { toast.push('Isi pesan wajib diisi', 'error'); return }
 if (recipients.length === 0) { toast.push('Tidak ada penerima yang cocok dengan sasaran yang dipilih', 'error'); return }
 setSendBusy(true)
 try {
 const broadcastId = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
 const payload = recipients.map(p => ({
 company_id: profile.company_id,
 user_id: p.id,
 title: announceTitle.trim(),
 body: announceBody.trim(),
 entity_type: 'pengumuman',
 entity_id: broadcastId,
 is_read: false,
 created_by: profile.id,
 }))
 const { error } = await supabase.from('notifications').insert(payload)
 if (error) throw error
 toast.push(`Pengumuman terkirim ke ${recipients.length} pengguna`)
 setSendOpen(false)
 await loadSent()
 if (recipients.some(p => p.id === profile.id)) await load()
 } catch (e: any) {
 toast.push(
 e.code === '42501' || /permission|policy/i.test(e.message ?? '')
 ? 'Anda tidak punya hak menulis pada modul CORE untuk mengirim pengumuman.'
 : (e.message ?? 'Gagal mengirim pengumuman'), 'error')
 } finally { setSendBusy(false) }
 }

 // ---- Kelompokkan riwayat pengumuman per broadcast (entity_id) ----
 const broadcasts = useMemo(() => {
 const m = new Map<string, { id: string; title: string; body: string; created_at: string; created_by: string; total: number; read: number }>()
 sentRows.forEach(r => {
 const key = r.entity_id ?? r.id
 const cur = m.get(key) ?? { id: key, title: r.title, body: r.body, created_at: r.created_at, created_by: r.created_by, total: 0, read: 0 }
 cur.total += 1
 if (r.is_read) cur.read += 1
 if (r.created_at < cur.created_at) cur.created_at = r.created_at
 m.set(key, cur)
 })
 return Array.from(m.values()).sort((a, b) => b.created_at.localeCompare(a.created_at))
 }, [sentRows])

 const inboxColumns: Column[] = [
 { key: 'is_read', header: '', width: '28px', sortable: false, render: r => !r.is_read && <span className="block w-2 h-2 rounded-full bg-primary-500" /> },
 { key: 'title', header: 'Judul', render: r => <span className={cx(!r.is_read && 'font-semibold text-ink-900')}>{r.title}</span> },
 { key: 'body', header: 'Isi', render: r => <span className="line-clamp-2 max-w-md block text-ink-500">{r.body ?? '-'}</span> },
 { key: 'entity_type', header: 'Entitas', render: r => r.entity_type === 'pengumuman' ? 'Pengumuman' : (r.entity_type ? (ENTITY_MAP[r.entity_type]?.label ?? r.entity_type) : '-') },
 { key: 'created_at', header: 'Waktu', render: r => tglJam(r.created_at) },
 { key: 'status', header: 'Status', render: r => <Badge tone={r.is_read ? 'slate' : 'blue'}>{r.is_read ? 'Sudah dibaca' : 'Belum dibaca'}</Badge> },
 { key: 'aksi', header: 'Aksi', align: 'center', sortable: false, render: (r: any) => !r.is_read && (
 <Button size="sm" variant="outline" loading={busyId === r.id} onClick={(e: any) => { e.stopPropagation(); markRead(r) }}>Tandai Dibaca</Button>
 ) },
 ]

 const sentColumns: Column[] = [
 { key: 'title', header: 'Judul' },
 { key: 'body', header: 'Isi', render: r => <span className="line-clamp-2 max-w-md block text-ink-500">{r.body ?? '-'}</span> },
 { key: 'created_by', header: 'Dikirim Oleh', render: r => profileMap[r.created_by]?.full_name ?? '-' },
 { key: 'created_at', header: 'Waktu', render: r => tglJam(r.created_at) },
 { key: 'total', header: 'Penerima', align: 'right', render: r => r.total },
 { key: 'read', header: 'Sudah Dibaca', align: 'right', render: r => `${r.read} / ${r.total}` },
 ]

 return (
 <div>
 <PageHeader title="Notifikasi" subtitle="Pemberitahuan terkait aktivitas dan pengajuan Anda"
 actions={<>
 {tab === 'masuk' && unreadCount > 0 && <Button size="sm" variant="outline" loading={busyAll} onClick={markAllRead}>Tandai Semua Dibaca</Button>}
 {writable && <Button size="sm" icon={<Megaphone size={15} />} onClick={openSend}>Kirim Pengumuman</Button>}
 </>} />

 {writable && (
 <Tabs className="mb-4" value={tab} onChange={setTab}
 tabs={[{ value: 'masuk', label: 'Masuk', count: rows.length }, { value: 'terkirim', label: 'Terkirim', count: broadcasts.length }]} />
 )}

 {tab === 'masuk' ? (
 <>
 <div className="grid sm:grid-cols-2 gap-4 mb-4">
 <KpiCard label="Belum Dibaca" value={unreadCount} sub="dari total notifikasi" tone={unreadCount > 0 ? 'amber' : 'teal'} />
 <KpiCard label="Total Notifikasi" value={rows.length} />
 </div>

 <FilterBar>
 <button onClick={() => setOnlyUnread(v => !v)}
 className={cx('h-8 px-3 rounded-full text-caption font-medium', onlyUnread ? 'bg-primary-500 text-white' : 'bg-ink-100 text-ink-600')}>
 Belum Dibaca Saja
 </button>
 </FilterBar>

 {!loading && filtered.length === 0 ? (
 <EmptyState title={onlyUnread ? 'Tidak ada notifikasi belum dibaca' : 'Belum ada notifikasi'} />
 ) : (
 <DataTable loading={loading} rows={filtered} searchKeys={['title', 'body']} searchable={false} onRowClick={openRow} columns={inboxColumns} />
 )}
 </>
 ) : (
 <>
 <div className="grid sm:grid-cols-2 gap-4 mb-4">
 <KpiCard label="Total Pengumuman Terkirim" value={broadcasts.length} />
 <KpiCard label="Total Notifikasi Dikirim" value={sentRows.length} sub="ke seluruh penerima" />
 </div>
 <DataTable loading={sentLoading} rows={broadcasts} rowKey="id" searchKeys={['title', 'body']}
 exportName="riwayat-pengumuman" columns={sentColumns}
 emptyTitle="Belum ada pengumuman terkirim" emptyMessage="Pengumuman yang Anda kirim akan tercatat di sini beserta jumlah pembaca." />
 </>
 )}

 <Modal open={sendOpen} onClose={() => !sendBusy && setSendOpen(false)} title="Kirim Pengumuman" size="lg"
 subtitle="Kirim pemberitahuan ke pengguna perusahaan Anda"
 footer={<>
 <Button variant="outline" disabled={sendBusy} onClick={() => setSendOpen(false)}>Batal</Button>
 <Button loading={sendBusy} onClick={kirimPengumuman}>Kirim ke {recipients.length} Pengguna</Button>
 </>}>
 <div className="space-y-4">
 <Field label="Kirim Ke" required>
 <Select value={audienceType} onChange={(e: any) => setAudienceType(e.target.value)} options={AUDIENCE_OPTIONS} placeholder="" />
 </Field>
 {audienceType === 'jabatan' && (
 <Field label="Jabatan" required>
 <Select value={audienceRole} onChange={(e: any) => setAudienceRole(e.target.value)} options={roleOptions} />
 </Field>
 )}
 {audienceType === 'cabang' && (
 <Field label="Cabang" required>
 <Select value={audienceBranch} onChange={(e: any) => setAudienceBranch(e.target.value)} options={branchOptions} />
 </Field>
 )}
 {audienceType === 'orang' && (
 <Field label="Pengguna" required>
 <Select value={audienceUser} onChange={(e: any) => setAudienceUser(e.target.value)} options={userOptions} />
 </Field>
 )}
 <Field label="Judul" required>
 <Input value={announceTitle} onChange={(e: any) => setAnnounceTitle(e.target.value)} placeholder="mis. Pemeliharaan Sistem Akhir Pekan" />
 </Field>
 <Field label="Pesan" required>
 <Textarea rows={5} value={announceBody} onChange={(e: any) => setAnnounceBody(e.target.value)} placeholder="Isi pengumuman…" />
 </Field>
 <div className="rounded-sm border border-primary-200 bg-primary-50 dark:bg-primary-950/30 dark:border-primary-900 px-3 py-2.5 text-caption text-primary-700">
 Akan dikirim ke <b>{recipients.length}</b> pengguna aktif{recipients.length === 0 && audienceType !== 'perusahaan' ? ' — pilih sasaran terlebih dahulu' : ''}.
 </div>
 </div>
 </Modal>
 </div>
 )
}
