import React, { Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ToastProvider, Skeleton } from '@/components/ui'
import AppShell from '@/components/layout/AppShell'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import Login from '@/pages/Login'
import Forbidden from '@/pages/Forbidden'

import execRoutes from '@/modules/exec/routes'
import hrRoutes from '@/modules/hr/routes'
import commerceRoutes from '@/modules/commerce/routes'
import procurementRoutes from '@/modules/procurement/routes'
import financeRoutes from '@/modules/finance/routes'
import inventoryRoutes from '@/modules/inventory/routes'
import operationsRoutes from '@/modules/operations/routes'
import deploymentRoutes from '@/modules/deployment/routes'
import settingsRoutes from '@/modules/settings/routes'
import hrExtendedRoutes from '@/modules/hr-extended/routes'
import payrollFreelanceRoutes from '@/modules/payroll-freelance/routes'
import hseRoutes from '@/modules/hse/routes'
import financeExtendedRoutes from '@/modules/finance-extended/routes'
import opsExtendedRoutes from '@/modules/ops-extended/routes'
import deployExtendedRoutes from '@/modules/deploy-extended/routes'
import commerceProcExtendedRoutes from '@/modules/commerce-procurement-extended/routes'
import coreExtendedRoutes from '@/modules/core-extended/routes'
import tampilanRoutes from '@/modules/tampilan/routes'
import morningBmonRoutes from '@/modules/morning-bmon/routes'
import setelanPayrollRoutes from '@/modules/setelan-payroll/routes'
import referensiPajakRoutes from '@/modules/referensi-pajak/routes'
import kesiapanRoutes from '@/modules/kesiapan/routes'

export type AppRoute = { path: string; element: React.ReactNode; module: string }
const ROUTES: AppRoute[] = [
 ...execRoutes, ...hrRoutes, ...commerceRoutes, ...procurementRoutes, ...financeRoutes,
 ...inventoryRoutes, ...operationsRoutes, ...deploymentRoutes, ...settingsRoutes,
 ...hrExtendedRoutes, ...payrollFreelanceRoutes, ...hseRoutes, ...financeExtendedRoutes,
 ...opsExtendedRoutes, ...deployExtendedRoutes, ...commerceProcExtendedRoutes, ...coreExtendedRoutes,
  ...tampilanRoutes, ...morningBmonRoutes, ...setelanPayrollRoutes, ...referensiPajakRoutes, ...kesiapanRoutes,
]

function Guard({ module, children }: { module: string; children: React.ReactNode }) {
 const { can } = useAuth()
 if (!can(module, 'read')) return <Forbidden module={module} />
 return <>{children}</>
}

function Gate() {
 const { loading, session, profile } = useAuth()
 if (loading) return (
 <div className="min-h-screen grid place-items-center bg-ink-50">
 <div className="w-full max-w-sm space-y-3 px-6">
 <div className="mx-auto w-11 h-11 rounded-md bg-primary-500 text-white grid place-items-center font-display font-extrabold animate-pulse">N</div>
 <Skeleton className="h-3 w-3/4 mx-auto" /><Skeleton className="h-3 w-1/2 mx-auto" />
 </div>
 </div>)
 if (!session) return <Login />
 if (!profile) return (
 <div className="min-h-screen grid place-items-center p-6 text-center bg-ink-50">
 <div className="max-w-md">
 <h2 className="font-display text-xl font-bold">Profil belum disiapkan</h2>
 <p className="mt-2 text-body text-ink-500">Akun Anda belum ditautkan ke perusahaan mana pun. Hubungi administrator.</p>
 </div>
 </div>)
 return (
 <Routes>
 <Route element={<AppShell />}>
 <Route index element={<Navigate to="/dashboard" replace />} />
 {ROUTES.map(r => (
 <Route key={r.path} path={r.path}
 element={<Guard module={r.module}><Suspense fallback={<Skeleton className="h-64 w-full" />}>{r.element}</Suspense></Guard>} />
 ))}
 <Route path="*" element={<Navigate to="/dashboard" replace />} />
 </Route>
 </Routes>)
}

export default function App() {
 return (
 <HashRouter>
 <ToastProvider>
 <AuthProvider><Gate /></AuthProvider>
 </ToastProvider>
 </HashRouter>)
}
