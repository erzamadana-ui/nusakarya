/** Kueri bersama untuk modul Eksekutif (Ringkasan Perusahaan & Portal Eksekutif). */
import supabase from '@/lib/supabase'
import { periodCode } from '@/lib/format'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function last12Months() {
  const now = new Date()
  const out: { code: string; label: string; date: Date }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ code: periodCode(d), label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, date: d })
  }
  return out
}

export type MonthlyFinance = { periode: string; pendapatan: number; biaya: number; margin: number }

/** Pendapatan (ar_invoices.dpp) vs biaya (job_costs.amount) per bulan, 12 bulan terakhir. */
export async function fetchMonthlyFinance(): Promise<MonthlyFinance[]> {
  const months = last12Months()
  const from = months[0].date.toISOString().slice(0, 10)
  const [{ data: inv, error: e1 }, { data: costs, error: e2 }] = await Promise.all([
    supabase.from('ar_invoices').select('invoice_date, dpp').gte('invoice_date', from),
    supabase.from('job_costs').select('cost_date, amount').gte('cost_date', from),
  ])
  if (e1) throw e1
  if (e2) throw e2
  const rev: Record<string, number> = {}
  const cost: Record<string, number> = {}
  ;(inv ?? []).forEach((r: any) => { const k = String(r.invoice_date).slice(0, 7); rev[k] = (rev[k] ?? 0) + Number(r.dpp ?? 0) })
  ;(costs ?? []).forEach((r: any) => { const k = String(r.cost_date).slice(0, 7); cost[k] = (cost[k] ?? 0) + Number(r.amount ?? 0) })
  return months.map(m => {
    const pendapatan = rev[m.code] ?? 0
    const biaya = cost[m.code] ?? 0
    return { periode: m.label, pendapatan, biaya, margin: pendapatan - biaya }
  })
}

export type TicketRow = { status: string | null; sla_status: string | null; reported_at: string; ttr_minutes: number | null }

export async function fetchTicketRows(): Promise<TicketRow[]> {
  const { data, error } = await supabase.from('tickets').select('status, sla_status, reported_at, ttr_minutes')
  if (error) throw error
  return (data ?? []) as TicketRow[]
}

export type PendingItem = { id: string; type: string; title: string; date: string; path: string }

/** Dokumen menunggu persetujuan yang relevan dengan hak approve pengguna saat ini. */
export async function fetchPendingApprovals(can: (m: string, lvl?: 'read' | 'write' | 'approve') => boolean): Promise<PendingItem[]> {
  const tasks: Promise<PendingItem[]>[] = []

  if (can('PROCUREMENT', 'approve')) {
    tasks.push(
      supabase.from('purchase_requests').select('id, pr_no, request_date, purpose')
        .eq('status', 'diajukan').order('request_date', { ascending: false }).limit(5)
        .then(({ data }) => (data ?? []).map((r: any) => ({
          id: r.id, type: 'Purchase Request', title: `${r.pr_no}${r.purpose ? ' — ' + r.purpose : ''}`,
          date: r.request_date, path: '/procurement/pr',
        }))))
  }
  if (can('COMMERCE', 'approve')) {
    tasks.push(
      supabase.from('progress_claims').select('id, claim_no, created_at')
        .eq('status', 'diajukan').order('created_at', { ascending: false }).limit(5)
        .then(({ data }) => (data ?? []).map((r: any) => ({
          id: r.id, type: 'Klaim Progres', title: r.claim_no, date: r.created_at, path: '/commerce/klaim',
        }))))
  }
  if (can('HR', 'approve')) {
    tasks.push(
      supabase.from('leave_requests').select('id, leave_type, start_date, employees(full_name)')
        .eq('status', 'diajukan').order('start_date', { ascending: false }).limit(5)
        .then(({ data }) => (data ?? []).map((r: any) => ({
          id: r.id, type: 'Cuti & Izin', title: `${r.employees?.full_name ?? 'Karyawan'} — ${r.leave_type ?? ''}`,
          date: r.start_date, path: '/hr/cuti',
        }))))
  }
  if (can('PROCUREMENT', 'approve')) {
    tasks.push(
      supabase.from('vendor_invoices').select('id, inv_no, invoice_date, vendors(name)')
        .eq('status', 'diajukan').order('invoice_date', { ascending: false }).limit(5)
        .then(({ data }) => (data ?? []).map((r: any) => ({
          id: r.id, type: 'Invoice Vendor', title: `${r.inv_no}${r.vendors?.name ? ' — ' + r.vendors.name : ''}`,
          date: r.invoice_date, path: '/procurement/invoice-vendor',
        }))))
  }
  if (can('DEPLOYMENT', 'approve')) {
    tasks.push(
      supabase.from('rfs_records').select('id, rfs_no, rfs_date, projects(project_name)')
        .eq('status', 'diajukan').order('rfs_date', { ascending: false }).limit(5)
        .then(({ data }) => (data ?? []).map((r: any) => ({
          id: r.id, type: 'RFS', title: `${r.rfs_no}${r.projects?.project_name ? ' — ' + r.projects.project_name : ''}`,
          date: r.rfs_date, path: '/deploy/rfs',
        }))))
  }

  const results = await Promise.all(tasks)
  return results.flat().sort((a, b) => (a.date < b.date ? 1 : -1))
}
