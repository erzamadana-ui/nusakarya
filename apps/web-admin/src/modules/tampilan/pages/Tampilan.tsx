import React, { useEffect, useState } from 'react'
import { Check, Sun, Moon, Monitor, TrendingUp, Users2, RotateCcw } from 'lucide-react'
import { PageHeader, SectionCard, KpiCard, Badge, Button, Input, cx } from '@/components/ui'
import { THEMES, getTheme, setTheme, getMode, setMode, type ThemeName } from '@/lib/theme'

/** Preferensi mode disimpan terpisah dari theme.ts agar pilihan "Ikut Sistem" bisa diingat
 *  tanpa mengubah logika getMode/setMode yang sudah ada (yang hanya mengenal terang/gelap). */
const MODE_PREF_KEY = 'nk-mode-pref'
type ModePref = 'light' | 'dark' | 'system'

function getModePref(): ModePref {
  try {
    const v = localStorage.getItem(MODE_PREF_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return getMode()
}
function systemPrefersDark(): boolean {
  try { return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false } catch { return false }
}

const MODE_OPTIONS: { value: ModePref; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Terang', icon: <Sun size={18} /> },
  { value: 'dark', label: 'Gelap', icon: <Moon size={18} /> },
  { value: 'system', label: 'Ikut Sistem', icon: <Monitor size={18} /> },
]

export default function Tampilan() {
  const [theme, setThemeState] = useState<ThemeName>(getTheme())
  const [modePref, setModePref] = useState<ModePref>(getModePref())

  // Terapkan mode setiap kali preferensi berubah.
  useEffect(() => {
    try { localStorage.setItem(MODE_PREF_KEY, modePref) } catch {}
    setMode(modePref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : modePref)
  }, [modePref])

  // Saat "Ikut Sistem" aktif, ikuti perubahan preferensi OS secara langsung selagi halaman ini terbuka.
  useEffect(() => {
    if (modePref !== 'system' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setMode(mq.matches ? 'dark' : 'light')
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [modePref])

  const applyTheme = (t: ThemeName) => { setTheme(t); setThemeState(t) }

  return (
    <div>
      <PageHeader
        title="Tampilan & Template"
        subtitle="Pilih template visual dan mode tampilan aplikasi. Pratinjau di bawah memperlihatkan efeknya secara langsung."
        breadcrumb={['Pengaturan']}
      />

      <SectionCard title="Template" subtitle="Klik salah satu kartu untuk langsung menerapkan template." className="mb-5">
        <div className="grid sm:grid-cols-2 gap-4">
          {THEMES.map(t => {
            const active = theme === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => applyTheme(t.value)}
                className={cx(
                  'relative text-left p-4 rounded-md border-2 transition-colors',
                  active ? 'border-primary-500 bg-primary-50/50' : 'border-ink-200 bg-surface hover:border-primary-200',
                )}
              >
                {active && (
                  <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary-500 text-white grid place-items-center shrink-0">
                    <Check size={14} />
                  </span>
                )}
                <div className="flex items-center gap-1.5 mb-3">
                  {t.swatch.map((c, i) => (
                    <span key={i} className="w-7 h-7 rounded-full border border-ink-200 shrink-0" style={{ background: c }} />
                  ))}
                </div>
                <div className="font-display font-bold text-[15px] text-ink-900 pr-6">{t.label}</div>
                <p className="mt-1 text-caption text-ink-500 leading-snug pr-6">{t.description}</p>
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard title="Mode" subtitle="Terang, gelap, atau mengikuti pengaturan sistem perangkat Anda." className="mb-5">
        <div className="grid sm:grid-cols-3 gap-4">
          {MODE_OPTIONS.map(m => {
            const active = modePref === m.value
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setModePref(m.value)}
                className={cx(
                  'flex items-center gap-3 p-4 rounded-md border-2 transition-colors',
                  active ? 'border-primary-500 bg-primary-50/50' : 'border-ink-200 bg-surface hover:border-primary-200',
                )}
              >
                <span className={cx('w-10 h-10 rounded-full grid place-items-center shrink-0', active ? 'bg-primary-500 text-white' : 'bg-ink-100 text-ink-500')}>
                  {m.icon}
                </span>
                <span className="font-semibold text-body text-ink-800">{m.label}</span>
                {active && <Check size={16} className="ml-auto text-primary-600 shrink-0" />}
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard title="Pratinjau" subtitle="Contoh komponen dengan template dan mode yang sedang aktif.">
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          <KpiCard highlight label="Total Pesanan" value="3.482" trend={3.6} sub="vs minggu lalu" icon={<TrendingUp size={16} />} />
          <KpiCard label="Pesanan Selesai" value="2.914" trend={1.1} sub="vs minggu lalu" icon={<Check size={16} />} />
          <KpiCard label="Pelanggan Aktif" value="1.208" trend={-0.6} sub="vs minggu lalu" icon={<Users2 size={16} />} />
        </div>

        <div className="border border-ink-200 rounded-md overflow-hidden mb-5">
          <table className="w-full text-body">
            <thead className="bg-ink-50">
              <tr>
                <th className="text-left px-3 h-11 text-caption font-semibold uppercase tracking-wide text-ink-500 border-b border-ink-200">Pesanan</th>
                <th className="text-left px-3 h-11 text-caption font-semibold uppercase tracking-wide text-ink-500 border-b border-ink-200">Pembayaran</th>
                <th className="text-left px-3 h-11 text-caption font-semibold uppercase tracking-wide text-ink-500 border-b border-ink-200">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-ink-100">
                <td className="px-3 py-4 text-ink-700">INV-203584</td>
                <td className="px-3 py-4"><Badge solid>Paid</Badge></td>
                <td className="px-3 py-4"><Badge>Completed</Badge></td>
              </tr>
              <tr className="border-b border-ink-100">
                <td className="px-3 py-4 text-ink-700">INV-203585</td>
                <td className="px-3 py-4"><Badge solid>Unpaid</Badge></td>
                <td className="px-3 py-4"><Badge>Shipped</Badge></td>
              </tr>
              <tr>
                <td className="px-3 py-4 text-ink-700">INV-203586</td>
                <td className="px-3 py-4"><Badge solid>Paid</Badge></td>
                <td className="px-3 py-4"><Badge>Canceled</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<RotateCcw size={15} />}>Simpan Perubahan</Button>
          <Button variant="outline">Batal</Button>
          <div className="w-full sm:w-56"><Input placeholder="Contoh input teks…" /></div>
        </div>
      </SectionCard>

      <p className="mt-4 text-caption text-ink-400">
        Pilihan template dan mode di atas tersimpan di peramban masing-masing pengguna — tidak memengaruhi tampilan pengguna lain.
      </p>
    </div>
  )
}
