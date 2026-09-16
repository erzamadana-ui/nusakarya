import React from 'react'
import type { AppRoute } from '@/App'
import InboxPersetujuan from './pages/InboxPersetujuan'
import Notifikasi from './pages/Notifikasi'
import DataMaster from './pages/DataMaster'

const routes: AppRoute[] = [
 { path: '/persetujuan', module: 'DASHBOARD', element: <InboxPersetujuan /> },
 { path: '/notifikasi', module: 'DASHBOARD', element: <Notifikasi /> },
 { path: '/pengaturan/master', module: 'CORE', element: <DataMaster /> },
]
export default routes
