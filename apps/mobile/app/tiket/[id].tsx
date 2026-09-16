import React, { useCallback, useState } from 'react'
import { ActivityIndicator, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import Lencana from '@/components/Lencana'
import Ladang from '@/components/Ladang'
import KesalahanState from '@/components/KesalahanState'
import { useAuth } from '@/lib/auth'
import { getOne, insert, list, signedUrl, uploadFile } from '@/lib/db'
import { ambilLokasi, bukaGoogleMaps } from '@/lib/location'
import { sisaWaktu, tglJam } from '@/lib/format'
import type { Ticket, TicketActivity } from '@/types/db'

const JENIS_AKTIVITAS = ['kunjungan', 'progress', 'eskalasi', 'selesai']

export default function DetailTiket() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useTheme()
  const { profile } = useAuth()

  const [tiket, setTiket] = useState<Ticket | null>(null)
  const [aktivitas, setAktivitas] = useState<TicketActivity[]>([])
  const [fotoUrl, setFotoUrl] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [jenis, setJenis] = useState(JENIS_AKTIVITAS[0])
  const [catatan, setCatatan] = useState('')
  const [fotoUri, setFotoUri] = useState<string | null>(null)
  const [kirimProses, setKirimProses] = useState(false)

  const muat = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      const [tk, ak] = await Promise.all([
        getOne<Ticket>('tickets', id),
        list<TicketActivity>('ticket_activities', { eq: { ticket_id: id }, order: { col: 'created_at', asc: false } }),
      ])
      setTiket(tk)
      setAktivitas(ak)
      const urls: Record<string, string> = {}
      await Promise.all(
        ak.filter((a) => a.photo_url).map(async (a) => {
          urls[a.id] = (await signedUrl(a.photo_url)) ?? ''
        })
      )
      setFotoUrl(urls)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat detail tiket.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      muat()
    }, [muat])
  )

  const ambilFoto = async () => {
    const izin = await ImagePicker.requestCameraPermissionsAsync()
    if (izin.status !== 'granted') return
    const hasil = await ImagePicker.launchCameraAsync({ quality: 0.6 })
    if (!hasil.canceled && hasil.assets?.length) setFotoUri(hasil.assets[0].uri)
  }

  const kirimAktivitas = async () => {
    if (!profile || !tiket) return
    if (!catatan.trim()) {
      setError('Catatan aktivitas wajib diisi.')
      return
    }
    setError('')
    setKirimProses(true)
    try {
      const lokasi = await ambilLokasi().catch(() => null)
      let photoPath: string | null = null
      if (fotoUri) photoPath = await uploadFile(profile.company_id, 'tiket_aktivitas', fotoUri, 'aktivitas.jpg')
      const row = await insert<TicketActivity>('ticket_activities', {
        company_id: profile.company_id,
        ticket_id: tiket.id,
        activity_type: jenis,
        note: catatan.trim(),
        lat: lokasi?.lat ?? null,
        lng: lokasi?.lng ?? null,
        photo_url: photoPath,
        created_by: profile.id,
      })
      setAktivitas((prev) => [row, ...prev])
      if (photoPath) {
        const url = await signedUrl(photoPath)
        setFotoUrl((prev) => ({ ...prev, [row.id]: url ?? '' }))
      }
      setCatatan('')
      setFotoUri(null)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menyimpan aktivitas.')
    } finally {
      setKirimProses(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} size="large" />
      </View>
    )
  }
  if (!tiket) {
    return <KesalahanState pesan={error || 'Tiket tidak ditemukan.'} onCoba={muat} />
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
    >
      <Kartu style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: t.primary, fontWeight: '800', fontSize: 16 }}>{tiket.ticket_no}</Text>
          <Lencana>{tiket.status}</Lencana>
        </View>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 17 }}>{tiket.customer_name ?? '-'}</Text>
        {tiket.description ? <Text style={{ color: t.textMuted }}>{tiket.description}</Text> : null}
        <View style={[styles.divider, { backgroundColor: t.border }]} />
        <Baris t={t} label="Kategori" value={`${tiket.category ?? '-'}${tiket.sub_category ? ' / ' + tiket.sub_category : ''}`} />
        <Baris t={t} label="Prioritas" value={tiket.severity ?? '-'} />
        <Baris t={t} label="Alamat" value={tiket.address ?? '-'} />
        <Baris t={t} label="Telepon" value={tiket.customer_phone ?? '-'} />
        <Baris t={t} label="Dilaporkan" value={tglJam(tiket.reported_at)} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Text style={{ color: t.textMuted, fontSize: 14 }}>Sisa SLA</Text>
          <Text style={{ color: t.bahaya, fontWeight: '800', fontSize: 15 }}>{sisaWaktu(tiket.sla_due_at)}</Text>
        </View>
        {tiket.lat != null && tiket.lng != null ? (
          <Tombol
            label="Buka di Google Maps"
            varian="sekunder"
            icon={<Ionicons name="navigate-outline" size={18} color={t.primary} />}
            onPress={() => {
              const url = bukaGoogleMaps(tiket.lat, tiket.lng, tiket.address ?? undefined)
              if (url) Linking.openURL(url)
            }}
          />
        ) : null}
      </Kartu>

      <Kartu>
        <Text style={[styles.judulKartu, { color: t.text }]}>Tambah Aktivitas</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {JENIS_AKTIVITAS.map((j) => (
            <Text
              key={j}
              onPress={() => setJenis(j)}
              style={[
                styles.chip,
                { borderColor: jenis === j ? t.primary : t.border, backgroundColor: jenis === j ? t.primary : 'transparent', color: jenis === j ? '#FFFFFF' : t.text },
              ]}
            >
              {j}
            </Text>
          ))}
        </View>
        <View style={{ marginTop: 12 }}>
          <Ladang label="Catatan" wajib multiline value={catatan} onChangeText={setCatatan} placeholder="Tuliskan progres/tindakan di lapangan..." />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' }}>
          <Tombol label={fotoUri ? 'Ganti Foto' : 'Tambah Foto'} varian="sekunder" icon={<Ionicons name="camera-outline" size={18} color={t.primary} />} onPress={ambilFoto} />
          {fotoUri ? <Image source={{ uri: fotoUri }} style={{ width: 44, height: 44, borderRadius: RADIUS }} /> : null}
        </View>
        {error ? <Text style={{ color: t.bahaya, marginTop: 8 }}>{error}</Text> : null}
        <View style={{ marginTop: 12 }}>
          <Tombol label="Kirim Aktivitas" onPress={kirimAktivitas} loading={kirimProses} full />
        </View>
      </Kartu>

      <Kartu>
        <Text style={[styles.judulKartu, { color: t.text }]}>Riwayat Aktivitas</Text>
        {aktivitas.length === 0 ? (
          <Text style={{ color: t.textMuted, marginTop: 8 }}>Belum ada aktivitas tercatat.</Text>
        ) : (
          <View style={{ gap: 12, marginTop: 12 }}>
            {aktivitas.map((a) => (
              <View key={a.id} style={[styles.timelineItem, { borderColor: t.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: t.text, fontWeight: '700', textTransform: 'capitalize' }}>{a.activity_type ?? 'aktivitas'}</Text>
                  <Text style={{ color: t.textMuted, fontSize: 12 }}>{tglJam(a.created_at)}</Text>
                </View>
                {a.note ? <Text style={{ color: t.textMuted, marginTop: 4 }}>{a.note}</Text> : null}
                {a.photo_url && fotoUrl[a.id] ? (
                  <Image source={{ uri: fotoUrl[a.id] }} style={{ width: 90, height: 90, borderRadius: RADIUS, marginTop: 8 }} />
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Kartu>
      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

function Baris({ t, label, value }: { t: ReturnType<typeof useTheme>; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ color: t.textMuted, fontSize: 14, width: 100 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 14, flex: 1, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginVertical: 4 },
  judulKartu: { fontSize: 16, fontWeight: '700' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, fontSize: 13, fontWeight: '600', textTransform: 'capitalize', overflow: 'hidden' },
  timelineItem: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 4 },
})
