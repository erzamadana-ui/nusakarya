import React from 'react'
import type { AppRoute } from '@/App'
import COA from './pages/COA'
import Jurnal from './pages/Jurnal'
import Pajak from './pages/Pajak'
import KasKecil from './pages/KasKecil'
import Bank from './pages/Bank'

const routes: AppRoute[] = [
  { path: '/finance/coa', module: 'FINANCE', element: <COA /> },
  { path: '/finance/jurnal', module: 'FINANCE', element: <Jurnal /> },
  { path: '/finance/pajak', module: 'FINANCE', element: <Pajak /> },
  { path: '/finance/kas-kecil', module: 'FINANCE', element: <KasKecil /> },
  { path: '/finance/bank', module: 'FINANCE', element: <Bank /> },
]
export default routes
