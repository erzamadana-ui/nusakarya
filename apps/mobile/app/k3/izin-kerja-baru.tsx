import React, { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import Ladang from '@/components/Ladang'
import PilihOpsiModal, { Opsi } from '@/components/PilihOpsiModal'
import { useAuth } from '@/lib/auth'
import { insert, list, nextDocNo } from '@/lib/db'
import { tglJam } from '@/lib/format'
import { JENIS_IZIN_KERJA, templateIzin } from '@/lib/k3'
import type { WorkOrder } from '@/types/db'
import { WO_AKTIF } from '@/lib/status'

const DURASI_OPSI = [
  { label: '4 Jam', jam: 4 },
  { label: '8 Jam (1 Shift)', jam: 8 },
  { label: '24 Jam', jam: 24 },
]

export default function IzinKerjaBaru() {
  const t = useTheme()
  const router = useRouter()
  const { profile, employee } = useAuth()

  const [jenis, setJenis] = useState<Opsi | null>(null)
  const [jenisVisible, setJenisVisible] = useState(false)
  const [checklist, setChecklist] = useState<{ label: string; checked: boolean }[]>([])

  const [woList, setWoList] = useState<WorkOrder[]>([])
  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [woVisible, setWoVisible] = useState(false)

  const [lokasi, setLokasi] = useState('')
  const [durasiJam, setDurasiJam] = useState(8)
  const [simpanProses, setSimpanProses] = useState(false)

  useEffect(() => {
    if (!employee?.id) return
    list<WorkOrder>('work_orders', {
      eq: { assigned_to: employee.id },
      in: { status: WO_AKTIF as unknown as string[] },
      order: { col: 'scheduled_at', asc: false },
      limit: 30,
    })
      .then(setWoList)
      .catch(() => {})
  }, [employee?.id])

  const pilihJenis = (o: Opsi) => {
    setJenis(o)
    setJenisVisible(false)
    setChecklist(templateIzin(o.value).checklist.map((c) => ({ label: c.label, checked: false })))
  }

  const semuaTercentang = checklist.length > 0 && checklist.every((c) => c.checked)
  const mulai = new Date()
  const selesai = new Date(mulai.getTime() + durasiJam * 3600000)

  const simpan = async () => {
    if (!profile) return
    if (!jenis) {
      Alert.alert('Jenis izin belum dipilih', 'Pilih jenis izin kerja terlebih dahulu.')
      return
    }
    if (!lokasi.trim()) {
      Alert.alert('Lokasi wajib diisi', 'Isi lokasi pekerjaan.')
      return
    }
    if (!semuaTercentang) {
      Alert.alert('Checklist Belum Lengkap', 'Seluruh butir checklist keselamatan wajib dicentang sebelum izin dapat diajukan.')
      return
    }
    setSimpanProses(true)
    try {
      const permitNo = await nextDocNo(profile.company_id, 'SIKA')
      const row = await insert('work_permits', {
        company_id: profile.company_id,
        permit_no: permitNo,
        permit_type: jenis.value,
        project_id: wo?.project_id ?? null,
        work_order_id: wo?.id ?? null,
        location: lokasi.trim(),
        lat: wo?.lat ?? null,
        lng: wo?.lng ?? null,
        valid_from: mulai.toISOString(),
        valid_to: selesai.toISOString(),
        safety_checklist: checklist,
        status: 'diajukan',
        requested_by: profile.id,
        created_by: profile.id,
      })
      Alert.alert('Berhasil Diajukan', `Izin kerja ${(row as any).permit_no} berhasil diajukan dan menunggu persetujuan.`, [
        { text: 'OK', onPress: () => router.replace(`/k3/izin/${(row as any).id}`) },
      ])
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat mengajukan izin kerja.')
    } finally {
      setSimpanProses(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Kartu style={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>
            Jenis Izin Kerja<Text style={{ color: t.bahaya }}> *</Text>
          </Text>
          <Tombol
            label={jenis?.label ?? 'Pilih jenis izin kerja'}
            varian="sekunder"
            onPress={() => setJenisVisible(true)}
            full
            icon={<Ionicons name="chevron-down" size={16} color={t.primary} />}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>Work Order Terkait (opsional)</Text>
          <Tombol
            label={wo ? `${wo.wo_no} — ${wo.title ?? wo.customer_name ?? ''}` : 'Tidak terkait WO tertentu'}
            varian="sekunder"
            onPress={() => setWoVisible(true)}
            full
            icon={<Ionicons name="chevron-down" size={16} color={t.primary} />}
          />
        </View>
        <Ladang label="Lokasi Pekerjaan" wajib value={lokasi} onChangeText={setLokasi} placeholder="mis. Tiang 12, Jl. Sudirman" />
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>Masa Berlaku</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {DURASI_OPSI.map((d) => (
              <Pressable
                key={d.jam}
                onPress={() => setDurasiJam(d.jam)}
                style={[
                  styles.chip,
                  { borderColor: durasiJam === d.jam ? t.primary : t.border, backgroundColor: durasiJam === d.jam ? t.primary : t.card },
                ]}
              >
                <Text style={{ color: durasiJam === d.jam ? '#FFFFFF' : t.text, fontWeight: '700', fontSize: 13 }}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: t.textMuted, fontSize: 13 }}>
            {tglJam(mulai.toISOString())} — {tglJam(selesai.toISOString())}
          </Text>
        </View>
      </Kartu>

      {jenis ? (
        <Kartu style={{ gap: 4 }}>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Checklist Keselamatan</Text>
          <Text style={{ color: t.textMuted, fontSize: 13, marginBottom: 6 }}>Seluruh butir wajib dicentang sebelum izin dapat diajukan.</Text>
          <View style={{ gap: 10 }}>
            {checklist.map((c, i) => (
              <Pressable
                key={i}
                onPress={() => setChecklist((prev) => prev.map((p, idx) => (idx === i ? { ...p, checked: !p.checked } : p)))}
                style={styles.checkRow}
              >
                <Ionicons
                  name={c.checked ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={c.checked ? t.sukses : t.textMuted}
                />
                <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </Kartu>
      ) : null}

      <Tombol label="Ajukan Izin Kerja" onPress={simpan} loading={simpanProses} full disabled={!jenis || !semuaTercentang} />
      <View style={{ height: 24 }} />

      <PilihOpsiModal
        visible={jenisVisible}
        judul="Pilih Jenis Izin Kerja"
        cariAktif={false}
        opsi={JENIS_IZIN_KERJA.map((j) => ({ value: j.value, label: j.label }))}
        onClose={() => setJenisVisible(false)}
        onPilih={pilihJenis}
      />
      <PilihOpsiModal
        visible={woVisible}
        judul="Pilih Work Order"
        opsi={woList.map((w) => ({ value: w.id, label: w.wo_no, sub: w.title ?? w.customer_name ?? undefined }))}
        onClose={() => setWoVisible(false)}
        onPilih={(o) => {
          setWo(woList.find((w) => w.id === o.value) ?? null)
          setWoVisible(false)
        }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS, borderWidth: 1, minHeight: 44, justifyContent: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
})
