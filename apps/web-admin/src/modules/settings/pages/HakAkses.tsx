import React, { useEffect, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth, ROLE_LABEL } from '@/lib/auth'
import { PageHeader, Card, Skeleton, useToast, cx } from '@/components/ui'

type ModuleRow = { code: string; name: string }
type AccessRow = { id: string; role: string; module_code: string; can_read: boolean; can_write: boolean; can_approve: boolean }
type Level = 'can_read' | 'can_write' | 'can_approve'

export default function HakAkses() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const editable = can('CORE', 'approve')
 const [loading, setLoading] = useState(true)
 const [modules, setModules] = useState<ModuleRow[]>([])
 const [matrix, setMatrix] = useState<Record<string, AccessRow>>({})
 const [busyKey, setBusyKey] = useState<string | null>(null)

 const roles = useMemo(() => Object.keys(ROLE_LABEL).filter(r => r !== 'super_admin'), [])

 useEffect(() => {
 if (!profile) return
 let alive = true
 setLoading(true)
 Promise.all([
 supabase.from('modules').select('code, name').order('sort_order'),
 supabase.from('role_module_access').select('id, role, module_code, can_read, can_write, can_approve'),
 ]).then(([m, a]) => {
 if (!alive) return
 setModules((m.data ?? []) as ModuleRow[])
 const map: Record<string, AccessRow> = {}
 ;(a.data ?? []).forEach((r: any) => { map[`${r.role}|${r.module_code}`] = r })
 setMatrix(map)
 }).catch(() => {}).finally(() => alive && setLoading(false))
 return () => { alive = false }
 }, [profile])

 const toggle = async (role: string, moduleCode: string, level: Level) => {
 if (!editable || !profile) return
 const key = `${role}|${moduleCode}`
 const current = matrix[key]
 const nextVal = !(current?.[level] ?? false)
 setBusyKey(key + level)
 try {
 if (current?.id) {
 const { data, error } = await supabase.from('role_module_access').update({ [level]: nextVal }).eq('id', current.id).select().single()
 if (error) throw error
 setMatrix(m => ({ ...m, [key]: data as AccessRow }))
 } else {
 const payload = { company_id: profile.company_id, role, module_code: moduleCode, can_read: false, can_write: false, can_approve: false, [level]: nextVal }
 const { data, error } = await supabase.from('role_module_access').insert(payload).select().single()
 if (error) throw error
 setMatrix(m => ({ ...m, [key]: data as AccessRow }))
 }
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan hak akses', 'error') } finally { setBusyKey(null) }
 }

 return (
 <div>
 <PageHeader title="Hak Akses Jabatan" subtitle="Matriks Baca / Tulis / Setujui per jabatan untuk setiap modul" />

 <Card className="mb-4 border-primary-200 bg-primary-50/40">
 <div className="p-4 flex gap-3">
 <Info size={18} className="text-primary-600 mt-0.5 shrink-0" />
 <p className="text-body text-ink-700">
 Halaman ini adalah pusat pengaturan yang membuat tampilan & tombol aksi setiap jabatan menyesuaikan diri secara otomatis di seluruh panel
 — tanpa perlu mengubah kode program. Centang <b>Baca</b> untuk mengizinkan jabatan melihat modul, <b>Tulis</b> untuk menambah/mengubah data,
 dan <b>Setujui</b> untuk menyetujui/menolak dokumen serta tindakan berisiko lain.
 {!editable && <span className="block mt-1 text-caption text-ink-500">Anda hanya dapat melihat matriks ini. Hubungi pemegang hak Setujui pada modul Core & Administrasi untuk mengubahnya.</span>}
 </p>
 </div>
 </Card>

 {loading ? <Skeleton className="h-96 w-full rounded-md" /> : (
 <Card className="overflow-auto">
 <table className="min-w-full text-body border-separate border-spacing-0">
 <thead>
 <tr>
 <th className="sticky left-0 z-20 bg-ink-50 px-4 h-11 text-left font-semibold text-caption uppercase tracking-wide text-ink-500 border-b border-r border-ink-200 whitespace-nowrap">Jabatan</th>
 {modules.map(m => (
 <th key={m.code} className="bg-ink-50 px-3 h-11 text-center font-semibold text-caption uppercase tracking-wide text-ink-500 border-b border-ink-200 whitespace-nowrap min-w-[132px]">{m.name}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {roles.map(role => (
 <tr key={role} className="border-b border-ink-100">
 <td className="sticky left-0 z-10 bg-surface px-4 py-2.5 font-medium text-ink-800 border-r border-ink-200 whitespace-nowrap">{ROLE_LABEL[role]}</td>
 {modules.map(m => {
 const key = `${role}|${m.code}`
 const a = matrix[key]
 return (
 <td key={m.code} className="px-3 py-2.5">
 <div className="flex items-center justify-center gap-2.5">
 {(['can_read', 'can_write', 'can_approve'] as Level[]).map(level => (
 <label key={level} title={level === 'can_read' ? 'Baca' : level === 'can_write' ? 'Tulis' : 'Setujui'}
 className={cx('inline-flex flex-col items-center gap-0.5', editable && 'cursor-pointer')}>
 <input type="checkbox" disabled={!editable || busyKey === key + level}
 checked={!!a?.[level]} onChange={() => toggle(role, m.code, level)}
 className="w-4 h-4 rounded-xs border-ink-300 text-primary-500 focus:ring-primary-400 disabled:opacity-60" />
 <span className="text-[9px] text-ink-400 uppercase">{level === 'can_read' ? 'B' : level === 'can_write' ? 'T' : 'S'}</span>
 </label>
 ))}
 </div>
 </td>
 )
 })}
 </tr>
 ))}
 </tbody>
 </table>
 </Card>
 )}
 </div>
 )
}
