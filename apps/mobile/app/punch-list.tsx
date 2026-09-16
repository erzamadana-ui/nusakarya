import React, { useCallback, useState } from 'react'
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import Lencana from '@/components/Lencana'
import KosongState from '@/components/KosongState'
import KesalahanState from '@/components/KesalahanState'
import { useAuth } from '@/lib/auth'
import { list, signedUrl, update, uploadFile } from '@/lib/db'
import { tgl, todayISO } from '@/lib/format'
import type { PunchList } from '@/types/db'

export default function PunchListSaya() {
  const t = useTheme()
  const { profile, employee } = useAuth()
  const [data, setData] = useState<PunchList[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [prosesId, setProsesId] = useState<string | null>(null)

  const muat = useCallback(async () => {
    if (!employee?.id) {
      setLoading(false)
      return
    }
    setError('')
    try {
      const rows = await list<PunchList>('punch_lists', { eq: { assigned_to: employee.id }, order: { col: 'due_date', asc: true }, limit: 150 })
      setData(rows)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat punch list.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [employee?.id])

  useFocusEffect(useCallback(() => { muat() }, [muat]))

  const tandaiDiperbaiki = async (item: PunchList) => {
    if (!profile) return
    const izin = await ImagePicker.requestCameraPermissionsAsync()
    if (izin.status !== 'granted') {
      Alert.alert('Izin ditolak', 'Aktifkan izin kamera untuk mengunggah foto perbaikan.')
      return
    }
    const hasil = await ImagePicker.launchCameraAsync({ quality: 0.6 })
    if (hasil.canceled || !hasil.assets?.length) return
    setProsesId(item.id)
    try {
      const path = await uploadFile(profile.company_id, 'punch_list', hasil.assets[0].uri, `perbaikan-${item.punch_no}.jpg`)
      const photoUrls = [...(item.photo_urls ?? []), path]
      const row = await update<PunchList>('punch_lists', item.id, {
        status: 'diperbaiki',
        fixed_date: todayISO(),
        photo_urls: photoUrls,
      })
      setData((prev) => prev.map((p) => (p.id === row.id ? row : p)))
      Alert.alert('Tersimpan', `${item.punch_no} ditandai sudah diperbaiki. Menunggu verifikasi.`)
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat menyimpan foto perbaikan.')
    } finally {
      setProsesId(null)
    }
  }

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
      data={data}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        loading ? null : error ? (
          <KesalahanState pesan={error} onCoba={muat} />
        ) : (
          <KosongState judul="Tidak ada punch list" pesan="Belum ada temuan yang ditugaskan kepada Anda." ikon="checkmark-done-outline" />
        )
      }
      renderItem={({ item }) => {
        const sudahDiperbaiki = item.status !== 'terbuka'
        return (
          <Kartu style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{item.punch_no}</Text>
              <Lencana>{item.status}</Lencana>
            </View>
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{item.category ?? 'Temuan'}</Text>
            <Text style={{ color: t.textMuted, fontSize: 14 }}>{item.description ?? '-'}</Text>
            {item.location ? (
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Ionicons name="location-outline" size={14} color={t.textMuted} />
                <Text style={{ color: t.textMuted, fontSize: 13 }}>{item.location}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>Ditemukan {tgl(item.found_date)}</Text>
              {item.due_date ? <Text style={{ color: t.bahaya, fontSize: 12, fontWeight: '700' }}>Batas {tgl(item.due_date)}</Text> : null}
            </View>
            {item.photo_urls && item.photo_urls.length > 0 ? (
              <FotoRow paths={item.photo_urls} />
            ) : null}
            {!sudahDiperbaiki ? (
              <Tombol
                label="Tandai Sudah Diperbaiki"
                icon={<Ionicons name="camera-outline" size={18} color="#FFFFFF" />}
                onPress={() => tandaiDiperbaiki(item)}
                loading={prosesId === item.id}
                full
              />
            ) : (
              <Text style={{ color: t.sukses, fontWeight: '700', fontSize: 13 }}>
                {item.status === 'diperbaiki' ? 'Sudah diperbaiki — menunggu verifikasi' : 'Sudah diverifikasi'}
              </Text>
            )}
          </Kartu>
        )
      }}
      ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
      ListFooterComponent={<View style={{ height: 24 }} />}
    />
  )
}

function FotoRow({ paths }: { paths: string[] }) {
  const t = useTheme()
  const [urls, setUrls] = useState<Record<string, string>>({})

  React.useEffect(() => {
    ;(async () => {
      const map: Record<string, string> = {}
      await Promise.all(
        paths.map(async (p) => {
          map[p] = (await signedUrl(p)) ?? ''
        })
      )
      setUrls(map)
    })()
  }, [paths.join('|')])

  return (
    <View style={styles.gridFoto}>
      {paths.map((p) => (urls[p] ? <Image key={p} source={{ uri: urls[p] }} style={[styles.thumb, { borderColor: t.border }]} /> : null))}
    </View>
  )
}

const styles = StyleSheet.create({
  gridFoto: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: RADIUS, borderWidth: 1 },
})
