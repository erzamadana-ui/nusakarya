-- =====================================================================
-- 0021_rls_extended.sql — Row Level Security untuk seluruh tabel tahap-2
-- =====================================================================

-- ---- job_vacancies (HR) ----
alter table job_vacancies enable row level security;
create policy job_vacancies_select on job_vacancies for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy job_vacancies_insert on job_vacancies for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy job_vacancies_update on job_vacancies for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy job_vacancies_delete on job_vacancies for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- job_applicants (HR) ----
alter table job_applicants enable row level security;
create policy job_applicants_select on job_applicants for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy job_applicants_insert on job_applicants for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy job_applicants_update on job_applicants for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy job_applicants_delete on job_applicants for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- competencies (HR) ----
alter table competencies enable row level security;
create policy competencies_select on competencies for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy competencies_insert on competencies for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy competencies_update on competencies for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy competencies_delete on competencies for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- employee_competencies (HR) ----
alter table employee_competencies enable row level security;
create policy employee_competencies_select on employee_competencies for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy employee_competencies_insert on employee_competencies for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy employee_competencies_update on employee_competencies for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy employee_competencies_delete on employee_competencies for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- trainings (HR) ----
alter table trainings enable row level security;
create policy trainings_select on trainings for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy trainings_insert on trainings for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy trainings_update on trainings for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy trainings_delete on trainings for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- training_participants (HR) ----
alter table training_participants enable row level security;
create policy training_participants_select on training_participants for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy training_participants_insert on training_participants for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy training_participants_update on training_participants for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy training_participants_delete on training_participants for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- overtime_requests (HR) ----
alter table overtime_requests enable row level security;
create policy overtime_requests_select on overtime_requests for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy overtime_requests_insert on overtime_requests for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy overtime_requests_update on overtime_requests for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy overtime_requests_delete on overtime_requests for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- business_trips (HR) ----
alter table business_trips enable row level security;
create policy business_trips_select on business_trips for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy business_trips_insert on business_trips for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy business_trips_update on business_trips for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy business_trips_delete on business_trips for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- trip_expenses (HR) ----
alter table trip_expenses enable row level security;
create policy trip_expenses_select on trip_expenses for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy trip_expenses_insert on trip_expenses for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy trip_expenses_update on trip_expenses for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy trip_expenses_delete on trip_expenses for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- disciplinary_actions (HR) ----
alter table disciplinary_actions enable row level security;
create policy disciplinary_actions_select on disciplinary_actions for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy disciplinary_actions_insert on disciplinary_actions for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy disciplinary_actions_update on disciplinary_actions for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy disciplinary_actions_delete on disciplinary_actions for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- performance_reviews (HR) ----
alter table performance_reviews enable row level security;
create policy performance_reviews_select on performance_reviews for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy performance_reviews_insert on performance_reviews for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy performance_reviews_update on performance_reviews for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy performance_reviews_delete on performance_reviews for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- performance_review_items (HR) ----
alter table performance_review_items enable row level security;
create policy performance_review_items_select on performance_review_items for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy performance_review_items_insert on performance_review_items for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy performance_review_items_update on performance_review_items for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy performance_review_items_delete on performance_review_items for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- employee_advances (HR) ----
alter table employee_advances enable row level security;
create policy employee_advances_select on employee_advances for select
  using (company_id = auth_company_id() and can_read('HR'));
create policy employee_advances_insert on employee_advances for insert
  with check (company_id = auth_company_id() and can_write('HR'));
create policy employee_advances_update on employee_advances for update
  using (company_id = auth_company_id() and can_write('HR'))
  with check (company_id = auth_company_id() and can_write('HR'));
create policy employee_advances_delete on employee_advances for delete
  using (company_id = auth_company_id() and can_approve('HR'));

-- ---- hse_incidents (OPERATIONS) ----
alter table hse_incidents enable row level security;
create policy hse_incidents_select on hse_incidents for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy hse_incidents_insert on hse_incidents for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy hse_incidents_update on hse_incidents for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy hse_incidents_delete on hse_incidents for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- hse_inspections (OPERATIONS) ----
alter table hse_inspections enable row level security;
create policy hse_inspections_select on hse_inspections for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy hse_inspections_insert on hse_inspections for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy hse_inspections_update on hse_inspections for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy hse_inspections_delete on hse_inspections for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- work_permits (OPERATIONS) ----
alter table work_permits enable row level security;
create policy work_permits_select on work_permits for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy work_permits_insert on work_permits for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy work_permits_update on work_permits for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy work_permits_delete on work_permits for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- nms_alarms (OPERATIONS) ----
alter table nms_alarms enable row level security;
create policy nms_alarms_select on nms_alarms for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy nms_alarms_insert on nms_alarms for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy nms_alarms_update on nms_alarms for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy nms_alarms_delete on nms_alarms for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- escalation_matrix (OPERATIONS) ----
alter table escalation_matrix enable row level security;
create policy escalation_matrix_select on escalation_matrix for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy escalation_matrix_insert on escalation_matrix for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy escalation_matrix_update on escalation_matrix for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy escalation_matrix_delete on escalation_matrix for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- sla_reports (OPERATIONS) ----
alter table sla_reports enable row level security;
create policy sla_reports_select on sla_reports for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy sla_reports_insert on sla_reports for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy sla_reports_update on sla_reports for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy sla_reports_delete on sla_reports for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- knowledge_articles (OPERATIONS) ----
alter table knowledge_articles enable row level security;
create policy knowledge_articles_select on knowledge_articles for select
  using (company_id = auth_company_id() and can_read('OPERATIONS'));
create policy knowledge_articles_insert on knowledge_articles for insert
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy knowledge_articles_update on knowledge_articles for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS'));
create policy knowledge_articles_delete on knowledge_articles for delete
  using (company_id = auth_company_id() and can_approve('OPERATIONS'));

-- ---- freelance_rate_cards (PAYROLL) ----
alter table freelance_rate_cards enable row level security;
create policy freelance_rate_cards_select on freelance_rate_cards for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
create policy freelance_rate_cards_insert on freelance_rate_cards for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy freelance_rate_cards_update on freelance_rate_cards for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy freelance_rate_cards_delete on freelance_rate_cards for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---- freelance_payouts (PAYROLL) ----
alter table freelance_payouts enable row level security;
create policy freelance_payouts_select on freelance_payouts for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
create policy freelance_payouts_insert on freelance_payouts for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy freelance_payouts_update on freelance_payouts for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy freelance_payouts_delete on freelance_payouts for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---- freelance_payout_lines (PAYROLL) ----
alter table freelance_payout_lines enable row level security;
create policy freelance_payout_lines_select on freelance_payout_lines for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
create policy freelance_payout_lines_insert on freelance_payout_lines for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy freelance_payout_lines_update on freelance_payout_lines for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy freelance_payout_lines_delete on freelance_payout_lines for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---- tax_brackets_art17 (PAYROLL) ----
alter table tax_brackets_art17 enable row level security;
create policy tax_brackets_art17_select on tax_brackets_art17 for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
create policy tax_brackets_art17_insert on tax_brackets_art17 for insert
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy tax_brackets_art17_update on tax_brackets_art17 for update
  using (company_id = auth_company_id() and can_write('PAYROLL'))
  with check (company_id = auth_company_id() and can_write('PAYROLL'));
create policy tax_brackets_art17_delete on tax_brackets_art17 for delete
  using (company_id = auth_company_id() and can_approve('PAYROLL'));

-- ---- opportunities (COMMERCE) ----
alter table opportunities enable row level security;
create policy opportunities_select on opportunities for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy opportunities_insert on opportunities for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy opportunities_update on opportunities for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy opportunities_delete on opportunities for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- opportunity_activities (COMMERCE) ----
alter table opportunity_activities enable row level security;
create policy opportunity_activities_select on opportunity_activities for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy opportunity_activities_insert on opportunity_activities for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy opportunity_activities_update on opportunity_activities for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy opportunity_activities_delete on opportunity_activities for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- customer_complaints (COMMERCE) ----
alter table customer_complaints enable row level security;
create policy customer_complaints_select on customer_complaints for select
  using (company_id = auth_company_id() and can_read('COMMERCE'));
create policy customer_complaints_insert on customer_complaints for insert
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy customer_complaints_update on customer_complaints for update
  using (company_id = auth_company_id() and can_write('COMMERCE'))
  with check (company_id = auth_company_id() and can_write('COMMERCE'));
create policy customer_complaints_delete on customer_complaints for delete
  using (company_id = auth_company_id() and can_approve('COMMERCE'));

-- ---- vendor_contracts (PROCUREMENT) ----
alter table vendor_contracts enable row level security;
create policy vendor_contracts_select on vendor_contracts for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy vendor_contracts_insert on vendor_contracts for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendor_contracts_update on vendor_contracts for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendor_contracts_delete on vendor_contracts for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- vendor_returns (PROCUREMENT) ----
alter table vendor_returns enable row level security;
create policy vendor_returns_select on vendor_returns for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy vendor_returns_insert on vendor_returns for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendor_returns_update on vendor_returns for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendor_returns_delete on vendor_returns for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- vendor_return_items (PROCUREMENT) ----
alter table vendor_return_items enable row level security;
create policy vendor_return_items_select on vendor_return_items for select
  using (company_id = auth_company_id() and can_read('PROCUREMENT'));
create policy vendor_return_items_insert on vendor_return_items for insert
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendor_return_items_update on vendor_return_items for update
  using (company_id = auth_company_id() and can_write('PROCUREMENT'))
  with check (company_id = auth_company_id() and can_write('PROCUREMENT'));
create policy vendor_return_items_delete on vendor_return_items for delete
  using (company_id = auth_company_id() and can_approve('PROCUREMENT'));

-- ---- chart_of_accounts (FINANCE) ----
alter table chart_of_accounts enable row level security;
create policy chart_of_accounts_select on chart_of_accounts for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy chart_of_accounts_insert on chart_of_accounts for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy chart_of_accounts_update on chart_of_accounts for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy chart_of_accounts_delete on chart_of_accounts for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- journal_entries (FINANCE) ----
alter table journal_entries enable row level security;
create policy journal_entries_select on journal_entries for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy journal_entries_insert on journal_entries for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy journal_entries_update on journal_entries for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy journal_entries_delete on journal_entries for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- journal_lines (FINANCE) ----
alter table journal_lines enable row level security;
create policy journal_lines_select on journal_lines for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy journal_lines_insert on journal_lines for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy journal_lines_update on journal_lines for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy journal_lines_delete on journal_lines for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- tax_records (FINANCE) ----
alter table tax_records enable row level security;
create policy tax_records_select on tax_records for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy tax_records_insert on tax_records for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy tax_records_update on tax_records for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy tax_records_delete on tax_records for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- petty_cash (FINANCE) ----
alter table petty_cash enable row level security;
create policy petty_cash_select on petty_cash for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy petty_cash_insert on petty_cash for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy petty_cash_update on petty_cash for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy petty_cash_delete on petty_cash for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- bank_accounts (FINANCE) ----
alter table bank_accounts enable row level security;
create policy bank_accounts_select on bank_accounts for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy bank_accounts_insert on bank_accounts for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy bank_accounts_update on bank_accounts for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy bank_accounts_delete on bank_accounts for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- bank_reconciliations (FINANCE) ----
alter table bank_reconciliations enable row level security;
create policy bank_reconciliations_select on bank_reconciliations for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy bank_reconciliations_insert on bank_reconciliations for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy bank_reconciliations_update on bank_reconciliations for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy bank_reconciliations_delete on bank_reconciliations for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- bank_statement_lines (FINANCE) ----
alter table bank_statement_lines enable row level security;
create policy bank_statement_lines_select on bank_statement_lines for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy bank_statement_lines_insert on bank_statement_lines for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy bank_statement_lines_update on bank_statement_lines for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy bank_statement_lines_delete on bank_statement_lines for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---- permits (DEPLOYMENT) ----
alter table permits enable row level security;
create policy permits_select on permits for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy permits_insert on permits for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy permits_update on permits for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy permits_delete on permits for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- punch_lists (DEPLOYMENT) ----
alter table punch_lists enable row level security;
create policy punch_lists_select on punch_lists for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy punch_lists_insert on punch_lists for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy punch_lists_update on punch_lists for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy punch_lists_delete on punch_lists for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- warranty_periods (DEPLOYMENT) ----
alter table warranty_periods enable row level security;
create policy warranty_periods_select on warranty_periods for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy warranty_periods_insert on warranty_periods for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy warranty_periods_update on warranty_periods for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy warranty_periods_delete on warranty_periods for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- subcontract_packages (DEPLOYMENT) ----
alter table subcontract_packages enable row level security;
create policy subcontract_packages_select on subcontract_packages for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy subcontract_packages_insert on subcontract_packages for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy subcontract_packages_update on subcontract_packages for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy subcontract_packages_delete on subcontract_packages for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- subcontract_progress (DEPLOYMENT) ----
alter table subcontract_progress enable row level security;
create policy subcontract_progress_select on subcontract_progress for select
  using (company_id = auth_company_id() and can_read('DEPLOYMENT'));
create policy subcontract_progress_insert on subcontract_progress for insert
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy subcontract_progress_update on subcontract_progress for update
  using (company_id = auth_company_id() and can_write('DEPLOYMENT'))
  with check (company_id = auth_company_id() and can_write('DEPLOYMENT'));
create policy subcontract_progress_delete on subcontract_progress for delete
  using (company_id = auth_company_id() and can_approve('DEPLOYMENT'));

-- ---- master_references (CORE) ----
alter table master_references enable row level security;
create policy master_references_select on master_references for select
  using (company_id = auth_company_id() and can_read('CORE'));
create policy master_references_insert on master_references for insert
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy master_references_update on master_references for update
  using (company_id = auth_company_id() and can_write('CORE'))
  with check (company_id = auth_company_id() and can_write('CORE'));
create policy master_references_delete on master_references for delete
  using (company_id = auth_company_id() and can_approve('CORE'));
