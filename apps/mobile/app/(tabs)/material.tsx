import React, { useCallback, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTheme } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Lencana from '@/components/Lencana'
import KosongState from '@/components/KosongState'
import KesalahanState from '@/components/KesalahanState'
import { useAuth } from '@/lib/auth'
import { list } from '@/lib/db'
import { tgl } from '@/lib/format'
import type { MaterialRequest } from '@/types/db'

export default function DaftarMaterial() {
  const t = useTheme()
  const router = useRouter()
  const { profile } = useAuth()
  const [data, setData] = useState<MaterialRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const muat = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false)
      return
    }
    setError('')
    try {
      const rows = await list<MaterialRequest>('material_requests', {
        eq: { requester_id: profile.id },
        order: { col: 'created_at', asc: false },
        limit: 100,
      })
      setData(rows)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat permintaan material.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [profile?.id])

  useFocusEffect(
    useCallback(() => {
      muat()
    }, [muat])
  )

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
        data={data}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Pressable onPress={() => router.push('/material/baru')} style={[styles.tombolBaru, { backgroundColor: t.primary }]}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.tombolBaruLabel}>Buat Permintaan Material</Text>
          </Pressable>
        }
        ListEmptyComponent={
          loading ? null : error ? (
            <KesalahanState pesan={error} onCoba={muat} />
          ) : (
            <KosongState judul="Belum ada permintaan" pesan="Buat permintaan material untuk kebutuhan pekerjaan Anda." ikon="cube-outline" />
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/material/${item.id}`)}>
            <Kartu style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{item.mr_no}</Text>
                <Lencana>{item.status}</Lencana>
              </View>
              <Text style={{ color: t.text, fontSize: 15 }}>{item.purpose ?? 'Permintaan material'}</Text>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>{tgl(item.request_date)}</Text>
            </Kartu>
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  tombolBaru: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 10, marginBottom: 14 },
  tombolBaruLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
})
