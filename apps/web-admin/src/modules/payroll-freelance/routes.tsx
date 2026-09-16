import React from 'react'
import type { AppRoute } from '@/App'
import MitraFreelance from './pages/MitraFreelance'
import PayrollFreelance from './pages/PayrollFreelance'

const routes: AppRoute[] = [
  { path: '/hr/freelance', module: 'PAYROLL', element: <MitraFreelance /> },
  { path: '/hr/payroll-freelance', module: 'PAYROLL', element: <PayrollFreelance /> },
]
export default routes
