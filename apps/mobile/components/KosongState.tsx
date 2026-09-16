import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from './theme'
import Tombol from './Tombol'

export default function KosongState({
  judul,
  pesan,
  ikon = 'file-tray-outline',
  aksiLabel,
  onAksi,
}: {
  judul: string
  pesan?: string
  ikon?: keyof typeof Ionicons.glyphMap
  aksiLabel?: string
  onAksi?: () => void
}) {
  const t = useTheme()
  return (
    <View style={styles.wrap}>
      <Ionicons name={ikon} size={40} color={t.textMuted} />
      <Text style={[styles.judul, { color: t.text }]}>{judul}</Text>
      {pesan ? <Text style={[styles.pesan, { color: t.textMuted }]}>{pesan}</Text> : null}
      {aksiLabel && onAksi ? (
        <View style={{ marginTop: 14 }}>
          <Tombol label={aksiLabel} onPress={onAksi} varian="sekunder" />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 6 },
  judul: { fontSize: 16, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  pesan: { fontSize: 14, textAlign: 'center' },
})
