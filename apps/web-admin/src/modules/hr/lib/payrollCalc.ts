import { SYSTEM_EARNING_CODES, SYSTEM_DEDUCTION_CODES } from './constants'

export type BpjsConfig = {
  jht_company: number; jht_employee: number
  jkk: number; jkm: number
  jp_company: number; jp_employee: number; jp_cap: number
  kes_company: number; kes_employee: number; kes_cap: number
  is_verified?: boolean
}

/**
 * Pilih baris bpjs_config yang BERLAKU pada tanggal periode payroll: baris dengan
 * effective_date terbesar yang <= tanggal acuan. bpjs_config bisa punya beberapa
 * baris riwayat per company_id (lihat halaman Setelan BPJS & Pajak) — jangan
 * asumsikan baris pertama/terbaru selalu yang berlaku untuk periode yang sedang
 * dihitung (mis. saat menghitung ulang payroll periode lampau).
 */
export function pickEffectiveBpjsConfig<T extends { effective_date: string }>(rows: T[], asOfDate: string): T | null {
  const eligible = rows.filter(r => r.effective_date && r.effective_date <= asOfDate)
  if (!eligible.length) return null
  return eligible.reduce((a, b) => (b.effective_date > a.effective_date ? b : a))
}
export type TerRate = { category: string; min_income: number; max_income: number | null; rate: number }
export type SalaryLine = {
  component_id: string; amount: number
  component: { code: string; name: string; component_type: 'earning' | 'deduction'; calc_type: string; taxable: boolean; is_bpjs_base: boolean }
}

const round = (n: number) => Math.round(n || 0)

/**
 * Mesin hitung payroll sisi klien.
 * Catatan/asumsi implementasi (karena tidak ada kolom tarif lembur per jam di skema):
 * - Komponen "LEMBUR" pada employee_salaries diperlakukan sebagai TARIF PER JAM lembur,
 *   dikalikan total jam lembur (attendances.overtime_minutes) pada periode berjalan.
 * - Komponen "INSENTIF_PROD" tidak dijumlah dari employee_salaries; nilainya diambil dari
 *   total productivity_entries berstatus 'diverifikasi' pada periode berjalan.
 * - PPh21 memakai skema TER: tarif dicari dari ter_rates sesuai ter_category karyawan pada
 *   bracket min_income..max_income yang memuat nilai bruto, lalu PPh21 = tarif × bruto.
 * - Dasar BPJS = jumlah komponen earning yang ditandai is_bpjs_base; bila tidak ada yang
 *   ditandai, dasar BPJS memakai bruto. Cap hanya berlaku untuk JP (jp_cap) dan Kesehatan (kes_cap).
 */
export function calcPayrollForEmployee(opts: {
  terCategory: string | null
  salaryLines: SalaryLine[]
  overtimeMinutes: number
  productivityAmount: number
  bpjs: BpjsConfig
  terRates: TerRate[]
}) {
  const { terCategory, salaryLines, overtimeMinutes, productivityAmount, bpjs, terRates } = opts

  let earningSum = 0, taxableEarningSum = 0, bpjsBaseAmt = 0, otherDeduction = 0, lemburRate = 0
  const lines: { component_id: string | null; component_name: string; component_type: 'earning' | 'deduction'; amount: number }[] = []

  for (const l of salaryLines) {
    const c = l.component
    if (!c) continue
    if (c.code === 'LEMBUR') { lemburRate = Number(l.amount) || 0; continue }
    if (c.code === 'INSENTIF_PROD') continue
    if (c.component_type === 'earning') {
      earningSum += Number(l.amount) || 0
      if (c.taxable) taxableEarningSum += Number(l.amount) || 0
      if (c.is_bpjs_base) bpjsBaseAmt += Number(l.amount) || 0
      lines.push({ component_id: l.component_id, component_name: c.name, component_type: 'earning', amount: Number(l.amount) || 0 })
    } else if (c.component_type === 'deduction') {
      if (SYSTEM_DEDUCTION_CODES.includes(c.code)) continue
      otherDeduction += Number(l.amount) || 0
      lines.push({ component_id: l.component_id, component_name: c.name, component_type: 'deduction', amount: Number(l.amount) || 0 })
    }
  }

  const overtimeAmount = round((overtimeMinutes / 60) * lemburRate)
  if (overtimeAmount > 0) lines.push({ component_id: null, component_name: 'Lembur', component_type: 'earning', amount: overtimeAmount })
  if (productivityAmount > 0) lines.push({ component_id: null, component_name: 'Insentif Produktivitas', component_type: 'earning', amount: round(productivityAmount) })

  const gross = round(earningSum + overtimeAmount + productivityAmount)
  const taxableGross = round(taxableEarningSum + overtimeAmount + productivityAmount)
  const bpjsBase = bpjsBaseAmt > 0 ? bpjsBaseAmt : gross
  const jpBase = Math.min(bpjsBase, bpjs.jp_cap || Infinity)
  const kesBase = Math.min(bpjsBase, bpjs.kes_cap || Infinity)

  const bpjs_jht_company = round(bpjsBase * (bpjs.jht_company || 0))
  const bpjs_jht_employee = round(bpjsBase * (bpjs.jht_employee || 0))
  const bpjs_jkk = round(bpjsBase * (bpjs.jkk || 0))
  const bpjs_jkm = round(bpjsBase * (bpjs.jkm || 0))
  const bpjs_jp_company = round(jpBase * (bpjs.jp_company || 0))
  const bpjs_jp_employee = round(jpBase * (bpjs.jp_employee || 0))
  const bpjs_kes_company = round(kesBase * (bpjs.kes_company || 0))
  const bpjs_kes_employee = round(kesBase * (bpjs.kes_employee || 0))

  const bracket = terRates.find(r => r.category === terCategory && gross >= Number(r.min_income) && gross <= Number(r.max_income ?? Infinity))
  const pph21_amount = bracket ? round(gross * Number(bracket.rate)) : 0

  const bpjsEmployeeTotal = bpjs_jht_employee + bpjs_jp_employee + bpjs_kes_employee
  if (bpjsEmployeeTotal > 0) lines.push({ component_id: null, component_name: 'Potongan BPJS (Pekerja)', component_type: 'deduction', amount: bpjsEmployeeTotal })
  if (pph21_amount > 0) lines.push({ component_id: null, component_name: 'PPh 21 (TER)', component_type: 'deduction', amount: pph21_amount })

  const net_pay = round(gross - bpjsEmployeeTotal - pph21_amount - otherDeduction)

  return {
    gross, taxable_gross: taxableGross,
    bpjs_jht_company, bpjs_jht_employee, bpjs_jkk, bpjs_jkm,
    bpjs_jp_company, bpjs_jp_employee, bpjs_kes_company, bpjs_kes_employee,
    overtime_amount: overtimeAmount, productivity_amount: round(productivityAmount),
    pph21_amount, other_deduction: round(otherDeduction), net_pay,
    lines,
  }
}
