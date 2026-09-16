import React from 'react'
import type { AppRoute } from '@/App'
import Dashboard from './pages/Dashboard'
import Proyek from './pages/Proyek'
import Survey from './pages/Survey'
import Drm from './pages/Drm'
import Boq from './pages/Boq'
import Progres from './pages/Progres'
import Qc from './pages/Qc'
import Dokumen from './pages/Dokumen'
import Rfs from './pages/Rfs'

const routes: AppRoute[] = [
 { path: '/deploy/dashboard', module: 'DEPLOYMENT', element: <Dashboard /> },
 { path: '/deploy/proyek', module: 'DEPLOYMENT', element: <Proyek /> },
 { path: '/deploy/survey', module: 'DEPLOYMENT', element: <Survey /> },
 { path: '/deploy/drm', module: 'DEPLOYMENT', element: <Drm /> },
 { path: '/deploy/boq', module: 'DEPLOYMENT', element: <Boq /> },
 { path: '/deploy/progres', module: 'DEPLOYMENT', element: <Progres /> },
 { path: '/deploy/qc', module: 'DEPLOYMENT', element: <Qc /> },
 { path: '/deploy/dokumen', module: 'DEPLOYMENT', element: <Dokumen /> },
 { path: '/deploy/rfs', module: 'DEPLOYMENT', element: <Rfs /> },
]
export default routes
