import React, { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from './theme'

export type Opsi = { value: string; label: string; sub?: string }

/** Modal pemilihan opsi generik (cabang, jenis, kategori, dll) dengan pencarian sederhana. */
export default function PilihOpsiModal({
  visible,
  judul,
  opsi,
  cariAktif = true,
  onClose,
  onPilih,
}: {
  visible: boolean
  judul: string
  opsi: Opsi[]
  cariAktif?: boolean
  onClose: () => void
  onPilih: (opsi: Opsi) => void
}) {
  const t = useTheme()
  const [q, setQ] = useState('')

  const hasil = useMemo(() => {
    const key = q.trim().toLowerCase()
    if (!key) return opsi
    return opsi.filter((o) => o.label.toLowerCase().includes(key) || (o.sub ?? '').toLowerCase().includes(key))
  }, [opsi, q])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: t.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.judul, { color: t.text }]}>{judul}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={t.text} />
          </Pressable>
        </View>
        {cariAktif ? (
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Cari..."
            placeholderTextColor={t.textMuted}
            style={[styles.cari, { borderColor: t.border, color: t.text, backgroundColor: t.card }]}
          />
        ) : null}
        <FlatList
          data={hasil}
          keyExtractor={(o) => o.value}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPilih(item)}
              style={[styles.baris, { borderColor: t.border, backgroundColor: t.card }]}
            >
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{item.label}</Text>
              {item.sub ? <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 2 }}>{item.sub}</Text> : null}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: 24 }}>Tidak ada pilihan ditemukan.</Text>
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
