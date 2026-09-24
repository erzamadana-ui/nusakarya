import React from 'react'
import type { AppRoute } from '@/App'
import DashboardHR from './pages/DashboardHR'
import Karyawan from './pages/Karyawan'
import Formasi from './pages/Formasi'
import Sertifikasi from './pages/Sertifikasi'
import Absensi from './pages/Absensi'
import Roster from './pages/Roster'
import Cuti from './pages/Cuti'
import KomponenGaji from './pages/KomponenGaji'
import Payroll from './pages/Payroll'
import Produktivitas from './pages/Produktivitas'

const routes: AppRoute[] = [
 { path: '/hr/dashboard', module: 'HR', element: <DashboardHR /> },
 { path: '/hr/karyawan', module: 'HR', element: <Karyawan /> },
 { path: '/hr/formasi', module: 'HR', element: <Formasi /> },
 { path: '/hr/sertifikasi', module: 'HR', element: <Sertifikasi /> },
 { path: '/hr/absensi', module: 'HR', element: <Absensi /> },
 { path: '/hr/roster', module: 'HR', element: <Roster /> },
 { path: '/hr/cuti', module: 'HR', element: <Cuti /> },
 { path: '/hr/komponen-gaji', module: 'PAYROLL', element: <KomponenGaji /> },
 { path: '/hr/payroll', module: 'PAYROLL', element: <Payroll /> },
 { path: '/hr/produktivitas', module: 'PRODUCTIVITY', element: <Produktivitas /> },
]
export default routes
