import React from 'react'
import type { AppRoute } from '@/App'

/* Lapisan SaaS: onboarding, paket & pemakaian, undangan, konfigurasi adaptif, ekspor, panel pemilik. */
const Onboarding = React.lazy(() => import('./pages/Onboarding'))
const Langganan = React.lazy(() => import('./pages/Langganan'))
const UndangTim = React.lazy(() => import('./pages/UndangTim'))
const FieldKustom = React.lazy(() => import('./pages/FieldKustom'))
const AlurKerja = React.lazy(() => import('./pages/AlurKerja'))
const TabelKustom = React.lazy(() => import('./pages/TabelKustom'))
const DataKustom = React.lazy(() => import('./pages/TabelKustom').then(m => ({ default: m.DataKustom })))
const Preferensi = React.lazy(() => import('./pages/Preferensi'))
const Ekspor = React.lazy(() => import('./pages/Ekspor'))
const PlatformTenant = React.lazy(() => import('./pages/PlatformTenant'))

const routes: AppRoute[] = [
  { path: '/onboarding', module: 'CORE', element: <Onboarding /> },
  { path: '/pengaturan/langganan', module: 'CORE', element: <Langganan /> },
  { path: '/pengaturan/undang', module: 'CORE', element: <UndangTim /> },
  { path: '/pengaturan/field-kustom', module: 'CORE', element: <FieldKustom /> },
  { path: '/pengaturan/alur-kerja', module: 'CORE', element: <AlurKerja /> },
  { path: '/pengaturan/tabel-kustom', module: 'CORE', element: <TabelKustom /> },
  { path: '/data/:kode', module: 'CORE', element: <DataKustom /> },
  { path: '/pengaturan/preferensi', module: 'CORE', element: <Preferensi /> },
  { path: '/pengaturan/ekspor', module: 'CORE', element: <Ekspor /> },
  { path: '/platform', module: 'CORE', element: <PlatformTenant /> },
]
export default routes
