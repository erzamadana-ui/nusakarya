-- =====================================================================
-- 0027_link_mitra_employee.sql
-- Ditemukan lewat QA tahap-2 (kebijakan ber-cakupan diri, 0025): akun
-- mitra@nusakarya.id tidak pernah ditautkan ke baris `employees` mana pun
-- (profiles.employee_id = NULL, employees.user_id = NULL untuk seluruh
-- baris MITRA). Akibatnya auth_employee_id() selalu NULL untuk akun ini,
-- sehingga SELURUH kebijakan ber-cakupan diri di 0025 (freelance_payouts,
-- freelance_payout_lines, punch_lists, dst.) tidak pernah cocok — mitra@
-- selalu melihat 0 baris, walau modul PAYROLL memang sengaja can_read=false
-- untuknya (aksesnya HARUS lewat self-scope, bukan lewat modul). Ini
-- persis pola "Temuan B" pada LAPORAN-QA-RLS.md (teknisi@ dulu juga tidak
-- ditautkan), sekarang terulang untuk peran mitra pada modul tahap-2.
--
-- Perbaikan: tautkan mitra@nusakarya.id ke baris employees "Sari Fauzi"
-- (NIP MITRA, unit OPERATIONS) yang punya data freelance_payouts (6 baris)
-- untuk pengujian isolasi diri yang representatif.
-- =====================================================================

update employees
set user_id = '01eab06f-6dae-44da-8884-70609b47049f'
where id = '7c95209a-255a-4c38-9278-c0f1970d3fe2';

update profiles
set employee_id = '7c95209a-255a-4c38-9278-c0f1970d3fe2'
where id = '01eab06f-6dae-44da-8884-70609b47049f';
