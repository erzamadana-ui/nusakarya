import React, { useCallback, useMemo, useState } from 'react'
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
import { tglJam, todayISO } from '@/lib/format'
import type { WorkOrder } from '@/types/db'

type TabKey = 'hari_ini' | 'berjalan' | 'selesai'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'hari_ini', label: 'Hari Ini' },
  { key: 'berjalan', label: 'Berjalan' },
  { key: 'selesai', label: 'Selesai' },
]

export default function DaftarTugas() {
  const t = useTheme()
  const router = useRouter()
  const { employee } = useAuth()
  const [tab, setTab] = useState<TabKey>('hari_ini')
  const [data, setData] = useState<WorkOrder[]>([])
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
      let q = supabase.from('work_orders').select('*').eq('assigned_to', employee.id)
      const today = todayISO()
      if (tab === 'hari_ini') {
        q = q.gte('scheduled_at', `${today}T00:00:00`).lte('scheduled_at', `${today}T23:59:59`).order('scheduled_at', { ascending: true })
      } else if (tab === 'berjalan') {
        q = q.in('status', ['ditugaskan', 'diterima', 'berjalan', 'dikerjakan']).order('scheduled_at', { ascending: true })
      } else {
        q = q.in('status', ['selesai', 'gagal']).order('finished_at', { ascending: false }).limit(60)
      }
      const { data: rows, error: err } = await q
      if (err) throw err
      setData((rows ?? []) as WorkOrder[])
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat daftar Work Order.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [employee?.id, tab])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      muat()
    }, [muat])
  )

  const jenisLabel = useMemo(
    () => ({
      instalasi: 'Instalasi',
      assurance: 'Assurance',
      maintenance: 'Maintenance',
      survey: 'Survey',
      pasang_baru: 'Pasang Baru',
    } as Record<string, string>),
    []
  )

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.tabBar, { backgroundColor: t.card, borderColor: t.border }]}>
        {TABS.map((tb) => {
          const aktif = tab === tb.key
          return (
            <Pressable
              key={tb.key}
              onPress={() => {
                setTab(tb.key)
                setLoading(true)
              }}
              style={[styles.tabItem, aktif && { backgroundColor: t.primary }]}
            >
              <Text style={[styles.tabLabel, { color: aktif ? '#FFFFFF' : t.textMuted }]}>{tb.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />
        }
        data={data}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading ? null : error ? (
            <KesalahanState pesan={error} onCoba={muat} />
          ) : (
            <KosongState judul="Tidak ada Work Order" pesan="Belum ada tugas pada kategori ini." ikon="clipboard-outline" />
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/wo/${item.id}`)}>
            <Kartu style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{item.wo_no}</Text>
                <Lencana>{item.status}</Lencana>
              </View>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>
                {jenisLabel[item.wo_type] ?? item.wo_type} — {item.title ?? item.customer_name ?? '-'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Ionicons name="person-outline" size={14} color={t.textMuted} />
                <Text style={{ color: t.textMuted, fontSize: 14 }}>{item.customer_name ?? '-'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                <Ionicons name="location-outline" size={14} color={t.textMuted} style={{ marginTop: 2 }} />
                <Text style={{ color: t.textMuted, fontSize: 14, flex: 1 }}>{item.address ?? '-'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={14} color={t.textMuted} />
                <Text style={{ color: t.textMuted, fontSize: 14 }}>{tglJam(item.scheduled_at)}</Text>
              </View>
            </Kartu>
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', margin: 16, marginBottom: 0, borderRadius: RADIUS, borderWidth: 1, padding: 4, gap: 4 },
  tabItem: { flex: 1, paddingVertical: 10, borderRadius: RADIUS - 3, alignItems: 'center' },
  tabLabel: { fontSize: 14, fontWeight: '700' },
})
