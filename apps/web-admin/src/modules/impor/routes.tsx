import React from 'react'
import type { AppRoute } from '@/App'

/* Pusat Impor memuat pembaca berkas dan spesifikasi seluruh dataset. Halaman ini
   jarang dibuka, jadi dimuat saat dibutuhkan saja (App.tsx sudah menyediakan
   Suspense) supaya bundel utama panel tidak ikut membesar. */
const PusatImpor = React.lazy(() => import('./pages/PusatImpor'))

const routes: AppRoute[] = [
  { path: '/pengaturan/impor', module: 'CORE', element: <PusatImpor /> },
]
export default routes
