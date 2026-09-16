import React from 'react'
import type { AppRoute } from '@/App'
import Pengguna from './pages/Pengguna'
import HakAkses from './pages/HakAkses'
import Cabang from './pages/Cabang'
import Perusahaan from './pages/Perusahaan'
import Audit from './pages/Audit'

const routes: AppRoute[] = [
 { path: '/pengaturan/pengguna', module: 'CORE', element: <Pengguna /> },
 { path: '/pengaturan/hak-akses', module: 'CORE', element: <HakAkses /> },
 { path: '/pengaturan/cabang', module: 'CORE', element: <Cabang /> },
 { path: '/pengaturan/perusahaan', module: 'CORE', element: <Perusahaan /> },
 { path: '/pengaturan/audit', module: 'CORE', element: <Audit /> },
]
export default routes
