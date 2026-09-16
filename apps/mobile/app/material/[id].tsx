import React, { useCallback, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Lencana from '@/components/Lencana'
import KesalahanState from '@/components/KesalahanState'
import { getOne, list } from '@/lib/db'
import { num, tgl } from '@/lib/format'
import type { ItemCatalog, MaterialRequest, MaterialRequestItem } from '@/types/db'

export default function DetailMaterialRequest() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useTheme()
  const [mr, setMr] = useState<MaterialRequest | null>(null)
  const [rows, setRows] = useState<MaterialRequestItem[]>([])
  const [items, setItems] = useState<Record<string, ItemCatalog>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const muat = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      const [header, itemRows] = await Promise.all([
        getOne<MaterialRequest>('material_requests', id),
        list<MaterialRequestItem>('material_request_items', { eq: { mr_id: id } }),
      ])
      setMr(header)
      setRows(itemRows)
      if (itemRows.length) {
        const ids = Array.from(new Set(itemRows.map((r) => r.item_id)))
        const katalog = await list<ItemCatalog>('item_catalog', { in: { id: ids } })
        const map: Record<string, ItemCatalog> = {}
        katalog.forEach((k) => (map[k.id] = k))
        setItems(map)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat detail permintaan.')
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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} size="large" />
      </View>
    )
  }
  if (!mr) {
    return <KesalahanState pesan={error || 'Permintaan tidak ditemukan.'} onCoba={muat} />
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
    >
      <Kartu style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: t.primary, fontWeight: '800', fontSize: 16 }}>{mr.mr_no}</Text>
          <Lencana>{mr.status}</Lencana>
        </View>
        <Text style={{ color: t.text, fontSize: 15 }}>{mr.purpose ?? '-'}</Text>
        <Text style={{ color: t.textMuted, fontSize: 13 }}>Diajukan {tgl(mr.request_date)}</Text>
      </Kartu>

      <Kartu>
        <Text style={[styles.judul, { color: t.text }]}>Item Diminta</Text>
        <View style={{ gap: 10, marginTop: 10 }}>
          {rows.map((r) => (
            <View key={r.id} style={[styles.baris, { borderColor: t.border }]}>
              <Text style={{ color: t.text, fontWeight: '700' }}>{items[r.item_id]?.name ?? r.item_id}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Kolom t={t} label="Diminta" value={`${num(r.qty_request)} ${r.uom ?? ''}`} />
                <Kolom t={t} label="Disetujui" value={`${num(r.qty_approved ?? 0)} ${r.uom ?? ''}`} />
                <Kolom t={t} label="Dikeluarkan" value={`${num(r.qty_issued ?? 0)} ${r.uom ?? ''}`} />
              </View>
            </View>
          ))}
        </View>
      </Kartu>
      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

function Kolom({ t, label, value }: { t: ReturnType<typeof useTheme>; label: string; value: string }) {
  return (
    <View>
      <Text style={{ color: t.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  judul: { fontSize: 16, fontWeight: '700' },
  baris: { borderWidth: 1, borderRadius: RADIUS, padding: 10 },
})
