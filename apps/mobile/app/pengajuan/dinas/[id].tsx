import React, { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import Ladang from '@/components/Ladang'
import Lencana from '@/components/Lencana'
import KesalahanState from '@/components/KesalahanState'
import PilihOpsiModal, { Opsi } from '@/components/PilihOpsiModal'
import { useAuth } from '@/lib/auth'
import { getOne, insert, list, uploadFile } from '@/lib/db'
import { rupiah, tgl, todayISO } from '@/lib/format'
import type { BusinessTrip, TripExpense } from '@/types/db'

const KATEGORI_BIAYA: Opsi[] = [
  { value: 'transportasi', label: 'Transportasi' },
  { value: 'akomodasi', label: 'Akomodasi / Penginapan' },
  { value: 'makan', label: 'Makan & Minum' },
  { value: 'lain_lain', label: 'Lain-lain' },
]

const STATUS_BISA_TAMBAH = ['diajukan', 'disetujui', 'berjalan']

export default function DetailPerjalananDinas() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useTheme()
  const { profile } = useAuth()

  const [trip, setTrip] = useState<BusinessTrip | null>(null)
  const [biaya, setBiaya] = useState<TripExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [kategori, setKategori] = useState<Opsi | null>(null)
  const [kategoriVisible, setKategoriVisible] = useState(false)
  const [deskripsi, setDeskripsi] = useState('')
  const [nominal, setNominal] = useState('')
  const [struk, setStruk] = useState<{ uri: string } | null>(null)
  const [simpanProses, setSimpanProses] = useState(false)

  const muat = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      const [tripRow, biayaRows] = await Promise.all([
        getOne<BusinessTrip>('business_trips', id),
        list<TripExpense>('trip_expenses', { eq: { trip_id: id }, order: { col: 'created_at', asc: false } }),
      ])
      setTrip(tripRow)
      setBiaya(biayaRows)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat detail perjalanan dinas.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useFocusEffect(useCallback(() => { muat() }, [muat]))

  const ambilStruk = async (dariKamera: boolean) => {
    const izin = dariKamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (izin.status !== 'granted') {
      Alert.alert('Izin ditolak', 'Aktifkan izin yang diperlukan lalu coba lagi.')
      return
    }
    const hasil = dariKamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 })
    if (hasil.canceled || !hasil.assets?.length) return
    setStruk({ uri: hasil.assets[0].uri })
  }

  const simpanBiaya = async () => {
    if (!profile || !trip) return
    const jml = Number(nominal)
    if (!kategori) {
      Alert.alert('Kategori belum dipilih', 'Pilih kategori biaya.')
      return
    }
    if (!nominal || isNaN(jml) || jml <= 0) {
      Alert.alert('Nominal tidak valid', 'Masukkan nominal lebih dari 0.')
      return
    }
    setSimpanProses(true)
    try {
      let receiptUrl: string | null = null
      if (struk) {
        receiptUrl = await uploadFile(profile.company_id, 'trip_expense', struk.uri, 'struk.jpg')
      }
      const row = await insert<TripExpense>('trip_expenses', {
        company_id: profile.company_id,
        trip_id: trip.id,
        category: kategori.value,
        description: deskripsi.trim() || null,
        expense_date: todayISO(),
        amount: jml,
        receipt_url: receiptUrl,
        status: 'diajukan',
        created_by: profile.id,
      })
      setBiaya((prev) => [row, ...prev])
      setFormOpen(false)
      setKategori(null)
      setDeskripsi('')
      setNominal('')
      setStruk(null)
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat menyimpan biaya.')
    } finally {
      setSimpanProses(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} size="large" />
      </View>
    )
  }
  if (error || !trip) {
    return <KesalahanState pesan={error || 'Perjalanan dinas tidak ditemukan.'} onCoba={muat} />
  }

  const totalBiaya = biaya.reduce((s, b) => s + Number(b.amount), 0)
  const bisaTambah = STATUS_BISA_TAMBAH.includes(trip.status)

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Kartu style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: t.primary, fontWeight: '800', fontSize: 16 }}>{trip.sppd_no}</Text>
          <Lencana>{trip.status}</Lencana>
        </View>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 17 }}>{trip.destination ?? '-'}</Text>
        <Text style={{ color: t.textMuted, fontSize: 14 }}>{trip.purpose ?? '-'}</Text>
        <Text style={{ color: t.textMuted, fontSize: 13 }}>{tgl(trip.start_date)} — {tgl(trip.end_date)}</Text>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 4 }}>
          <View>
            <Text style={{ color: t.textMuted, fontSize: 12 }}>Uang Harian</Text>
            <Text style={{ color: t.text, fontWeight: '700' }}>{rupiah(trip.daily_allowance)}</Text>
          </View>
          <View>
            <Text style={{ color: t.textMuted, fontSize: 12 }}>Uang Muka</Text>
            <Text style={{ color: t.text, fontWeight: '700' }}>{rupiah(trip.total_advance)}</Text>
          </View>
        </View>
      </Kartu>

      <Kartu style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Biaya Perjalanan</Text>
          <Text style={{ color: t.text, fontWeight: '800' }}>{rupiah(totalBiaya)}</Text>
        </View>
        {!bisaTambah ? (
          <Text style={{ color: t.textMuted, fontSize: 13 }}>Biaya hanya dapat ditambahkan selama perjalanan berjalan.</Text>
        ) : null}
      </Kartu>

      {bisaTambah ? (
        !formOpen ? (
          <Tombol label="Tambah Biaya" onPress={() => setFormOpen(true)} full />
        ) : (
          <Kartu style={{ gap: 12 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>
                Kategori<Text style={{ color: t.bahaya }}> *</Text>
              </Text>
              <Tombol
                label={kategori?.label ?? 'Pilih kategori biaya'}
                varian="sekunder"
                onPress={() => setKategoriVisible(true)}
                full
                icon={<Ionicons name="chevron-down" size={16} color={t.primary} />}
              />
            </View>
            <Ladang label="Keterangan" value={deskripsi} onChangeText={setDeskripsi} placeholder="mis. Taksi bandara ke hotel" />
            <Ladang label="Nominal (Rp)" wajib keyboardType="numeric" value={nominal} onChangeText={setNominal} placeholder="0" />
            <View>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '600', marginBottom: 8 }}>Foto Struk</Text>
              {struk ? <Image source={{ uri: struk.uri }} style={[styles.thumb, { borderColor: t.border }]} /> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Tombol label="Kamera" icon={<Ionicons name="camera-outline" size={18} color={t.primary} />} varian="sekunder" onPress={() => ambilStruk(true)} full />
                </View>
                <View style={{ flex: 1 }}>
                  <Tombol label="Galeri" icon={<Ionicons name="images-outline" size={18} color={t.primary} />} varian="sekunder" onPress={() => ambilStruk(false)} full />
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Tombol label="Batal" varian="sekunder" onPress={() => setFormOpen(false)} full />
              </View>
              <View style={{ flex: 1 }}>
                <Tombol label="Simpan" onPress={simpanBiaya} loading={simpanProses} full />
              </View>
            </View>
          </Kartu>
        )
      ) : null}

      <View style={{ gap: 10 }}>
        {biaya.map((b) => (
          <Kartu key={b.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>
                {KATEGORI_BIAYA.find((k) => k.value === b.category)?.label ?? b.category ?? '-'}
              </Text>
              <Lencana>{b.status}</Lencana>
            </View>
            {b.description ? <Text style={{ color: t.textMuted, fontSize: 14 }}>{b.description}</Text> : null}
            <Text style={{ color: t.text, fontWeight: '700' }}>{rupiah(b.amount)}</Text>
            <Text style={{ color: t.textMuted, fontSize: 12 }}>{tgl(b.expense_date)}</Text>
          </Kartu>
        ))}
      </View>

      <PilihOpsiModal
        visible={kategoriVisible}
        judul="Pilih Kategori Biaya"
        cariAktif={false}
        opsi={KATEGORI_BIAYA}
        onClose={() => setKategoriVisible(false)}
        onPilih={(o) => {
          setKategori(o)
          setKategoriVisible(false)
        }}
      />
      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 100, height: 100, borderRadius: RADIUS, borderWidth: 1 },
})
