import React, { useCallback, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from 'expo-router'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import Lencana from '@/components/Lencana'
import KosongState from '@/components/KosongState'
import KesalahanState from '@/components/KesalahanState'
import { useAuth } from '@/lib/auth'
import supabase from '@/lib/supabase'
import { insert, update, uploadFile } from '@/lib/db'
import { ambilLokasi } from '@/lib/location'
import { durasi, jam, tgl, todayISO } from '@/lib/format'
import type { Attendance } from '@/types/db'

export default function AbsensiScreen() {
  const t = useTheme()
  const { profile, employee } = useAuth()
  const [hariIni, setHariIni] = useState<Attendance | null>(null)
  const [riwayat, setRiwayat] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [proses, setProses] = useState(false)
  const [error, setError] = useState('')

  const muat = useCallback(async () => {
    if (!employee?.id) {
      setLoading(false)
      return
    }
    setError('')
    try {
      const sejak = new Date()
      sejak.setDate(sejak.getDate() - 30)
      const { data, error: err } = await supabase
        .from('attendances')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('work_date', sejak.toISOString().slice(0, 10))
        .order('work_date', { ascending: false })
      if (err) throw err
      const rows = (data ?? []) as Attendance[]
      setRiwayat(rows)
      setHariIni(rows.find((r) => r.work_date === todayISO()) ?? null)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat riwayat absensi.')
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

  const ambilSwafoto = async (): Promise<string | null> => {
    const izin = await ImagePicker.requestCameraPermissionsAsync()
    if (izin.status !== 'granted') {
      setError('Izin kamera ditolak. Aktifkan izin kamera untuk swafoto absensi.')
      return null
    }
    const hasil = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 0.6,
      allowsEditing: false,
    })
    if (hasil.canceled || !hasil.assets?.length) return null
    return hasil.assets[0].uri
  }

  const absenMasuk = async () => {
    if (!employee || !profile) return
    setError('')
    setProses(true)
    try {
      const uri = await ambilSwafoto()
      if (!uri) {
        setProses(false)
        return
      }
      const lokasi = await ambilLokasi()
      const path = await uploadFile(profile.company_id, 'absensi', uri, 'masuk.jpg')
      const row = await insert<Attendance>('attendances', {
        company_id: profile.company_id,
        employee_id: employee.id,
        work_date: todayISO(),
        check_in_at: new Date().toISOString(),
        check_in_lat: lokasi.lat,
        check_in_lng: lokasi.lng,
        check_in_photo_url: path,
        status: 'hadir',
      })
      setHariIni(row)
      muat()
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menyimpan absen masuk.')
    } finally {
      setProses(false)
    }
  }

  const absenPulang = async () => {
    if (!hariIni || !profile) return
    setError('')
    setProses(true)
    try {
      const uri = await ambilSwafoto()
      if (!uri) {
        setProses(false)
        return
      }
      const lokasi = await ambilLokasi()
      const path = await uploadFile(profile.company_id, 'absensi', uri, 'pulang.jpg')
      const masuk = hariIni.check_in_at ? new Date(hariIni.check_in_at).getTime() : Date.now()
      const workMinutes = Math.max(0, Math.round((Date.now() - masuk) / 60000))
      const row = await update<Attendance>('attendances', hariIni.id, {
        check_out_at: new Date().toISOString(),
        check_out_lat: lokasi.lat,
        check_out_lng: lokasi.lng,
        check_out_photo_url: path,
        work_minutes: workMinutes,
      })
      setHariIni(row)
      muat()
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menyimpan absen pulang.')
    } finally {
      setProses(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted }}>Memuat...</Text>
      </View>
    )
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 14 }}>
          <Kartu>
            <Text style={[styles.judul, { color: t.text }]}>Absensi Hari Ini — {tgl(todayISO())}</Text>
            {error ? <Text style={{ color: t.bahaya, marginTop: 8, fontSize: 14 }}>{error}</Text> : null}
            <View style={{ marginTop: 12, gap: 10 }}>
              <BarisWaktu label="Absen Masuk" waktu={hariIni?.check_in_at} t={t} />
              <BarisWaktu label="Absen Pulang" waktu={hariIni?.check_out_at} t={t} />
            </View>
            <View style={{ marginTop: 14 }}>
              {!hariIni?.check_in_at ? (
                <Tombol label="Absen Masuk" onPress={absenMasuk} loading={proses} full />
              ) : !hariIni?.check_out_at ? (
                <Tombol label="Absen Pulang" onPress={absenPulang} loading={proses} full />
              ) : (
                <Lencana>Absensi Lengkap</Lencana>
              )}
            </View>
          </Kartu>
          <Text style={[styles.subJudul, { color: t.text }]}>Riwayat 30 Hari Terakhir</Text>
        </View>
      }
      data={riwayat}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        error ? <KesalahanState pesan={error} onCoba={muat} /> : <KosongState judul="Belum ada riwayat absensi" ikon="calendar-outline" />
      }
      renderItem={({ item }) => (
        <Kartu style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{tgl(item.work_date)}</Text>
            <Lencana>{item.status ?? (item.check_out_at ? 'selesai' : item.check_in_at ? 'berjalan' : 'draft')}</Lencana>
          </View>
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 8 }}>
            <View>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>Masuk</Text>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{jam(item.check_in_at)}</Text>
            </View>
            <View>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>Pulang</Text>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{jam(item.check_out_at)}</Text>
            </View>
            <View>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>Durasi</Text>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{durasi(item.work_minutes)}</Text>
            </View>
          </View>
        </Kartu>
      )}
    />
  )
}

function BarisWaktu({ label, waktu, t }: { label: string; waktu?: string | null; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: t.textMuted, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{jam(waktu)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  judul: { fontSize: 17, fontWeight: '800' },
  subJudul: { fontSize: 16, fontWeight: '700' },
})
