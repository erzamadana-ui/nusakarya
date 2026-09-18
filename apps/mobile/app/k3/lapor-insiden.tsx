import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import Ladang from '@/components/Ladang'
import PilihOpsiModal, { Opsi } from '@/components/PilihOpsiModal'
import { useAuth } from '@/lib/auth'
import { insert, list, nextDocNo, uploadFile } from '@/lib/db'
import { ambilLokasi, Koordinat } from '@/lib/location'
import { tgl, todayISO } from '@/lib/format'
import { JENIS_INSIDEN } from '@/lib/k3'
import type { Branch, WorkOrder } from '@/types/db'
import { WO_AKTIF } from '@/lib/status'

export default function LaporInsiden() {
  const t = useTheme()
  const router = useRouter()
  const { profile, employee } = useAuth()

  const [jenis, setJenis] = useState<Opsi | null>(null)
  const [jenisVisible, setJenisVisible] = useState(false)

  const [cabang, setCabang] = useState<Branch | null>(null)
  const [cabangOpsi, setCabangOpsi] = useState<Branch[]>([])
  const [cabangVisible, setCabangVisible] = useState(false)

  const [woList, setWoList] = useState<WorkOrder[]>([])
  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [woVisible, setWoVisible] = useState(false)

  const [lokasi, setLokasi] = useState('')
  const [koordinat, setKoordinat] = useState<Koordinat | null>(null)
  const [ambilLokasiProses, setAmbilLokasiProses] = useState(false)

  const [uraian, setUraian] = useState('')
  const [tindakanSegera, setTindakanSegera] = useState('')
  const [foto, setFoto] = useState<{ uri: string; path?: string }[]>([])

  const [simpanProses, setSimpanProses] = useState(false)

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      try {
        const rows = await list<Branch>('branches', { eq: { company_id: profile.company_id, is_active: true }, order: { col: 'name', asc: true } })
        setCabangOpsi(rows)
        if (employee?.branch_id) setCabang(rows.find((r) => r.id === employee.branch_id) ?? null)
      } catch {
        // opsional, biarkan kosong bila gagal
      }
      try {
        const wos = await list<WorkOrder>('work_orders', {
          eq: { assigned_to: employee?.id },
          in: { status: WO_AKTIF as unknown as string[] },
          order: { col: 'scheduled_at', asc: false },
          limit: 30,
        })
        setWoList(wos)
      } catch {
        // opsional
      }
    })()
  }, [profile, employee?.id, employee?.branch_id])

  const ambilGps = async () => {
    setAmbilLokasiProses(true)
    try {
      const k = await ambilLokasi()
      setKoordinat(k)
    } catch (e: any) {
      Alert.alert('Gagal Mengambil Lokasi', e?.message ?? 'Aktifkan izin lokasi lalu coba lagi.')
    } finally {
      setAmbilLokasiProses(false)
    }
  }

  useEffect(() => {
    ambilGps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tambahFoto = async (dariKamera: boolean) => {
    const izin = dariKamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (izin.status !== 'granted') {
      Alert.alert('Izin ditolak', 'Aktifkan izin yang diperlukan lalu coba lagi.')
      return
    }
    const hasil = dariKamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsMultipleSelection: true })
    if (hasil.canceled || !hasil.assets?.length) return
    setFoto((prev) => [...prev, ...hasil.assets.map((a) => ({ uri: a.uri }))])
  }

  const simpan = async () => {
    if (!profile) return
    if (!jenis) {
      Alert.alert('Jenis belum dipilih', 'Pilih jenis insiden terlebih dahulu.')
      return
    }
    if (!uraian.trim()) {
      Alert.alert('Uraian wajib diisi', 'Jelaskan kronologi insiden secara singkat.')
      return
    }
    setSimpanProses(true)
    try {
      const photoUrls: string[] = []
      for (let i = 0; i < foto.length; i++) {
        const path = await uploadFile(profile.company_id, 'hse_incident', foto[i].uri, `insiden-${i + 1}.jpg`)
        photoUrls.push(path)
      }
      const incidentNo = await nextDocNo(profile.company_id, 'INC')
      const row = await insert('hse_incidents', {
        company_id: profile.company_id,
        incident_no: incidentNo,
        incident_type: jenis.value,
        incident_date: todayISO(),
        branch_id: cabang?.id ?? null,
        work_order_id: wo?.id ?? null,
        employee_id: employee?.id ?? null,
        location: lokasi.trim() || null,
        lat: koordinat?.lat ?? null,
        lng: koordinat?.lng ?? null,
        description: uraian.trim(),
        immediate_action: tindakanSegera.trim() || null,
        photo_urls: photoUrls,
        status: 'dilaporkan',
        reported_by: profile.id,
        created_by: profile.id,
      })
      Alert.alert('Berhasil Dilaporkan', `Insiden ${(row as any).incident_no} berhasil dilaporkan. Tim K3 akan segera menindaklanjuti.`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat menyimpan laporan insiden.')
    } finally {
      setSimpanProses(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Kartu style={{ borderColor: t.bahaya, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="warning" size={20} color={t.bahaya} />
          <Text style={{ color: t.bahaya, fontWeight: '800', fontSize: 15 }}>Formulir Pelaporan Insiden K3</Text>
        </View>
        <Text style={{ color: t.textMuted, fontSize: 14 }}>
          Laporkan sesegera mungkin. Tanggal tercatat otomatis: {tgl(todayISO())}.
        </Text>
      </Kartu>

      <Kartu style={{ gap: 12 }}>
        <FieldPilih label="Jenis Insiden" wajib value={jenis?.label} placeholder="Pilih jenis insiden" onPress={() => setJenisVisible(true)} />
        <FieldPilih label="Cabang" value={cabang?.name} placeholder="Pilih cabang" onPress={() => setCabangVisible(true)} />
        <FieldPilih
          label="Work Order Terkait (opsional)"
          value={wo ? `${wo.wo_no} — ${wo.title ?? wo.customer_name ?? ''}` : undefined}
          placeholder="Tidak terkait WO tertentu"
          onPress={() => setWoVisible(true)}
          onClear={wo ? () => setWo(null) : undefined}
        />
      </Kartu>

      <Kartu style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Lokasi Kejadian</Text>
          <Tombol
            label={ambilLokasiProses ? 'Mengambil...' : 'Ambil Ulang GPS'}
            varian="sekunder"
            loading={ambilLokasiProses}
            onPress={ambilGps}
          />
        </View>
        <Text style={{ color: koordinat ? t.sukses : t.textMuted, fontSize: 13 }}>
          {koordinat ? `Koordinat GPS: ${koordinat.lat.toFixed(6)}, ${koordinat.lng.toFixed(6)}` : 'Koordinat GPS belum tersedia.'}
        </Text>
        <Ladang label="Uraian Lokasi" wajib value={lokasi} onChangeText={setLokasi} placeholder="mis. Tiang 12, Jl. Sudirman" />
      </Kartu>

      <Kartu style={{ gap: 12 }}>
        <Ladang label="Uraian Kejadian" wajib multiline numberOfLines={4} value={uraian} onChangeText={setUraian} placeholder="Jelaskan kronologi kejadian..." />
        <Ladang label="Tindakan Segera Dilakukan" multiline numberOfLines={3} value={tindakanSegera} onChangeText={setTindakanSegera} placeholder="mis. Area diamankan, korban dibawa ke klinik..." />
      </Kartu>

      <Kartu>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Foto Bukti</Text>
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

      <Tombol label="Lapor Insiden" varian="bahaya" onPress={simpan} loading={simpanProses} full />
      <View style={{ height: 24 }} />

      <PilihOpsiModal
        visible={jenisVisible}
        judul="Pilih Jenis Insiden"
        cariAktif={false}
        opsi={JENIS_INSIDEN}
        onClose={() => setJenisVisible(false)}
        onPilih={(o) => {
          setJenis(o)
          setJenisVisible(false)
        }}
      />
      <PilihOpsiModal
        visible={cabangVisible}
        judul="Pilih Cabang"
        opsi={cabangOpsi.map((c) => ({ value: c.id, label: c.name, sub: c.city ?? undefined }))}
        onClose={() => setCabangVisible(false)}
        onPilih={(o) => {
          setCabang(cabangOpsi.find((c) => c.id === o.value) ?? null)
          setCabangVisible(false)
        }}
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

function FieldPilih({
  label,
  wajib,
  value,
  placeholder,
  onPress,
  onClear,
}: {
  label: string
  wajib?: boolean
  value?: string
  placeholder: string
  onPress: () => void
  onClear?: () => void
}) {
  const t = useTheme()
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>
        {label}
        {wajib ? <Text style={{ color: t.bahaya }}> *</Text> : null}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Tombol
            label={value ?? placeholder}
            varian="sekunder"
            onPress={onPress}
            full
            icon={<Ionicons name="chevron-down" size={16} color={t.primary} />}
          />
        </View>
        {onClear ? (
          <Tombol label="" varian="ghost" icon={<Ionicons name="close-circle-outline" size={20} color={t.textMuted} />} onPress={onClear} />
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  gridFoto: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumb: { width: 84, height: 84, borderRadius: RADIUS, borderWidth: 1 },
})
