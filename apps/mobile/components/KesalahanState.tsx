import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from './theme'
import Tombol from './Tombol'

/** Ditampilkan saat permintaan data gagal (mis. tidak ada jaringan). */
export default function KesalahanState({ pesan, onCoba }: { pesan?: string; onCoba: () => void }) {
  const t = useTheme()
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={40} color={t.bahaya} />
      <Text style={[styles.judul, { color: t.text }]}>Gagal memuat data</Text>
      <Text style={[styles.pesan, { color: t.textMuted }]}>
        {pesan || 'Periksa koneksi internet Anda, lalu coba lagi.'}
      </Text>
      <View style={{ marginTop: 14 }}>
        <Tombol label="Coba Lagi" onPress={onCoba} varian="sekunder" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 6 },
  judul: { fontSize: 16, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  pesan: { fontSize: 14, textAlign: 'center' },
})
