import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, update } from '@/lib/db'
import { PageHeader, KpiCard, FilterBar, DataTable, Badge, Button, EmptyState, useToast, cx } from '@/components/ui'
import { tglJam } from '@/lib/format'
import { ENTITY_MAP, ENTITY_ROUTES } from '../lib/entityMap'

export default function Notifikasi() {
 const { profile } = useAuth()
 const toast = useToast()
 const navigate = useNavigate()
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [onlyUnread, setOnlyUnread] = useState(false)
 const [busyId, setBusyId] = useState<string | null>(null)
 const [busyAll, setBusyAll] = useState(false)

 useEffect(() => { load() }, [profile?.id])

 async function load() {
 if (!profile) return
 setLoading(true)
 try {
 const data = await list<any>('notifications', { eq: { user_id: profile.id }, order: { col: 'created_at', asc: false }, limit: 300 })
 setRows(data)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat notifikasi', 'error') }
 finally { setLoading(false) }
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

 return (
 <div>
 <PageHeader title="Notifikasi" subtitle="Pemberitahuan terkait aktivitas dan pengajuan Anda"
 actions={unreadCount > 0 && <Button size="sm" variant="outline" loading={busyAll} onClick={markAllRead}>Tandai Semua Dibaca</Button>} />

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
 <DataTable
 loading={loading} rows={filtered} searchKeys={['title', 'body']} searchable={false}
 onRowClick={openRow}
 columns={[
 { key: 'is_read', header: '', width: '28px', sortable: false, render: r => !r.is_read && <span className="block w-2 h-2 rounded-full bg-primary-500" /> },
 { key: 'title', header: 'Judul', render: r => <span className={cx(!r.is_read && 'font-semibold text-ink-900')}>{r.title}</span> },
 { key: 'body', header: 'Isi', render: r => <span className="line-clamp-2 max-w-md block text-ink-500">{r.body ?? '-'}</span> },
 { key: 'entity_type', header: 'Entitas', render: r => r.entity_type ? (ENTITY_MAP[r.entity_type]?.label ?? r.entity_type) : '-' },
 { key: 'created_at', header: 'Waktu', render: r => tglJam(r.created_at) },
 { key: 'status', header: 'Status', render: r => <Badge tone={r.is_read ? 'slate' : 'blue'}>{r.is_read ? 'Sudah dibaca' : 'Belum dibaca'}</Badge> },
 { key: 'aksi', header: 'Aksi', align: 'center', sortable: false, render: (r: any) => !r.is_read && (
 <Button size="sm" variant="outline" loading={busyId === r.id} onClick={(e: any) => { e.stopPropagation(); markRead(r) }}>Tandai Dibaca</Button>
 ) },
 ]}
 />
 )}
 </div>
 )
}
