import React from 'react'
import type { AppRoute } from '@/App'
import Dashboard from './pages/Dashboard'
import Vendor from './pages/Vendor'
import Katalog from './pages/Katalog'
import PR from './pages/PR'
import RFQ from './pages/RFQ'
import PO from './pages/PO'
import GR from './pages/GR'
import InvoiceVendor from './pages/InvoiceVendor'
import Scorecard from './pages/Scorecard'

const routes: AppRoute[] = [
 { path: '/procurement/dashboard', module: 'PROCUREMENT', element: <Dashboard /> },
 { path: '/procurement/vendor', module: 'PROCUREMENT', element: <Vendor /> },
 { path: '/procurement/katalog', module: 'PROCUREMENT', element: <Katalog /> },
 { path: '/procurement/pr', module: 'PROCUREMENT', element: <PR /> },
 { path: '/procurement/rfq', module: 'PROCUREMENT', element: <RFQ /> },
 { path: '/procurement/po', module: 'PROCUREMENT', element: <PO /> },
 { path: '/procurement/gr', module: 'PROCUREMENT', element: <GR /> },
 { path: '/procurement/invoice-vendor', module: 'PROCUREMENT', element: <InvoiceVendor /> },
 { path: '/procurement/scorecard', module: 'PROCUREMENT', element: <Scorecard /> },
]
export default routes
