/**
 * Kalkulasi upah lembur mengacu pada PP 35/2021 Pasal 31 (turunan UU Cipta Kerja):
 * - Upah sejam = gaji pokok bulanan ÷ 173.
 * - Hari kerja: jam ke-1 × 1,5 upah sejam; jam berikutnya × 2 upah sejam.
 * - Hari libur mingguan/resmi: jam ke-1 s.d. 8 × 2; jam ke-9 × 3; jam ke-10 s.d. 12 × 4.
 * WAJIB DIVERIFIKASI HR sebelum dibayarkan — angka ini adalah estimasi sistem.
 */

export type OvertimeLine = { jam: number; pengali: number; upah: number }
export type OvertimeCalc = { hourlyWage: number; restDay: boolean; lines: OvertimeLine[]; total: number }

/** Sabtu (6) & Minggu (0) diperlakukan sebagai hari libur untuk perhitungan lembur. */
export function isRestDay(workDate?: string | null): boolean {
  if (!workDate) return false
  const d = new Date(workDate + 'T00:00:00')
  if (isNaN(d.getTime())) return false
  const day = d.getDay()
  return day === 0 || day === 6
}

function multiplierAt(jamKe: number, restDay: boolean): number {
  if (!restDay) return jamKe === 1 ? 1.5 : 2
  if (jamKe <= 8) return 2
  if (jamKe === 9) return 3
  return 4
}

export function calcOvertimeAmount(basicSalary: number, hours: number, restDay: boolean): OvertimeCalc {
  const hourlyWage = basicSalary > 0 ? basicSalary / 173 : 0
  const lines: OvertimeLine[] = []
  let remaining = Math.max(0, Number(hours) || 0)
  let jamKe = 1
  while (remaining > 1e-9 && jamKe <= 12) {
    const segment = Math.min(1, remaining)
    const pengali = multiplierAt(jamKe, restDay)
    lines.push({ jam: jamKe, pengali, upah: hourlyWage * pengali * segment })
    remaining -= segment
    jamKe++
  }
  const total = lines.reduce((s, l) => s + l.upah, 0)
  return { hourlyWage, restDay, lines, total }
}

/** Rentang Senin s.d. Minggu yang memuat tanggal terkait — untuk validasi batas 18 jam/minggu. */
export function weekRange(dateStr: string): [string, string] {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d); monday.setDate(d.getDate() + diffToMonday)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  return [iso(monday), iso(sunday)]
}

/** Selisih jam desimal antara dua waktu HH:mm pada tanggal yang sama (mendukung lintas tengah malam). */
export function hoursBetween(startHM: string, endHM: string): number {
  if (!startHM || !endHM) return 0
  const [sh, sm] = startHM.split(':').map(Number)
  const [eh, em] = endHM.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return Math.round((mins / 60) * 100) / 100
}
