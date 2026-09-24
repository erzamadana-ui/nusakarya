import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import supabase from './supabase'

export type Access = { module_code: string; can_read: boolean; can_write: boolean; can_approve: boolean }
export type Profile = {
 id: string; company_id: string; employee_id: string | null; full_name: string; email: string
 phone: string | null; avatar_url: string | null; role: string; unit: string | null
 branch_id: string | null; is_active: boolean
}
/** Ringkasan paket langganan tenant (fn_ringkasan_langganan). */
export type Langganan = {
 plan_code?: string; plan_name?: string; status: string; trial_ends_at?: string | null
 price_monthly?: number; limits?: Record<string, number | null>; modules: string[] | null; features: string[] | null
 usage?: Record<string, number>; support?: string
}
type Ctx = {
 loading: boolean
 session: any
 profile: Profile | null
 company: any
 access: Record<string, Access>
 signIn: (email: string, password: string) => Promise<void>
 signOut: () => Promise<void>
 can: (module: string, level?: 'read' | 'write' | 'approve') => boolean
 /** Padanan can_write_master() di database: hak tulis MASTER DATA.
  *  Peran lapangan (teknisi, mitra) ditolak walaupun can_write = true. */
 canMaster: (module: string) => boolean
 isPeranLapangan: boolean
 /** Paket langganan tenant; null = belum dimuat / tenant lama tanpa paket. */
 langganan: Langganan | null
 /** Pemilik aplikasi NUSAKARYA (bukan admin tenant). */
 isPlatformAdmin: boolean
 /** Modul termasuk paket? (terlepas dari hak jabatan) */
 modulDalamPaket: (module: string) => boolean
 /** Fitur SaaS aktif untuk tenant ini? mis. 'custom_field', 'tabel_kustom'. */
 fitur: (kode: string) => boolean
 /** Langganan hanya-baca (ditangguhkan / masa uji coba habis). */
 hanyaBaca: boolean
 onboarding: { activated_at: string | null; langkah_selesai: string[]; template_code: string | null } | null
 refresh: () => Promise<void>
}
/** Cadangan bila tabel peran_lapangan gagal dibaca — samakan dengan isi tabelnya. */
const PERAN_LAPANGAN_BAWAAN = ['teknisi', 'mitra']
const AuthCtx = createContext<Ctx>({} as Ctx)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
 const [loading, setLoading] = useState(true)
 const [session, setSession] = useState<any>(null)
 const [profile, setProfile] = useState<Profile | null>(null)
 const [company, setCompany] = useState<any>(null)
 const [access, setAccess] = useState<Record<string, Access>>({})
 const [peranLapangan, setPeranLapangan] = useState<string[]>(PERAN_LAPANGAN_BAWAAN)
 const [langganan, setLangganan] = useState<Langganan | null>(null)
 const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
 const [onboarding, setOnboarding] = useState<Ctx['onboarding']>(null)

 const load = useCallback(async (s: any) => {
 if (!s?.user) { setProfile(null); setCompany(null); setAccess({}); setLoading(false); return }
 const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
 setProfile(p as Profile)
 if (p) {
 const [{ data: c }, { data: acc }] = await Promise.all([
 supabase.from('companies').select('*').eq('id', (p as any).company_id).maybeSingle(),
 supabase.from('role_module_access').select('module_code,can_read,can_write,can_approve').eq('role', (p as any).role),
 ])
 setCompany(c)
 const map: Record<string, Access> = {}
 ;(acc ?? []).forEach((a: any) => { map[a.module_code] = a })
 setAccess(map)
 // Lapisan SaaS — gagal diam-diam bila migrasi 0051 belum terpasang (perilaku lama tetap jalan).
 const [{ data: lg }, { data: pa }, { data: ob }] = await Promise.all([
 supabase.rpc('fn_ringkasan_langganan'),
 supabase.from('platform_admins').select('user_id').eq('user_id', s.user.id).maybeSingle(),
 supabase.from('tenant_onboarding').select('activated_at,langkah_selesai,template_code').eq('company_id', (p as any).company_id).maybeSingle(),
 ])
 setLangganan((lg as Langganan) ?? null)
 setIsPlatformAdmin(!!pa)
 setOnboarding((ob as any) ?? null)
 supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', s.user.id).then(() => {})
 }
 setLoading(false)
 }, [])

 useEffect(() => {
 supabase.auth.getSession().then(({ data }) => { setSession(data.session); load(data.session) })
 const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); load(s) })
 return () => sub.subscription.unsubscribe()
 }, [load])

 const signIn = async (email: string, password: string) => {
 const { error } = await supabase.auth.signInWithPassword({ email, password })
 if (error) throw error
 }
 const signOut = async () => { await supabase.auth.signOut(); setProfile(null) }
 const modulDalamPaket = (module: string) => {
 if (module === 'CORE' || module === 'DASHBOARD') return true
 if (!langganan?.modules) return true
 return langganan.modules.includes(module)
 }
 const fitur = (kode: string) => !langganan?.features || langganan.features.includes(kode)
 const hanyaBaca = !!langganan && ['suspended', 'cancelled', 'trial_berakhir'].includes(langganan.status)
 const can = (module: string, level: 'read' | 'write' | 'approve' = 'read') => {
 if (!profile) return false
 if (!modulDalamPaket(module)) return false
 if (level !== 'read' && hanyaBaca) return false
 if (profile.role === 'super_admin') return true
 const a = access[module]
 if (!a) return false
 return level === 'read' ? a.can_read : level === 'write' ? a.can_write : a.can_approve
 }
 const isPeranLapangan = !!profile && profile.role !== 'super_admin' && peranLapangan.includes(profile.role)
 const canMaster = (module: string) => can(module, 'write') && !isPeranLapangan
 const refresh = async () => { const { data } = await supabase.auth.getSession(); await load(data.session) }

 return <AuthCtx.Provider value={{ loading, session, profile, company, access, signIn, signOut, can, canMaster, isPeranLapangan,
 langganan, isPlatformAdmin, modulDalamPaket, fitur, hanyaBaca, onboarding, refresh }}>{children}</AuthCtx.Provider>
}

export const ROLE_LABEL: Record<string, string> = {
 super_admin: 'Super Admin', direktur: 'Direktur Utama', komisaris: 'Komisaris',
 manager_hr: 'Manager HR', manager_commerce: 'Manager Commerce', manager_procurement: 'Manager Procurement',
 manager_finance: 'Manager Finance', manager_inventory: 'Manager Inventory', manager_operations: 'Manager Operations',
 manager_deployment: 'Manager Deployment', staff_hr: 'Staf HR', staff_commerce: 'Staf Commerce',
 staff_procurement: 'Staf Procurement', staff_finance: 'Staf Finance', staff_inventory: 'Staf Inventory',
 spv_operations: 'Supervisor Operations', dispatcher: 'Dispatcher', teknisi: 'Teknisi',
 design_engineer: 'Design Engineer', project_manager: 'Project Manager', qc: 'Quality Control',
 mitra: 'Mitra Kerja', viewer: 'Viewer',
}
