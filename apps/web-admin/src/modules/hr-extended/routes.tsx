import React from 'react'
import type { AppRoute } from '@/App'
import Lembur from './pages/Lembur'
import Perjalanan from './pages/Perjalanan'
import Kasbon from './pages/Kasbon'
import Rekrutmen from './pages/Rekrutmen'
import Kompetensi from './pages/Kompetensi'
import Penilaian from './pages/Penilaian'
import Disiplin from './pages/Disiplin'

const routes: AppRoute[] = [
  { path: '/hr/lembur', module: 'HR', element: <Lembur /> },
  { path: '/hr/perjalanan', module: 'HR', element: <Perjalanan /> },
  { path: '/hr/kasbon', module: 'HR', element: <Kasbon /> },
  { path: '/hr/rekrutmen', module: 'HR', element: <Rekrutmen /> },
  { path: '/hr/kompetensi', module: 'HR', element: <Kompetensi /> },
  { path: '/hr/penilaian', module: 'HR', element: <Penilaian /> },
  { path: '/hr/disiplin', module: 'HR', element: <Disiplin /> },
]
export default routes
