export type Attendance = {
  id: string
  company_id: string
  employee_id: string
  work_date: string
  check_in_at: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  check_in_photo_url: string | null
  check_out_at: string | null
  check_out_lat: number | null
  check_out_lng: number | null
  check_out_photo_url: string | null
  shift_id: string | null
  status: string | null
  late_minutes: number | null
  work_minutes: number | null
  overtime_minutes: number | null
  note: string | null
}

export type WorkOrder = {
  id: string
  company_id: string
  wo_no: string
  wo_type: string
  ticket_id: string | null
  project_id: string | null
  spk_id: string | null
  title: string | null
  description: string | null
  customer_name: string | null
  customer_no: string | null
  address: string | null
  lat: number | null
  lng: number | null
  scheduled_at: string | null
  assigned_to: string | null
  assigned_at: string | null
  started_at: string | null
  finished_at: string | null
  duration_minutes: number | null
  status: string
  fail_reason: string | null
  result_note: string | null
  evidence_count: number | null
  points: number | null
  amount: number | null
  qc_status: string | null
}

export type WoChecklist = {
  id: string
  company_id: string
  work_order_id: string
  seq: number
  question: string
  answer_type: 'boolean' | 'text' | 'number' | 'photo' | 'signature' | string
  answer_value: string | null
  photo_url: string | null
  is_mandatory: boolean | null
  is_passed: boolean | null
}

export type Attachment = {
  id: string
  company_id: string
  entity_type: string
  entity_id: string
  file_name: string
  file_url: string
  mime_type: string | null
  size_bytes: number | null
  lat: number | null
  lng: number | null
  taken_at: string | null
  uploaded_by: string | null
}

export type ItemCatalog = {
  id: string
  company_id: string
  code: string
  name: string
  category: string | null
  uom: string | null
  last_price: number | null
  is_serial_tracked: boolean | null
  is_active: boolean
}

export type MaterialUsage = {
  id: string
  company_id: string
  work_order_id: string | null
  item_id: string
  qty_plan: number | null
  qty_actual: number | null
  note: string | null
  reported_by: string | null
  reported_at: string | null
}

export type Serial = {
  id: string
  company_id: string
  item_id: string
  serial_no: string
  mac_address: string | null
  status: string
  work_order_id: string | null
  holder_employee_id: string | null
  customer_ref: string | null
  install_date: string | null
}

export type Bast = {
  id: string
  company_id: string
  bast_no: string
  bast_date: string
  work_order_id: string | null
  customer_id: string
  title: string | null
  scope: string | null
  signed_by_customer: boolean | null
  signer_name: string | null
  signer_position: string | null
  signature_url: string | null
  geotag_lat: number | null
  geotag_lng: number | null
  status: string
}

export type Ticket = {
  id: string
  company_id: string
  ticket_no: string
  ticket_type: string | null
  customer_name: string | null
  customer_no: string | null
  customer_phone: string | null
  address: string | null
  lat: number | null
  lng: number | null
  category: string | null
  sub_category: string | null
  severity: string | null
  reported_at: string
  sla_minutes: number | null
  sla_due_at: string | null
  responded_at: string | null
  resolved_at: string | null
  closed_at: string | null
  sla_status: string | null
  status: string
  assigned_to: string | null
  description: string | null
}

export type TicketActivity = {
  id: string
  company_id: string
  ticket_id: string
  activity_type: string | null
  note: string | null
  lat: number | null
  lng: number | null
  photo_url: string | null
  created_by: string | null
  created_at: string
}

export type MaterialRequest = {
  id: string
  company_id: string
  mr_no: string
  request_date: string
  requester_id: string | null
  warehouse_id: string | null
  work_order_id: string | null
  project_id: string | null
  purpose: string | null
  status: string
  note: string | null
}

export type MaterialRequestItem = {
  id: string
  company_id: string
  mr_id: string
  item_id: string
  qty_request: number
  qty_approved: number | null
  qty_issued: number | null
  uom: string | null
  note: string | null
}

export type EmployeeCertification = {
  id: string
  company_id: string
  employee_id: string
  cert_type: string | null
  cert_name: string
  cert_no: string | null
  issuer: string | null
  issued_date: string | null
  expiry_date: string | null
  file_url: string | null
  status: string | null
}

export type ProductivityRow = {
  company_id: string
  employee_id: string
  employee_name: string
  period_code: string
  total_points: number
  total_amount: number
  target_points: number
  achievement_percent: number
}

export type Customer = {
  id: string
  company_id: string
  code: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
}
