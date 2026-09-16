import React from 'react'
import type { AppRoute } from '@/App'
import Dashboard from './pages/Dashboard'
import Eksekutif from './pages/Eksekutif'

const routes: AppRoute[] = [
 { path: '/dashboard', module: 'DASHBOARD', element: <Dashboard /> },
 { path: '/eksekutif', module: 'EXECUTIVE', element: <Eksekutif /> },
]
export default routes
