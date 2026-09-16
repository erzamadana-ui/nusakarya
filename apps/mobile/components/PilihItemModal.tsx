import React, { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from './theme'
import type { ItemCatalog } from '@/types/db'

/** Modal pemilihan item katalog (material) dengan pencarian sederhana. */
export default function PilihItemModal({
  visible,
  items,
  onClose,
  onPilih,
}: {
  visible: boolean
  items: ItemCatalog[]
  onClose: () => void
  onPilih: (item: ItemCatalog) => void
}) {
  const t = useTheme()
  const [q, setQ] = useState('')

  const hasil = useMemo(() => {
    const key = q.trim().toLowerCase()
    if (!key) return items
    return items.filter((i) => i.name.toLowerCase().includes(key) || i.code.toLowerCase().includes(key))
  }, [items, q])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: t.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.judul, { color: t.text }]}>Pilih Material</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={24} color={t.text} />
          </Pressable>
        </View>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Cari nama atau kode item..."
          placeholderTextColor={t.textMuted}
          style={[styles.cari, { borderColor: t.border, color: t.text, backgroundColor: t.card }]}
        />
        <FlatList
          data={hasil}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPilih(item)}
              style={[styles.baris, { borderColor: t.border, backgroundColor: t.card }]}
            >
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
              <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 2 }}>
                {item.code} · {item.uom ?? '-'}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: 24 }}>Item tidak ditemukan.</Text>
          }
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  judul: { fontSize: 18, fontWeight: '800' },
  cari: { marginHorizontal: 16, minHeight: 44, borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 12, fontSize: 16 },
  baris: { borderWidth: 1, borderRadius: RADIUS, padding: 12 },
})
