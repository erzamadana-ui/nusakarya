import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import supabase from './supabase'

export type Access = { module_code: string; can_read: boolean; can_write: boolean; can_approve: boolean }

export type Profile = {
  id: string
  company_id: string
  employee_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  role: string
  unit: string | null
  branch_id: string | null
  is_active: boolean
}

export type Employee = {
  id: string
  company_id: string
  nip: string
  full_name: string
  position: string | null
  unit: string | null
  employment_type: string | null
  join_date: string | null
  status: string
  photo_url: string | null
  phone: string | null
  email: string | null
}

type Ctx = {
  loading: boolean
  session: any
  profile: Profile | null
  employee: Employee | null
  company: any
  access: Record<string, Access>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  can: (module: string, level?: 'read' | 'write' | 'approve') => boolean
  refresh: () => Promise<void>
}

const AuthCtx = createContext<Ctx>({} as Ctx)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [company, setCompany] = useState<any>(null)
  const [access, setAccess] = useState<Record<string, Access>>({})

  const load = useCallback(async (s: any) => {
    if (!s?.user) {
      setProfile(null)
      setEmployee(null)
      setCompany(null)
      setAccess({})
      setLoading(false)
      return
    }
    try {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
      setProfile(p as Profile)
      if (p) {
        const tasks: any[] = [
          supabase.from('companies').select('*').eq('id', (p as any).company_id).maybeSingle(),
          supabase.from('role_module_access').select('module_code,can_read,can_write,can_approve').eq('role', (p as any).role),
        ]
        if ((p as any).employee_id) {
          tasks.push(supabase.from('employees').select('*').eq('id', (p as any).employee_id).maybeSingle())
        }
        const results = await Promise.all(tasks)
        setCompany(results[0]?.data ?? null)
        const map: Record<string, Access> = {}
        ;(results[1]?.data ?? []).forEach((a: any) => {
          map[a.module_code] = a
        })
        setAccess(map)
        if (results[2]) setEmployee((results[2]?.data as Employee) ?? null)
        supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', s.user.id)
          .then(() => {})
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      load(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      load(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setEmployee(null)
  }

  const can = (module: string, level: 'read' | 'write' | 'approve' = 'read') => {
    if (!profile) return false
    if (profile.role === 'super_admin') return true
    const a = access[module]
    if (!a) return false
    return level === 'read' ? a.can_read : level === 'write' ? a.can_write : a.can_approve
  }

  const refresh = async () => {
    const { data } = await supabase.auth.getSession()
    await load(data.session)
  }

  return (
    <AuthCtx.Provider value={{ loading, session, profile, employee, company, access, signIn, signOut, can, refresh }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  direktur: 'Direktur Utama',
  komisaris: 'Komisaris',
  manager_hr: 'Manager HR',
  manager_commerce: 'Manager Commerce',
  manager_procurement: 'Manager Procurement',
  manager_finance: 'Manager Finance',
  manager_inventory: 'Manager Inventory',
  manager_operations: 'Manager Operations',
  manager_deployment: 'Manager Deployment',
  staff_hr: 'Staf HR',
  staff_commerce: 'Staf Commerce',
  staff_procurement: 'Staf Procurement',
  staff_finance: 'Staf Finance',
  staff_inventory: 'Staf Inventory',
  spv_operations: 'Supervisor Operations',
  dispatcher: 'Dispatcher',
  teknisi: 'Teknisi',
  design_engineer: 'Design Engineer',
  project_manager: 'Project Manager',
  qc: 'Quality Control',
  mitra: 'Mitra Kerja',
  viewer: 'Viewer',
}
