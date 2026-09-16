import React from 'react'
import type { AppRoute } from '@/App'
import DashboardFinance from './pages/DashboardFinance'
import AP from './pages/AP'
import AR from './pages/AR'
import JobCosting from './pages/JobCosting'
import Anggaran from './pages/Anggaran'
import Cashflow from './pages/Cashflow'

const routes: AppRoute[] = [
 { path: '/finance/dashboard', module: 'FINANCE', element: <DashboardFinance /> },
 { path: '/finance/ap', module: 'FINANCE', element: <AP /> },
 { path: '/finance/ar', module: 'FINANCE', element: <AR /> },
 { path: '/finance/job-costing', module: 'FINANCE', element: <JobCosting /> },
 { path: '/finance/anggaran', module: 'FINANCE', element: <Anggaran /> },
 { path: '/finance/cashflow', module: 'FINANCE', element: <Cashflow /> },
]
export default routes
