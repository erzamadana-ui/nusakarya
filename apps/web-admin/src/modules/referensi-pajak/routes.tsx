import React from 'react'
import type { AppRoute } from '@/App'
import ReferensiPajak from './pages/ReferensiPajak'

const routes: AppRoute[] = [
  { path: '/finance/referensi-pajak', module: 'FINANCE', element: <ReferensiPajak /> },
]
export default routes
