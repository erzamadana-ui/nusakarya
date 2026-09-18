import React, { useEffect, useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import { useAuth } from '@/lib/auth'
import { insert, list, nextDocNo, uploadFile } from '@/lib/db'
import { todayISO } from '@/lib/format'
import { ITEM_INSPEKSI_APD, hasilInspeksi } from '@/lib/k3'
import type { Branch } from '@/types/db'

export default function InspeksiApd() {
  const t = useTheme()
  const router = useRouter()
  const { profile, employee } = useAuth()

  const [nilai, setNilai] = useState<Record<string, boolean>>(
    Object.fromEntries(ITEM_INSPEKSI_APD.map((i) => [i.key, true]))
  )
  const [branch, setBranch] = useState<Branch | null>(null)
  const [foto, setFoto] = useState<{ uri: string }[]>([])
  const [simpanProses, setSimpanProses] = useState(false)

  useEffect(() => {
    if (!profile) return
    list<Branch>('branches', { eq: { company_id: profile.company_id, is_active: true } })
      .then((rows) => setBranch(rows.find((r) => r.id === employee?.branch_id) ?? null))
      .catch(() => {})
  }, [profile, employee?.branch_id])

  const totalOk = Object.values(nilai).filter(Boolean).length
  const skor = Math.round((totalOk / ITEM_INSPEKSI_APD.length) * 100)
  const hasil = hasilInspeksi(skor)
  const warnaHasil = hasil.kunci === 'aman' ? t.sukses : hasil.kunci === 'perlu_perbaikan' ? t.peringatan : t.bahaya

  const tambahFoto = async (dariKamera: boolean) => {
    const izin = dariKamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (izin.status !== 'granted') {
      Alert.alert('Izin ditolak', 'Aktifkan izin yang diperlukan lalu coba lagi.')
      return
    }
    const hasilPicker = dariKamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 })
    if (hasilPicker.canceled || !hasilPicker.assets?.length) return
    setFoto((prev) => [...prev, { uri: hasilPicker.assets[0].uri }])
  }

  const simpan = async () => {
    if (!profile) return
    setSimpanProses(true)
    try {
      const photoUrls: string[] = []
      for (let i = 0; i < foto.length; i++) {
        const path = await uploadFile(profile.company_id, 'hse_inspection', foto[i].uri, `apd-${i + 1}.jpg`)
        photoUrls.push(path)
      }
      const inspectionNo = await nextDocNo(profile.company_id, 'INSP')
      const findings = ITEM_INSPEKSI_APD.map((i) => ({ key: i.key, label: i.label, ok: nilai[i.key] }))
      const row = await insert('hse_inspections', {
        company_id: profile.company_id,
        inspection_no: inspectionNo,
        inspection_type: 'APD',
        inspection_date: todayISO(),
        branch_id: branch?.id ?? employee?.branch_id ?? null,
        inspector_id: employee?.id ?? null,
        target_ref: `APD ${employee?.full_name ?? profile.full_name}`,
        findings,
        score: skor,
        result: hasil.kunci,
        photo_urls: photoUrls,
        status: 'selesai',
        created_by: profile.id,
      })
      Alert.alert('Berhasil Disimpan', `Inspeksi APD ${(row as any).inspection_no} — Hasil: ${hasil.label} (${skor}%).`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat menyimpan inspeksi APD.')
    } finally {
      setSimpanProses(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Kartu style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>Checklist APD Harian</Text>
        <Text style={{ color: t.textMuted, fontSize: 14 }}>Periksa kondisi alat pelindung diri Anda sebelum memulai pekerjaan.</Text>
      </Kartu>

      <Kartu style={{ gap: 4 }}>
        {ITEM_INSPEKSI_APD.map((item, idx) => (
          <View key={item.key} style={[styles.row, idx > 0 ? { borderTopWidth: 1, borderTopColor: t.border } : null]}>
            <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>{item.label}</Text>
            <Text style={{ color: nilai[item.key] ? t.sukses : t.bahaya, fontSize: 13, fontWeight: '700', marginRight: 8 }}>
              {nilai[item.key] ? 'Baik' : 'Bermasalah'}
            </Text>
            <Switch
              value={nilai[item.key]}
              onValueChange={(v) => setNilai((prev) => ({ ...prev, [item.key]: v }))}
              trackColor={{ true: t.sukses, false: t.bahaya }}
            />
          </View>
        ))}
      </Kartu>

      <Kartu style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ color: t.textMuted, fontSize: 13 }}>Skor Inspeksi</Text>
        <Text style={{ color: warnaHasil, fontSize: 32, fontWeight: '800' }}>{skor}%</Text>
        <Text style={{ color: warnaHasil, fontSize: 16, fontWeight: '700' }}>{hasil.label}</Text>
        <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
          ≥90% Aman · 70–89% Perlu Perbaikan · &lt;70% Tidak Aman
        </Text>
      </Kartu>

      <Kartu>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Foto (opsional)</Text>
        <View style={styles.gridFoto}>
          {foto.map((f, i) => (
            <Image key={i} source={{ uri: f.uri }} style={[styles.thumb, { borderColor: t.border }]} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Tombol label="Kamera" icon={<Ionicons name="camera-outline" size={18} color={t.primary} />} varian="sekunder" onPress={() => tambahFoto(true)} full />
          </View>
          <View style={{ flex: 1 }}>
            <Tombol label="Galeri" icon={<Ionicons name="images-outline" size={18} color={t.primary} />} varian="sekunder" onPress={() => tambahFoto(false)} full />
          </View>
        </View>
      </Kartu>

      <Tombol label="Simpan Inspeksi" onPress={simpan} loading={simpanProses} full />
      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, minHeight: 44 },
  gridFoto: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumb: { width: 84, height: 84, borderRadius: RADIUS, borderWidth: 1 },
})
