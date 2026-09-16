import React from 'react'
import type { AppRoute } from '@/App'
import Dashboard from './pages/Dashboard'
import Insiden from './pages/Insiden'
import Inspeksi from './pages/Inspeksi'
import IzinKerja from './pages/IzinKerja'

const routes: AppRoute[] = [
 { path: '/k3/dashboard', module: 'OPERATIONS', element: <Dashboard /> },
 { path: '/k3/insiden', module: 'OPERATIONS', element: <Insiden /> },
 { path: '/k3/inspeksi', module: 'OPERATIONS', element: <Inspeksi /> },
 { path: '/k3/izin-kerja', module: 'OPERATIONS', element: <IzinKerja /> },
]
export default routes
