import React from 'react'
import type { AppRoute } from '@/App'
import SetelanBpjs from './pages/SetelanBpjs'

const routes: AppRoute[] = [
  { path: '/hr/setelan-bpjs', module: 'PAYROLL', element: <SetelanBpjs /> },
]
export default routes
