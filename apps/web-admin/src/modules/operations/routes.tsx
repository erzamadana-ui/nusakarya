import React from 'react'
import type { AppRoute } from '@/App'
import Dashboard from './pages/Dashboard'
import Tiket from './pages/Tiket'
import Dispatch from './pages/Dispatch'
import WorkOrder from './pages/WorkOrder'
import Maintenance from './pages/Maintenance'
import AsetJaringan from './pages/AsetJaringan'
import Rca from './pages/Rca'

const routes: AppRoute[] = [
 { path: '/ops/dashboard', module: 'OPERATIONS', element: <Dashboard /> },
 { path: '/ops/tiket', module: 'OPERATIONS', element: <Tiket /> },
 { path: '/ops/dispatch', module: 'OPERATIONS', element: <Dispatch /> },
 { path: '/ops/work-order', module: 'OPERATIONS', element: <WorkOrder /> },
 { path: '/ops/maintenance', module: 'OPERATIONS', element: <Maintenance /> },
 { path: '/ops/aset-jaringan', module: 'OPERATIONS', element: <AsetJaringan /> },
 { path: '/ops/rca', module: 'OPERATIONS', element: <Rca /> },
]
export default routes
