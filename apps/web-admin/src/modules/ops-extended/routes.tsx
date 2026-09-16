import React from 'react'
import type { AppRoute } from '@/App'
import AlarmNms from './pages/AlarmNms'
import SlaPelanggan from './pages/SlaPelanggan'
import Eskalasi from './pages/Eskalasi'
import Pengetahuan from './pages/Pengetahuan'

const routes: AppRoute[] = [
  { path: '/ops/alarm', module: 'OPERATIONS', element: <AlarmNms /> },
  { path: '/ops/sla-pelanggan', module: 'OPERATIONS', element: <SlaPelanggan /> },
  { path: '/ops/eskalasi', module: 'OPERATIONS', element: <Eskalasi /> },
  { path: '/ops/pengetahuan', module: 'OPERATIONS', element: <Pengetahuan /> },
]
export default routes
