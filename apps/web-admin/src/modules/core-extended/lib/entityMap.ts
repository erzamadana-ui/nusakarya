/** Peta entity_type (dari v_approval_inbox) ke tabel asal & kolom status.
 *  approveValue/rejectValue WAJIB sesuai CHECK constraint kolom status tabel terkait.
 *  noteCol: kolom pada tabel asal untuk menyimpan alasan penolakan bila tersedia.
 *  Bila noteCol kosong, alasan disimpan ke tabel `approvals`. */
export type EntityMapEntry = {
  table: string
  statusCol: string
  approveValue: string
  rejectValue: string
  noteCol?: string
  approvedByCol?: string
  approvedAtCol?: string
  label: string
}

export const ENTITY_MAP: Record<string, EntityMapEntry> = {
  purchase_request: { table: 'purchase_requests', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', noteCol: 'note', label: 'Purchase Request' },
  purchase_order: { table: 'purchase_orders', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'batal', noteCol: 'note', label: 'Purchase Order' },
  vendor_invoice: { table: 'vendor_invoices', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', label: 'Invoice Vendor' },
  progress_claim: { table: 'progress_claims', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', noteCol: 'note', label: 'Progress Claim' },
  ar_invoice: { table: 'ar_invoices', statusCol: 'status', approveValue: 'terkirim', rejectValue: 'draft', label: 'AR Invoice' },
  leave_request: { table: 'leave_requests', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', approvedByCol: 'approved_by', approvedAtCol: 'approved_at', label: 'Cuti & Izin' },
  overtime_request: { table: 'overtime_requests', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', approvedByCol: 'approved_by', approvedAtCol: 'approved_at', label: 'Pengajuan Lembur' },
  business_trip: { table: 'business_trips', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', approvedByCol: 'approved_by', label: 'Dinas' },
  trip_expense: { table: 'trip_expenses', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', label: 'Reimbursement Dinas' },
  employee_advance: { table: 'employee_advances', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', noteCol: 'note', approvedByCol: 'approved_by', label: 'Kasbon' },
  material_request: { table: 'material_requests', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', noteCol: 'note', label: 'Permintaan Material' },
  freelance_payout: { table: 'freelance_payouts', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', noteCol: 'note', label: 'Payout Mitra Freelance' },
  rfs_record: { table: 'rfs_records', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', noteCol: 'note', approvedByCol: 'approved_by', approvedAtCol: 'approved_at', label: 'RFS' },
  punch_list: { table: 'punch_lists', statusCol: 'status', approveValue: 'diverifikasi', rejectValue: 'ditolak', approvedByCol: 'verified_by', label: 'Punch List' },
  work_permit: { table: 'work_permits', statusCol: 'status', approveValue: 'disetujui', rejectValue: 'ditolak', approvedByCol: 'approved_by', approvedAtCol: 'approved_at', label: 'Izin Kerja' },
}

/** Rute daftar untuk membuka entitas dari notifikasi (route_path yang sama dipakai v_approval_inbox). */
export const ENTITY_ROUTES: Record<string, string> = {
  purchase_request: '/procurement/pr',
  purchase_order: '/procurement/po',
  vendor_invoice: '/procurement/invoice-vendor',
  progress_claim: '/commerce/klaim',
  ar_invoice: '/commerce/invoice',
  leave_request: '/hr/cuti',
  overtime_request: '/hr/lembur',
  business_trip: '/hr/perjalanan',
  trip_expense: '/hr/perjalanan',
  employee_advance: '/hr/kasbon',
  material_request: '/inventory/permintaan',
  freelance_payout: '/hr/payroll-freelance',
  rfs_record: '/deploy/rfs',
  punch_list: '/deploy/punchlist',
  work_permit: '/k3/izin-kerja',
}
