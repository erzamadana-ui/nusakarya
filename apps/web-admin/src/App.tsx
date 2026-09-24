import React, { Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ToastProvider, Skeleton } from '@/components/ui'
import AppShell from '@/components/layout/AppShell'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import Login from '@/pages/Login'
import Forbidden from '@/pages/Forbidden'
import Daftar, { TerimaUndangan, BuatWorkspace } from '@/pages/Daftar'
import UpgradeGate from '@/modules/saas/components/UpgradeGate'
import { MODUL_LABEL } from '@/modules/saas/lib/konstanta'

import execRoutes from '@/modules/exec/routes'
import inboxRoutes from '@/modules/inbox/routes'
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
import imporRoutes from '@/modules/impor/routes'
import saasRoutes from '@/modules/saas/routes'

export type AppRoute = { path: string; element: React.ReactNode; module: string }
const ROUTES: AppRoute[] = [
 ...execRoutes, ...inboxRoutes, ...hrRoutes, ...commerceRoutes, ...procurementRoutes, ...financeRoutes,
 ...inventoryRoutes, ...operationsRoutes, ...deploymentRoutes, ...settingsRoutes,
 ...hrExtendedRoutes, ...payrollFreelanceRoutes, ...hseRoutes, ...financeExtendedRoutes,
 ...opsExtendedRoutes, ...deployExtendedRoutes, ...commerceProcExtendedRoutes, ...coreExtendedRoutes,
  ...tampilanRoutes, ...morningBmonRoutes, ...setelanPayrollRoutes, ...referensiPajakRoutes, ...kesiapanRoutes,
  ...imporRoutes, ...saasRoutes,
]

function Guard({ module, children }: { module: string; children: React.ReactNode }) {
 const { can, modulDalamPaket } = useAuth()
 if (!modulDalamPaket(module)) return <UpgradeGate modul={`Modul ${MODUL_LABEL[module] ?? module}`} />
 if (!can(module, 'read')) return <Forbidden module={module} />
 return <>{children}</>
}

function Gate() {
 const { loading, session, profile, onboarding } = useAuth()
 if (loading) return (
 <div className="min-h-screen grid place-items-center bg-ink-50">
 <div className="w-full max-w-sm space-y-3 px-6">
 <div className="mx-auto w-11 h-11 rounded-md bg-primary-500 text-white grid place-items-center font-display font-extrabold animate-pulse">N</div>
 <Skeleton className="h-3 w-3/4 mx-auto" /><Skeleton className="h-3 w-1/2 mx-auto" />
 </div>
 </div>)
 if (!session) return (
 <Routes>
 <Route path="/daftar" element={<Daftar />} />
 <Route path="/undangan/:token" element={<TerimaUndangan />} />
 <Route path="*" element={<Login />} />
 </Routes>)
 if (!profile) return (
 <Routes>
 <Route path="/undangan/:token" element={<TerimaUndangan />} />
 <Route path="*" element={<BuatWorkspace />} />
 </Routes>)
 const awal = profile.role === 'super_admin' && onboarding && !onboarding.activated_at ? '/onboarding' : '/dashboard'
 return (
 <Routes>
 <Route element={<AppShell />}>
 <Route index element={<Navigate to={awal} replace />} />
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
