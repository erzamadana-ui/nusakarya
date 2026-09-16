import React, { useCallback, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Lencana from '@/components/Lencana'
import KosongState from '@/components/KosongState'
import KesalahanState from '@/components/KesalahanState'
import { useAuth } from '@/lib/auth'
import supabase from '@/lib/supabase'
import { sisaWaktu, tglJam } from '@/lib/format'
import { JENIS_IZIN_KERJA } from '@/lib/k3'
import type { WorkPermit } from '@/types/db'

export default function IzinKerjaSaya() {
  const t = useTheme()
  const router = useRouter()
  const { profile, employee } = useAuth()
  const [data, setData] = useState<WorkPermit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const muat = useCallback(async () => {
    if (!profile) {
      setLoading(false)
      return
    }
    setError('')
    try {
      let woIds: string[] = []
      if (employee?.id) {
        const { data: wos } = await supabase.from('work_orders').select('id').eq('assigned_to', employee.id)
        woIds = (wos ?? []).map((w: any) => w.id)
      }
      const filter = woIds.length > 0 ? `requested_by.eq.${profile.id},work_order_id.in.(${woIds.join(',')})` : `requested_by.eq.${profile.id}`
      const { data: rows, error: err } = await supabase
        .from('work_permits')
        .select('*')
        .or(filter)
        .order('created_at', { ascending: false })
        .limit(100)
      if (err) throw err
      setData((rows ?? []) as WorkPermit[])
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat daftar izin kerja.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [profile, employee?.id])

  useFocusEffect(
    useCallback(() => {
      muat()
    }, [muat])
  )

  const statusMasaBerlaku = (p: WorkPermit) => {
    if (p.status !== 'disetujui' || !p.valid_to) return null
    const sisaMin = (new Date(p.valid_to).getTime() - Date.now()) / 60000
    const warna = sisaMin < 0 ? t.bahaya : sisaMin <= 120 ? t.peringatan : t.sukses
    return { teks: sisaWaktu(p.valid_to), warna }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
        data={data}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Pressable onPress={() => router.push('/k3/izin-kerja-baru')} style={[styles.tombolBaru, { backgroundColor: t.primary }]}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.tombolBaruLabel}>Ajukan Izin Kerja Baru</Text>
          </Pressable>
        }
        ListEmptyComponent={
          loading ? null : error ? (
            <KesalahanState pesan={error} onCoba={muat} />
          ) : (
            <KosongState judul="Belum ada izin kerja" pesan="Ajukan izin kerja aman sebelum memulai pekerjaan berisiko." ikon="document-text-outline" />
          )
        }
        renderItem={({ item }) => {
          const masaBerlaku = statusMasaBerlaku(item)
          return (
            <Pressable onPress={() => router.push(`/k3/izin/${item.id}`)}>
              <Kartu style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{item.permit_no}</Text>
                  <Lencana>{item.status}</Lencana>
                </View>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>
                  {JENIS_IZIN_KERJA.find((j) => j.value === item.permit_type)?.label ?? item.permit_type ?? '-'}
                </Text>
                {item.location ? (
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Ionicons name="location-outline" size={14} color={t.textMuted} />
                    <Text style={{ color: t.textMuted, fontSize: 14 }}>{item.location}</Text>
                  </View>
                ) : null}
                <Text style={{ color: t.textMuted, fontSize: 13 }}>
                  Berlaku {tglJam(item.valid_from)} — {tglJam(item.valid_to)}
                </Text>
                {masaBerlaku ? (
                  <Text style={{ color: masaBerlaku.warna, fontWeight: '700', fontSize: 14 }}>{masaBerlaku.teks}</Text>
                ) : null}
              </Kartu>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  tombolBaru: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: RADIUS, marginBottom: 14 },
  tombolBaruLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
})
