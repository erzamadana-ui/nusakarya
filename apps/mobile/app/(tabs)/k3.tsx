import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'

export default function K3() {
  const t = useTheme()
  const router = useRouter()

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Text style={[styles.judulHalaman, { color: t.text }]}>Kesehatan & Keselamatan Kerja</Text>
        <Text style={{ color: t.textMuted, fontSize: 15, marginTop: 2 }}>
          Laporkan insiden, kelola izin kerja, dan lakukan inspeksi APD harian Anda.
        </Text>
      </View>

      <Pressable onPress={() => router.push('/k3/lapor-insiden')} style={[styles.tombolDarurat, { backgroundColor: t.bahaya }]}>
        <MaterialCommunityIcons name="alert-octagon" size={30} color="#FFFFFF" />
        <View style={{ flex: 1 }}>
          <Text style={styles.tombolDaruratJudul}>Lapor Insiden</Text>
          <Text style={styles.tombolDaruratSub}>Kecelakaan, nyaris celaka, atau kerusakan aset — laporkan segera</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
      </Pressable>

      <AksiKartu
        t={t}
        ikon="document-text-outline"
        judul="Izin Kerja Saya"
        pesan="Ajukan & pantau izin kerja aman (SIKA) beserta checklist keselamatannya."
        onPress={() => router.push('/k3/izin-kerja')}
      />

      <AksiKartu
        t={t}
        ikon="checkbox-outline"
        judul="Inspeksi APD Harian"
        pesan="Isi checklist alat pelindung diri sebelum memulai pekerjaan hari ini."
        onPress={() => router.push('/k3/inspeksi-apd')}
      />

      <View style={{ height: 12 }} />
    </ScrollView>
  )
}

function AksiKartu({
  t,
  ikon,
  judul,
  pesan,
  onPress,
}: {
  t: ReturnType<typeof useTheme>
  ikon: keyof typeof Ionicons.glyphMap
  judul: string
  pesan: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress}>
      <Kartu style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={[styles.ikonWrap, { backgroundColor: t.bg, borderColor: t.border }]}>
          <Ionicons name={ikon} size={24} color={t.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{judul}</Text>
          <Text style={{ color: t.textMuted, fontSize: 14, marginTop: 2 }}>{pesan}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
      </Kartu>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  judulHalaman: { fontSize: 20, fontWeight: '800' },
  tombolDarurat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: RADIUS,
    padding: 16,
    minHeight: 44,
  },
  tombolDaruratJudul: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  tombolDaruratSub: { color: '#FFE7EB', fontSize: 13, marginTop: 2 },
  ikonWrap: { width: 48, height: 48, borderRadius: RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
})
