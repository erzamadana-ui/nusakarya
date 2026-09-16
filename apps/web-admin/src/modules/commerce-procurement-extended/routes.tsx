import React from 'react'
import type { AppRoute } from '@/App'
import Pipeline from './pages/Pipeline'
import Komplain from './pages/Komplain'
import KontrakVendor from './pages/KontrakVendor'
import Retur from './pages/Retur'

const routes: AppRoute[] = [
  { path: '/commerce/pipeline', module: 'COMMERCE', element: <Pipeline /> },
  { path: '/commerce/komplain', module: 'COMMERCE', element: <Komplain /> },
  { path: '/procurement/kontrak-vendor', module: 'PROCUREMENT', element: <KontrakVendor /> },
  { path: '/procurement/retur', module: 'PROCUREMENT', element: <Retur /> },
]
export default routes
