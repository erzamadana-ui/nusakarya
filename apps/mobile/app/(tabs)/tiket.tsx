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
import { sisaWaktu } from '@/lib/format'
import type { Ticket } from '@/types/db'
import { TIKET } from '@/lib/status'

export default function DaftarTiket() {
  const t = useTheme()
  const router = useRouter()
  const { employee } = useAuth()
  const [data, setData] = useState<Ticket[]>([])
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
      const rows = await list<Ticket>('tickets', {
        eq: { assigned_to: employee.id },
        order: { col: 'sla_due_at', asc: true },
        limit: 100,
      })
      setData(rows)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat daftar tiket.')
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

  const warnaSla = (dueISO?: string | null, status?: string) => {
    if (!dueISO || status === TIKET.DITUTUP || status === TIKET.SELESAI) return t.textMuted
    const sisaMin = (new Date(dueISO).getTime() - Date.now()) / 60000
    if (sisaMin < 0) return t.bahaya
    if (sisaMin <= 120) return t.peringatan
    return t.sukses
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
        data={data}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading ? null : error ? (
            <KesalahanState pesan={error} onCoba={muat} />
          ) : (
            <KosongState judul="Tidak ada tiket" pesan="Belum ada tiket gangguan yang ditugaskan ke Anda." ikon="alert-circle-outline" />
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/tiket/${item.id}`)}>
            <Kartu style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{item.ticket_no}</Text>
                <Lencana>{item.status}</Lencana>
              </View>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{item.customer_name ?? '-'}</Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                <Ionicons name="location-outline" size={14} color={t.textMuted} style={{ marginTop: 2 }} />
                <Text style={{ color: t.textMuted, fontSize: 14, flex: 1 }}>{item.address ?? '-'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: t.textMuted, fontSize: 13 }}>
                  {item.category ?? '-'} {item.severity ? `· ${item.severity}` : ''}
                </Text>
                <Text style={{ color: warnaSla(item.sla_due_at, item.status), fontWeight: '700', fontSize: 13 }}>
                  {sisaWaktu(item.sla_due_at)}
                </Text>
              </View>
            </Kartu>
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({})
