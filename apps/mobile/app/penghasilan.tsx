import React, { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Lencana from '@/components/Lencana'
import KosongState from '@/components/KosongState'
import KesalahanState from '@/components/KesalahanState'
import { useAuth } from '@/lib/auth'
import { list } from '@/lib/db'
import { num, periodCode, pctBulan, rupiah, tgl } from '@/lib/format'
import type { FreelancePayout, FreelancePayoutLine, ProductivityRow } from '@/types/db'

export default function Penghasilan() {
  const t = useTheme()
  const { employee } = useAuth()
  const skema = employee?.payroll_scheme ?? 'fix_salary'

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {skema === 'fix_salary' ? <PenghasilanFix /> : <PenghasilanFreelance />}
    </View>
  )
}

// ============================= SKEMA FIX SALARY =============================
function PenghasilanFix() {
  const t = useTheme()
  const { employee } = useAuth()
  const [produktivitas, setProduktivitas] = useState<ProductivityRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const muat = useCallback(async () => {
    if (!employee?.id) {
      setLoading(false)
      return
    }
    setError('')
    try {
      const rows = await list<ProductivityRow>('v_dashboard_productivity', { eq: { employee_id: employee.id, period_code: periodCode() } })
      setProduktivitas(rows[0] ?? null)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat data penghasilan.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [employee?.id])

  useFocusEffect(useCallback(() => { muat() }, [muat]))

  if (loading) {
    return (
      <View style={[styles.center]}>
        <ActivityIndicator color={t.primary} size="large" />
      </View>
    )
  }
  if (error) return <KesalahanState pesan={error} onCoba={muat} />

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
    >
      <Kartu style={{ gap: 4, backgroundColor: t.dark, borderColor: t.dark }}>
        <Text style={{ color: '#C9DEE0', fontSize: 13 }}>Skema Penggajian</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>Gaji Tetap (Fix Salary)</Text>
      </Kartu>

      <Kartu>
        <Text style={[styles.judul, { color: t.text }]}>Poin & Insentif Produktivitas — Bulan Berjalan</Text>
        {produktivitas ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Text style={{ color: t.textMuted, fontSize: 15 }}>
              {num(produktivitas.total_points)} dari target {num(produktivitas.target_points)} poin
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: t.border }]}>
              <View
                style={[styles.progressFill, { backgroundColor: t.primary, width: `${Math.min(100, produktivitas.achievement_percent ?? 0)}%` }]}
              />
            </View>
            <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{pctBulan(produktivitas.achievement_percent)} tercapai</Text>
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: t.textMuted, fontSize: 14 }}>Estimasi Insentif</Text>
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{rupiah(produktivitas.total_amount)}</Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: t.textMuted, marginTop: 8 }}>Belum ada data produktivitas bulan ini.</Text>
        )}
      </Kartu>

      <Kartu style={{ borderColor: t.peringatan }}>
        <Text style={{ color: t.peringatan, fontSize: 13 }}>
          Catatan: angka bulan berjalan masih bersifat sementara dan dapat berubah sampai diverifikasi oleh HR/Payroll.
        </Text>
      </Kartu>
      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

// ============================= SKEMA FREELANCE / CAMPURAN =============================
function PenghasilanFreelance() {
  const t = useTheme()
  const { employee } = useAuth()
  const [payouts, setPayouts] = useState<FreelancePayout[]>([])
  const [lines, setLines] = useState<FreelancePayoutLine[]>([])
  const [terpilih, setTerpilih] = useState<FreelancePayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [linesLoading, setLinesLoading] = useState(false)

  const muat = useCallback(async () => {
    if (!employee?.id) {
      setLoading(false)
      return
    }
    setError('')
    try {
      const rows = await list<FreelancePayout>('freelance_payouts', { eq: { employee_id: employee.id }, order: { col: 'period_code', asc: false }, limit: 24 })
      setPayouts(rows)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat data penghasilan.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [employee?.id])

  useFocusEffect(useCallback(() => { muat() }, [muat]))

  const pilihPeriode = async (p: FreelancePayout) => {
    setTerpilih(p)
    setLinesLoading(true)
    try {
      const rows = await list<FreelancePayoutLine>('freelance_payout_lines', { eq: { payout_id: p.id }, order: { col: 'work_date', asc: false } })
      setLines(rows)
    } catch {
      setLines([])
    } finally {
      setLinesLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.center]}>
        <ActivityIndicator color={t.primary} size="large" />
      </View>
    )
  }
  if (error) return <KesalahanState pesan={error} onCoba={muat} />

  const periodeBerjalan = periodCode()
  const adaPeriodeBerjalan = payouts.some((p) => p.period_code === periodeBerjalan && p.status !== 'dibayar')

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
      data={payouts}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Kartu style={{ gap: 4, backgroundColor: t.dark, borderColor: t.dark }}>
            <Text style={{ color: '#C9DEE0', fontSize: 13 }}>Skema Penggajian</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>Freelance / Campuran</Text>
          </Kartu>
          {adaPeriodeBerjalan ? (
            <Kartu style={{ borderColor: t.peringatan }}>
              <Text style={{ color: t.peringatan, fontSize: 13 }}>
                Angka periode berjalan ({periodeBerjalan}) masih bersifat sementara sampai diverifikasi dan dibayarkan.
              </Text>
            </Kartu>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <KosongState judul="Belum ada data penghasilan" pesan="Riwayat pembayaran freelance akan tampil di sini." ikon="cash-outline" />
      }
      renderItem={({ item }) => {
        const aktif = terpilih?.id === item.id
        return (
          <View>
            <Pressable onPress={() => pilihPeriode(item)}>
              <Kartu style={{ gap: 6, borderColor: aktif ? t.primary : t.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{item.period_code}</Text>
                  <Lencana>{item.status}</Lencana>
                </View>
                <Text style={{ color: t.textMuted, fontSize: 13 }}>{item.payout_no}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Baris t={t} label="Bruto" value={rupiah(item.gross_amount)} />
                  <Baris t={t} label="Pajak" value={rupiah(item.tax_amount)} />
                </View>
                <View style={[styles.divider, { backgroundColor: t.border }]} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: t.text, fontWeight: '700' }}>Netto</Text>
                  <Text style={{ color: t.sukses, fontWeight: '800', fontSize: 16 }}>{rupiah(item.net_amount)}</Text>
                </View>
              </Kartu>
            </Pressable>
            {aktif ? (
              <Kartu style={{ marginTop: -6, borderTopLeftRadius: 0, borderTopRightRadius: 0, gap: 8 }}>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>Rincian Pekerjaan</Text>
                {linesLoading ? (
                  <ActivityIndicator color={t.primary} />
                ) : lines.length === 0 ? (
                  <Text style={{ color: t.textMuted, fontSize: 14 }}>Tidak ada rincian untuk periode ini.</Text>
                ) : (
                  lines.map((l) => (
                    <View key={l.id} style={[styles.baris2, { borderColor: t.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{l.description ?? 'Pekerjaan'}</Text>
                        <Text style={{ color: t.textMuted, fontSize: 12 }}>{tgl(l.work_date)} · {num(l.qty)} x {rupiah(l.rate)}</Text>
                      </View>
                      <Text style={{ color: t.text, fontWeight: '700' }}>{rupiah(l.amount)}</Text>
                    </View>
                  ))
                )}
              </Kartu>
            ) : null}
          </View>
        )
      }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListFooterComponent={<View style={{ height: 24 }} />}
    />
  )
}

function Baris({ t, label, value }: { t: ReturnType<typeof useTheme>; label: string; value: string }) {
  return (
    <View>
      <Text style={{ color: t.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  judul: { fontSize: 16, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999 },
  divider: { height: 1, marginVertical: 4 },
  baris2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: RADIUS, padding: 10 },
})
