import React from 'react'
import type { AppRoute } from '@/App'
import KesiapanProduksi from './pages/KesiapanProduksi'

const routes: AppRoute[] = [
  { path: '/pengaturan/kesiapan', module: 'CORE', element: <KesiapanProduksi /> },
]
export default routes
