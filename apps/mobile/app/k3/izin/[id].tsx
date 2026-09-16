import React, { useCallback, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Lencana from '@/components/Lencana'
import KesalahanState from '@/components/KesalahanState'
import { getOne } from '@/lib/db'
import { sisaWaktu, tglJam } from '@/lib/format'
import { JENIS_IZIN_KERJA } from '@/lib/k3'
import type { WorkPermit } from '@/types/db'

export default function DetailIzinKerja() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useTheme()
  const [izin, setIzin] = useState<WorkPermit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const muat = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      const row = await getOne<WorkPermit>('work_permits', id)
      setIzin(row)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat detail izin kerja.')
    } finally {
      setLoading(false)
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
  if (error || !izin) {
    return <KesalahanState pesan={error || 'Izin kerja tidak ditemukan.'} onCoba={muat} />
  }

  const sisaMin = izin.valid_to ? (new Date(izin.valid_to).getTime() - Date.now()) / 60000 : null
  const warnaCountdown = sisaMin == null ? t.textMuted : sisaMin < 0 ? t.bahaya : sisaMin <= 120 ? t.peringatan : t.sukses

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Kartu style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: t.primary, fontWeight: '800', fontSize: 16 }}>{izin.permit_no}</Text>
          <Lencana>{izin.status}</Lencana>
        </View>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 17 }}>
          {JENIS_IZIN_KERJA.find((j) => j.value === izin.permit_type)?.label ?? izin.permit_type ?? '-'}
        </Text>
        {izin.location ? (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Ionicons name="location-outline" size={14} color={t.textMuted} />
            <Text style={{ color: t.textMuted, fontSize: 14 }}>{izin.location}</Text>
          </View>
        ) : null}
      </Kartu>

      <Kartu style={{ gap: 6 }}>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Masa Berlaku</Text>
        <Text style={{ color: t.textMuted, fontSize: 14 }}>
          {tglJam(izin.valid_from)} — {tglJam(izin.valid_to)}
        </Text>
        {izin.status === 'disetujui' && izin.valid_to ? (
          <Text style={{ color: warnaCountdown, fontWeight: '800', fontSize: 16, marginTop: 4 }}>{sisaWaktu(izin.valid_to)}</Text>
        ) : null}
      </Kartu>

      <Kartu style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Checklist Keselamatan</Text>
        {izin.status === 'disetujui' ? (
          <Text style={{ color: t.textMuted, fontSize: 13, marginBottom: 6 }}>Izin sudah disetujui — checklist bersifat baca-saja.</Text>
        ) : null}
        <View style={{ gap: 10, marginTop: 6 }}>
          {(izin.safety_checklist ?? []).map((c, i) => (
            <View key={i} style={styles.checkRow}>
              <Ionicons name={c.checked ? 'checkbox' : 'square-outline'} size={22} color={c.checked ? t.sukses : t.textMuted} />
              <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>{c.label}</Text>
            </View>
          ))}
        </View>
      </Kartu>

      {izin.status === 'disetujui' && izin.approved_at ? (
        <Kartu>
          <Text style={{ color: t.sukses, fontWeight: '700', fontSize: 14 }}>Disetujui pada {tglJam(izin.approved_at)}</Text>
        </Kartu>
      ) : null}

      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
})
