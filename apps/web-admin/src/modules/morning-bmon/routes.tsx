import React from 'react'
import type { AppRoute } from '@/App'
import Morning from './pages/Morning'
import Bmon from './pages/Bmon'

const routes: AppRoute[] = [
  { path: '/ops/morning', module: 'OPERATIONS', element: <Morning /> },
  { path: '/ops/bmon', module: 'OPERATIONS', element: <Bmon /> },
]
export default routes
