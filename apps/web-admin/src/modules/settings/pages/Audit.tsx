import React, { useEffect, useMemo, useState } from 'react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { tglJam, todayISO } from '@/lib/format'
import { PageHeader, FilterBar, Field, Input, Select, DataTable, Drawer, Badge, Skeleton, type Column } from '@/components/ui'

type AuditRow = {
 id: string; user_id: string | null; action: string; entity_type: string; entity_id: string | null
 before: any; after: any; created_at: string
}

export default function Audit() {
 const { profile } = useAuth()
 const [rows, setRows] = useState<AuditRow[]>([])
 const [userNames, setUserNames] = useState<Record<string, string>>({})
 const [loading, setLoading] = useState(true)
 const [from, setFrom] = useState('')
 const [to, setTo] = useState('')
 const [action, setAction] = useState('')
 const [entity, setEntity] = useState('')
 const [detail, setDetail] = useState<AuditRow | null>(null)

 const load = async () => {
 setLoading(true)
 try {
 let q = supabase.from('audit_logs').select('id, user_id, action, entity_type, entity_id, before, after, created_at')
 .order('created_at', { ascending: false }).limit(500)
 if (from) q = q.gte('created_at', from)
 if (to) q = q.lte('created_at', `${to}T23:59:59`)
 if (action) q = q.ilike('action', `%${action}%`)
 if (entity) q = q.ilike('entity_type', `%${entity}%`)
 const [{ data, error }, { data: profs }] = await Promise.all([q, supabase.from('profiles').select('id, full_name')])
 if (error) throw error
 setRows((data ?? []) as AuditRow[])
 setUserNames(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name])))
 } catch { /* silent: audit log tetap kosong bila gagal */ } finally { setLoading(false) }
 }
 useEffect(() => { if (profile) load() }, [profile])

 const actions = useMemo(() => Array.from(new Set(rows.map(r => r.action))).sort(), [rows])
 const entities = useMemo(() => Array.from(new Set(rows.map(r => r.entity_type))).sort(), [rows])

 const columns: Column[] = [
 { key: 'created_at', header: 'Waktu', width: '160px', render: r => tglJam(r.created_at) },
 { key: 'user_id', header: 'Pengguna', render: r => userNames[r.user_id ?? ''] ?? 'Sistem' },
 { key: 'action', header: 'Aksi', render: r => <Badge>{r.action}</Badge> },
 { key: 'entity_type', header: 'Entitas', render: r => `${r.entity_type}${r.entity_id ? ' · ' + r.entity_id.slice(0, 8) : ''}` },
 ]

 return (
 <div>
 <PageHeader title="Log Audit" subtitle="Riwayat perubahan data di seluruh modul — hanya bisa dilihat" />

 <FilterBar>
 <Field label="Dari Tanggal"><Input type="date" value={from} max={to || todayISO()} onChange={(e: any) => setFrom(e.target.value)} /></Field>
 <Field label="Sampai Tanggal"><Input type="date" value={to} min={from} max={todayISO()} onChange={(e: any) => setTo(e.target.value)} /></Field>
 <Field label="Aksi"><Select value={action} onChange={(e: any) => setAction(e.target.value)} options={actions} placeholder="Semua aksi" /></Field>
 <Field label="Entitas"><Select value={entity} onChange={(e: any) => setEntity(e.target.value)} options={entities} placeholder="Semua entitas" /></Field>
 <button onClick={load} className="h-10 px-4 rounded-sm text-body font-medium bg-primary-500 text-white hover:bg-primary-600">Terapkan</button>
 </FilterBar>

 {loading ? <Skeleton className="h-96 w-full rounded-md" /> : (
 <DataTable
 columns={columns} rows={rows} loading={loading}
 onRowClick={(r) => setDetail(r)}
 searchKeys={['action', 'entity_type']} exportName="log-audit"
 emptyTitle="Belum ada log audit" emptyMessage="Perubahan data pada modul lain akan tercatat di sini."
 />
 )}

 <Drawer open={!!detail} onClose={() => setDetail(null)} title="Detail Perubahan"
 footer={<button onClick={() => setDetail(null)} className="h-10 px-4 rounded-sm text-body font-medium border border-ink-200">Tutup</button>}>
 {detail && (
 <div className="space-y-4">
 <dl className="grid grid-cols-2 gap-3 text-body">
 <div><dt className="text-caption text-ink-400">Waktu</dt><dd className="text-ink-800">{tglJam(detail.created_at)}</dd></div>
 <div><dt className="text-caption text-ink-400">Pengguna</dt><dd className="text-ink-800">{userNames[detail.user_id ?? ''] ?? 'Sistem'}</dd></div>
 <div><dt className="text-caption text-ink-400">Aksi</dt><dd><Badge>{detail.action}</Badge></dd></div>
 <div><dt className="text-caption text-ink-400">Entitas</dt><dd className="text-ink-800">{detail.entity_type} {detail.entity_id ? `(${detail.entity_id})` : ''}</dd></div>
 </dl>
 <div className="grid sm:grid-cols-2 gap-3">
 <div>
 <p className="text-caption font-medium text-ink-500 uppercase tracking-wide mb-1.5">Sebelum</p>
 <pre className="text-caption whitespace-pre-wrap break-all bg-ink-50 border border-ink-200 rounded-sm p-3 max-h-80 overflow-auto">
 {detail.before ? JSON.stringify(detail.before, null, 2) : '—'}
 </pre>
 </div>
 <div>
 <p className="text-caption font-medium text-ink-500 uppercase tracking-wide mb-1.5">Sesudah</p>
 <pre className="text-caption whitespace-pre-wrap break-all bg-ink-50 border border-ink-200 rounded-sm p-3 max-h-80 overflow-auto">
 {detail.after ? JSON.stringify(detail.after, null, 2) : '—'}
 </pre>
 </div>
 </div>
 </div>
 )}
 </Drawer>
 </div>
 )
}
