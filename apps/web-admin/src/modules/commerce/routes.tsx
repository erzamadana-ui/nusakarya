import React from 'react'
import type { AppRoute } from '@/App'
import DashboardCommerce from './pages/Dashboard'
import Pelanggan from './pages/Pelanggan'
import Kontrak from './pages/Kontrak'
import PriceList from './pages/PriceList'
import Spk from './pages/Spk'
import Klaim from './pages/Klaim'
import Bast from './pages/Bast'
import Invoice from './pages/Invoice'
import Penalti from './pages/Penalti'

const routes: AppRoute[] = [
  { path: '/commerce/dashboard', module: 'COMMERCE', element: <DashboardCommerce /> },
  { path: '/commerce/pelanggan', module: 'COMMERCE', element: <Pelanggan /> },
  { path: '/commerce/kontrak', module: 'COMMERCE', element: <Kontrak /> },
  { path: '/commerce/price-list', module: 'COMMERCE', element: <PriceList /> },
  { path: '/commerce/spk', module: 'COMMERCE', element: <Spk /> },
  { path: '/commerce/klaim', module: 'COMMERCE', element: <Klaim /> },
  { path: '/commerce/bast', module: 'COMMERCE', element: <Bast /> },
  { path: '/commerce/invoice', module: 'COMMERCE', element: <Invoice /> },
  { path: '/commerce/penalti', module: 'COMMERCE', element: <Penalti /> },
]
export default routes
