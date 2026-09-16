import React from 'react'
import type { AppRoute } from '@/App'
import DashboardInventory from './pages/DashboardInventory'
import Gudang from './pages/Gudang'
import Stok from './pages/Stok'
import Nte from './pages/Nte'
import Mutasi from './pages/Mutasi'
import Permintaan from './pages/Permintaan'
import Pemakaian from './pages/Pemakaian'
import Opname from './pages/Opname'
import DaftarAset from './pages/aset/DaftarAset'
import PenugasanAset from './pages/aset/PenugasanAset'
import PemeliharaanAset from './pages/aset/PemeliharaanAset'

const routes: AppRoute[] = [
 { path: '/inventory/dashboard', module: 'INVENTORY', element: <DashboardInventory /> },
 { path: '/inventory/gudang', module: 'INVENTORY', element: <Gudang /> },
 { path: '/inventory/stok', module: 'INVENTORY', element: <Stok /> },
 { path: '/inventory/nte', module: 'INVENTORY', element: <Nte /> },
 { path: '/inventory/mutasi', module: 'INVENTORY', element: <Mutasi /> },
 { path: '/inventory/permintaan', module: 'INVENTORY', element: <Permintaan /> },
 { path: '/inventory/pemakaian', module: 'INVENTORY', element: <Pemakaian /> },
 { path: '/inventory/opname', module: 'INVENTORY', element: <Opname /> },
 { path: '/aset/daftar', module: 'ASSET', element: <DaftarAset /> },
 { path: '/aset/penugasan', module: 'ASSET', element: <PenugasanAset /> },
 { path: '/aset/pemeliharaan', module: 'ASSET', element: <PemeliharaanAset /> },
]
export default routes
