import React from 'react'
import type { AppRoute } from '@/App'
import Perizinan from './pages/Perizinan'
import Punchlist from './pages/Punchlist'
import Garansi from './pages/Garansi'
import Subkon from './pages/Subkon'

const routes: AppRoute[] = [
 { path: '/deploy/perizinan', module: 'DEPLOYMENT', element: <Perizinan /> },
 { path: '/deploy/punchlist', module: 'DEPLOYMENT', element: <Punchlist /> },
 { path: '/deploy/garansi', module: 'DEPLOYMENT', element: <Garansi /> },
 { path: '/deploy/subkon', module: 'DEPLOYMENT', element: <Subkon /> },
]
export default routes
