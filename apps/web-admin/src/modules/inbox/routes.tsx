import React from 'react'
import type { AppRoute } from '@/App'
import InboxKerja from './pages/InboxKerja'

const routes: AppRoute[] = [
  { path: '/inbox', module: 'CORE', element: <InboxKerja /> },
]
export default routes
