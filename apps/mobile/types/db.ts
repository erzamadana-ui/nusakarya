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

export type Branch = {
  id: string
  company_id: string
  code: string
  name: string
  city: string | null
  province: string | null
  is_active: boolean
}

export type JobType = {
  id: string
  company_id: string
  code: string
  name: string
  category: string
  point_weight: number
  tariff_amount: number
  is_active: boolean
}

export type HseIncident = {
  id: string
  company_id: string
  incident_no: string
  incident_type: string | null
  incident_date: string
  branch_id: string | null
  work_order_id: string | null
  employee_id: string | null
  location: string | null
  lat: number | null
  lng: number | null
  description: string | null
  immediate_action: string | null
  corrective_action: string | null
  root_cause_id: string | null
  lost_days: number | null
  cost_estimate: number | null
  photo_urls: string[] | null
  status: string
  reported_by: string | null
  closed_at: string | null
  created_at: string
}

export type HseInspection = {
  id: string
  company_id: string
  inspection_no: string
  inspection_type: string | null
  inspection_date: string
  branch_id: string | null
  inspector_id: string | null
  target_ref: string | null
  findings: any[] | null
  score: number | null
  result: string | null
  follow_up: string | null
  due_date: string | null
  photo_urls: string[] | null
  status: string
  created_at: string
}

export type WorkPermit = {
  id: string
  company_id: string
  permit_no: string
  permit_type: string | null
  project_id: string | null
  work_order_id: string | null
  location: string | null
  lat: number | null
  lng: number | null
  valid_from: string | null
  valid_to: string | null
  safety_checklist: { label: string; checked: boolean }[] | null
  status: string
  requested_by: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export type OvertimeRequest = {
  id: string
  company_id: string
  spl_no: string
  employee_id: string
  work_order_id: string | null
  work_date: string
  start_at: string | null
  end_at: string | null
  hours: number | null
  reason: string | null
  calculated_amount: number | null
  status: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export type BusinessTrip = {
  id: string
  company_id: string
  sppd_no: string
  employee_id: string
  purpose: string | null
  destination: string | null
  transport_type: string | null
  start_date: string | null
  end_date: string | null
  daily_allowance: number | null
  total_advance: number | null
  status: string
  approved_by: string | null
  created_at: string
}

export type TripExpense = {
  id: string
  company_id: string
  trip_id: string
  category: string | null
  description: string | null
  expense_date: string | null
  amount: number
  receipt_url: string | null
  status: string
  created_at: string
}

export type EmployeeAdvance = {
  id: string
  company_id: string
  advance_no: string
  employee_id: string
  request_date: string
  purpose: string | null
  amount: number
  settled_amount: number
  due_date: string | null
  status: string
  approved_by: string | null
  note: string | null
  created_at: string
}

export type FreelancePayout = {
  id: string
  company_id: string
  payout_no: string
  period_code: string
  employee_id: string | null
  vendor_id: string | null
  payee_type: string
  gross_amount: number
  dpp_percent: number
  dpp_amount: number
  tax_rate: number | null
  tax_amount: number
  other_deduction: number
  net_amount: number
  has_npwp: boolean
  tax_scheme: string
  status: string
  paid_at: string | null
  note: string | null
  created_at: string
}

export type FreelancePayoutLine = {
  id: string
  company_id: string
  payout_id: string
  work_order_id: string | null
  job_type_id: string | null
  work_date: string | null
  description: string | null
  qty: number
  rate: number
  amount: number
  qc_passed: boolean | null
}

export type KnowledgeArticle = {
  id: string
  company_id: string
  article_no: string
  title: string
  category: string | null
  applicable_to: string | null
  symptom: string | null
  root_cause: string | null
  resolution_steps: string | null
  attachments: any[] | null
  view_count: number
  is_published: boolean
  updated_at: string
}

export type PunchList = {
  id: string
  company_id: string
  punch_no: string
  project_id: string
  bast_id: string | null
  category: string | null
  severity: string | null
  description: string | null
  location: string | null
  lat: number | null
  lng: number | null
  found_date: string
  due_date: string | null
  fixed_date: string | null
  assigned_to: string | null
  verified_by: string | null
  photo_urls: string[] | null
  status: string
  created_at: string
}

export type Competency = {
  id: string
  company_id: string
  code: string
  name: string
  category: string
  description: string | null
  required_for_positions: string[] | null
}

export type EmployeeCompetency = {
  id: string
  company_id: string
  employee_id: string
  competency_id: string
  level: string
  assessed_by: string | null
  assessed_at: string | null
  expiry_date: string | null
  evidence_url: string | null
}
