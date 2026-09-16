import React from 'react'
import type { AppRoute } from '@/App'
import Tampilan from './pages/Tampilan'

const routes: AppRoute[] = [
 { path: '/pengaturan/tampilan', module: 'CORE', element: <Tampilan /> },
]
export default routes
