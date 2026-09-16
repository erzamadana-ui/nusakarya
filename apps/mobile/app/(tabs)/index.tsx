import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import KesalahanState from '@/components/KesalahanState'
import { useAuth } from '@/lib/auth'
import supabase from '@/lib/supabase'
import { num, periodCode, sisaWaktu, todayISO, tgl } from '@/lib/format'
import type { Attendance } from '@/types/db'

type Ringkasan = {
  woHariIni: number
  woSelesai: number
  poinHariIni: number
  poinBulanIni: number
  targetBulanIni: number
  tiketMendekatiSla: number
}

export default function Beranda() {
  const t = useTheme()
  const router = useRouter()
  const { profile, employee } = useAuth()
  const [absensi, setAbsensi] = useState<Attendance | null>(null)
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null)
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
      const today = todayISO()
      const [absRes, woHariIniRes, woSelesaiRes, woPoinRes, prodRes, tiketRes] = await Promise.all([
        supabase.from('attendances').select('*').eq('employee_id', employee.id).eq('work_date', today).maybeSingle(),
        supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('assigned_to', employee.id).gte('scheduled_at', `${today}T00:00:00`).lte('scheduled_at', `${today}T23:59:59`),
        supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('assigned_to', employee.id).eq('status', 'selesai').gte('finished_at', `${today}T00:00:00`).lte('finished_at', `${today}T23:59:59`),
        supabase.from('work_orders').select('points,finished_at').eq('assigned_to', employee.id).eq('status', 'selesai').gte('finished_at', `${today}T00:00:00`).lte('finished_at', `${today}T23:59:59`),
        supabase.from('v_dashboard_productivity').select('total_points,target_points').eq('employee_id', employee.id).eq('period_code', periodCode()).maybeSingle(),
        supabase.from('tickets').select('id,sla_due_at,status').eq('assigned_to', employee.id).not('status', 'in', '(closed,selesai,resolved)'),
      ])

      if (absRes.error) throw absRes.error
      setAbsensi((absRes.data as Attendance) ?? null)

      const poinHariIni = (woPoinRes.data ?? []).reduce((s: number, r: any) => s + Number(r.points ?? 0), 0)
      const mendekat = (tiketRes.data ?? []).filter((r: any) => {
        if (!r.sla_due_at) return false
        const sisaMin = (new Date(r.sla_due_at).getTime() - Date.now()) / 60000
        return sisaMin <= 120
      }).length

      setRingkasan({
        woHariIni: woHariIniRes.count ?? 0,
        woSelesai: woSelesaiRes.count ?? 0,
        poinHariIni,
        poinBulanIni: Number((prodRes.data as any)?.total_points ?? 0),
        targetBulanIni: Number((prodRes.data as any)?.target_points ?? 0),
        tiketMendekatiSla: mendekat,
      })
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat data beranda.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [employee?.id])

  useFocusEffect(
    useCallback(() => {
      muat()
    }, [muat])
  )

  const onRefresh = () => {
    setRefreshing(true)
    muat()
  }

  const jamSapaan = () => {
    const h = new Date().getHours()
    if (h < 11) return 'Selamat pagi'
    if (h < 15) return 'Selamat siang'
    if (h < 18) return 'Selamat sore'
    return 'Selamat malam'
  }

  const statusAbsensi = () => {
    if (!absensi?.check_in_at) return { label: 'Belum Absen Masuk', tombol: 'Absen Masuk' }
    if (!absensi?.check_out_at) return { label: 'Sudah Absen Masuk', tombol: 'Absen Pulang' }
    return { label: 'Absensi Hari Ini Lengkap', tombol: 'Lihat Riwayat' }
  }
  const st = statusAbsensi()

  if (error && !ringkasan) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        <View style={{ backgroundColor: t.dark, paddingTop: 12, paddingBottom: 28, paddingHorizontal: 18 }}>
          <Text style={styles.sapaan}>{jamSapaan()},</Text>
          <Text style={styles.nama}>{profile?.full_name ?? '-'}</Text>
        </View>
        <KesalahanState pesan={error} onCoba={muat} />
      </ScrollView>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
    >
      <View style={{ backgroundColor: t.dark, paddingTop: 12, paddingBottom: 28, paddingHorizontal: 18 }}>
        <Text style={styles.sapaan}>{jamSapaan()},</Text>
        <Text style={styles.nama}>{profile?.full_name ?? '-'}</Text>
        <Text style={[styles.tanggal, { color: t.aksen }]}>{tgl(todayISO())}</Text>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: -18, gap: 14 }}>
        <Kartu>
          <Text style={[styles.kartuJudul, { color: t.text }]}>Absensi Hari Ini</Text>
          <Text style={{ color: t.textMuted, marginTop: 2, marginBottom: 12, fontSize: 15 }}>{st.label}</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: absensi?.check_in_at ? 12 : 0 }}>
            {absensi?.check_in_at ? (
              <View>
                <Text style={{ color: t.textMuted, fontSize: 13 }}>Masuk</Text>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>
                  {new Date(absensi.check_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ) : null}
            {absensi?.check_out_at ? (
              <View>
                <Text style={{ color: t.textMuted, fontSize: 13 }}>Pulang</Text>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>
                  {new Date(absensi.check_out_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ) : null}
          </View>
          <Tombol label={st.tombol} onPress={() => router.push('/absensi')} full />
        </Kartu>

        <View style={styles.gridKpi}>
          <KpiKecil warna={t.primary} label="WO Hari Ini" nilai={num(ringkasan?.woHariIni ?? 0)} />
          <KpiKecil warna={t.sukses} label="WO Selesai" nilai={num(ringkasan?.woSelesai ?? 0)} />
          <KpiKecil warna={t.aksen} label="Poin Hari Ini" nilai={num(ringkasan?.poinHariIni ?? 0)} />
          <KpiKecil warna={t.info} label="Poin Bulan Ini" nilai={num(ringkasan?.poinBulanIni ?? 0)} />
        </View>

        {ringkasan?.targetBulanIni ? (
          <Kartu>
            <Text style={[styles.kartuJudul, { color: t.text }]}>Target Bulan Ini</Text>
            <Text style={{ color: t.textMuted, marginTop: 4, fontSize: 15 }}>
              {num(ringkasan.poinBulanIni)} dari target {num(ringkasan.targetBulanIni)} poin
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: t.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: t.primary,
                    width: `${Math.min(100, (ringkasan.poinBulanIni / Math.max(1, ringkasan.targetBulanIni)) * 100)}%`,
                  },
                ]}
              />
            </View>
          </Kartu>
        ) : null}

        {ringkasan && ringkasan.tiketMendekatiSla > 0 ? (
          <Kartu style={{ borderColor: t.bahaya, backgroundColor: t.card }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kartuJudul, { color: t.bahaya }]}>Tiket Mendekati Batas SLA</Text>
                <Text style={{ color: t.textMuted, marginTop: 2, fontSize: 15 }}>
                  {ringkasan.tiketMendekatiSla} tiket perlu segera ditindaklanjuti
                </Text>
              </View>
              <Tombol label="Lihat" onPress={() => router.push('/(tabs)/tiket')} varian="bahaya" />
            </View>
          </Kartu>
        ) : null}
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

function KpiKecil({ label, nilai, warna }: { label: string; nilai: string; warna: string }) {
  const t = useTheme()
  return (
    <View style={[styles.kpiBox, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.kpiDot, { backgroundColor: warna }]} />
      <Text style={[styles.kpiNilai, { color: t.text }]}>{nilai}</Text>
      <Text style={[styles.kpiLabel, { color: t.textMuted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  sapaan: { color: '#C9DEE0', fontSize: 15 },
  nama: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  tanggal: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  kartuJudul: { fontSize: 16, fontWeight: '700' },
  gridKpi: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiBox: { width: '47%', borderWidth: 1, borderRadius: RADIUS, padding: 14 },
  kpiDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 8 },
  kpiNilai: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 13, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999 },
})
