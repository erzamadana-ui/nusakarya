import React, { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import Lencana from '@/components/Lencana'
import Ladang from '@/components/Ladang'
import KesalahanState from '@/components/KesalahanState'
import PilihItemModal from '@/components/PilihItemModal'
import PindaiBarcodeModal from '@/components/PindaiBarcodeModal'
import SignaturePad, { SignaturePadHandle } from '@/components/SignaturePad'
import { useAuth } from '@/lib/auth'
import supabase from '@/lib/supabase'
import { getOne, insert, list, nextDocNo, signedUrl, update, uploadFile } from '@/lib/db'
import { ambilLokasi, bukaGoogleMaps } from '@/lib/location'
import { num, todayISO, tglJam } from '@/lib/format'
import type { Attachment, Bast, ItemCatalog, MaterialUsage, PunchList, Serial, WoChecklist, WorkOrder } from '@/types/db'

const LANGKAH = ['ditugaskan', 'diterima', 'berjalan', 'selesai']
const JENIS_LABEL: Record<string, string> = {
  instalasi: 'Instalasi',
  assurance: 'Assurance',
  maintenance: 'Maintenance',
  survey: 'Survey',
  pasang_baru: 'Pasang Baru',
}

export default function DetailWorkOrder() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useTheme()
  const router = useRouter()
  const { profile, employee } = useAuth()
  const sigRef = useRef<SignaturePadHandle>(null)

  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [checklist, setChecklist] = useState<WoChecklist[]>([])
  const [evidence, setEvidence] = useState<Attachment[]>([])
  const [evidenceUrl, setEvidenceUrl] = useState<Record<string, string>>({})
  const [material, setMaterial] = useState<MaterialUsage[]>([])
  const [items, setItems] = useState<ItemCatalog[]>([])
  const [serials, setSerials] = useState<Serial[]>([])
  const [bast, setBast] = useState<Bast | null>(null)
  const [punchLists, setPunchLists] = useState<PunchList[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [aksiProses, setAksiProses] = useState(false)
  const [gagalMode, setGagalMode] = useState(false)
  const [alasanGagal, setAlasanGagal] = useState('')

  const [pilihItemVisible, setPilihItemVisible] = useState(false)
  const [itemTerpilih, setItemTerpilih] = useState<ItemCatalog | null>(null)
  const [qtyInput, setQtyInput] = useState('')
  const [materialProses, setMaterialProses] = useState(false)
  const [pindaiVisible, setPindaiVisible] = useState(false)
  const [serialInput, setSerialInput] = useState('')
  const [serialProses, setSerialProses] = useState(false)

  const [signerName, setSignerName] = useState('')
  const [signerPosition, setSignerPosition] = useState('')
  const [bastProses, setBastProses] = useState(false)

  const muat = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      const [woRow, cl, ev, mu, it, sr, bastRows] = await Promise.all([
        getOne<WorkOrder>('work_orders', id),
        list<WoChecklist>('wo_checklists', { eq: { work_order_id: id }, order: { col: 'seq', asc: true } }),
        list<Attachment>('attachments', { eq: { entity_type: 'work_order', entity_id: id }, order: { col: 'created_at', asc: false } }),
        list<MaterialUsage>('material_usages', { eq: { work_order_id: id }, order: { col: 'reported_at', asc: false } }),
        profile ? list<ItemCatalog>('item_catalog', { eq: { company_id: profile.company_id, is_active: true }, order: { col: 'name', asc: true }, limit: 300 }) : Promise.resolve([]),
        list<Serial>('serials', { eq: { work_order_id: id } }),
        list<Bast>('bast', { eq: { work_order_id: id }, order: { col: 'created_at', asc: false }, limit: 1 }),
      ])
      setWo(woRow)
      setChecklist(cl)
      setEvidence(ev)
      setMaterial(mu)
      setItems(it)
      setSerials(sr)
      setBast(bastRows[0] ?? null)
      setSignerName(woRow?.customer_name ?? '')

      if (woRow?.project_id && employee?.id) {
        list<PunchList>('punch_lists', { eq: { project_id: woRow.project_id, assigned_to: employee.id }, order: { col: 'due_date', asc: true } })
          .then(setPunchLists)
          .catch(() => setPunchLists([]))
      } else {
        setPunchLists([])
      }

      const urls: Record<string, string> = {}
      await Promise.all(
        ev.map(async (a) => {
          urls[a.id] = (await signedUrl(a.file_url)) ?? ''
        })
      )
      setEvidenceUrl(urls)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat detail Work Order.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id, profile, employee?.id])

  useFocusEffect(
    useCallback(() => {
      muat()
    }, [muat])
  )

  // ---------- Aksi status ----------
  const ubahStatus = async (values: Partial<WorkOrder>) => {
    if (!wo) return
    setAksiProses(true)
    try {
      const row = await update<WorkOrder>('work_orders', wo.id, values)
      setWo(row)
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat memperbarui status Work Order.')
    } finally {
      setAksiProses(false)
    }
  }

  const terima = () => ubahStatus({ status: 'diterima', assigned_at: wo?.assigned_at ?? new Date().toISOString() })
  const mulai = () => ubahStatus({ status: 'berjalan', started_at: new Date().toISOString() })

  const checklistBelumLengkap = checklist.filter((c) => c.is_mandatory && !isiKosong(c))
  const evidenceKurang = Math.max(0, 2 - evidence.length)

  const selesaikan = () => {
    if (checklistBelumLengkap.length > 0 || evidenceKurang > 0) {
      const pesan = [
        checklistBelumLengkap.length > 0 ? `${checklistBelumLengkap.length} checklist wajib belum diisi` : '',
        evidenceKurang > 0 ? `${evidenceKurang} foto evidence lagi dibutuhkan (minimal 2)` : '',
      ]
        .filter(Boolean)
        .join('; ')
      Alert.alert('Belum Bisa Diselesaikan', pesan)
      return
    }
    Alert.alert('Selesaikan Work Order?', 'Pastikan seluruh pekerjaan sudah benar sebelum menyelesaikan.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Selesaikan',
        onPress: () => {
          const mulaiMs = wo?.started_at ? new Date(wo.started_at).getTime() : Date.now()
          ubahStatus({
            status: 'selesai',
            finished_at: new Date().toISOString(),
            duration_minutes: Math.max(0, Math.round((Date.now() - mulaiMs) / 60000)),
          })
        },
      },
    ])
  }

  const kirimGagal = () => {
    if (!alasanGagal.trim()) {
      Alert.alert('Alasan wajib diisi', 'Isi alasan kegagalan pekerjaan.')
      return
    }
    ubahStatus({ status: 'gagal', fail_reason: alasanGagal.trim(), finished_at: new Date().toISOString() }).then(() => {
      setGagalMode(false)
      setAlasanGagal('')
    })
  }

  // ---------- Checklist ----------
  const simpanChecklistTeks = async (item: WoChecklist, value: string) => {
    try {
      const row = await update<WoChecklist>('wo_checklists', item.id, { answer_value: value })
      setChecklist((prev) => prev.map((c) => (c.id === item.id ? row : c)))
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat menyimpan jawaban.')
    }
  }

  const simpanChecklistBoolean = async (item: WoChecklist, value: boolean) => {
    try {
      const row = await update<WoChecklist>('wo_checklists', item.id, { answer_value: value ? 'ya' : 'tidak', is_passed: value })
      setChecklist((prev) => prev.map((c) => (c.id === item.id ? row : c)))
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat menyimpan jawaban.')
    }
  }

  const isiFotoChecklist = async (item: WoChecklist) => {
    if (!profile) return
    try {
      const hasil = await ImagePicker.launchCameraAsync({ quality: 0.6 })
      if (hasil.canceled || !hasil.assets?.length) return
      const path = await uploadFile(profile.company_id, 'wo_checklist', hasil.assets[0].uri, `checklist-${item.seq}.jpg`)
      const row = await update<WoChecklist>('wo_checklists', item.id, { photo_url: path, answer_value: 'terisi' })
      setChecklist((prev) => prev.map((c) => (c.id === item.id ? row : c)))
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat mengunggah foto checklist.')
    }
  }

  const tandaTanganChecklist = async (item: WoChecklist, ref: SignaturePadHandle | null) => {
    if (!profile || !ref) return
    if (ref.isEmpty()) {
      Alert.alert('Kanvas kosong', 'Mohon tanda tangan terlebih dahulu.')
      return
    }
    try {
      const uri = await ref.capture()
      const path = await uploadFile(profile.company_id, 'wo_checklist', uri, `ttd-${item.seq}.png`, 'image/png')
      const row = await update<WoChecklist>('wo_checklists', item.id, { photo_url: path, answer_value: 'ditandatangani' })
      setChecklist((prev) => prev.map((c) => (c.id === item.id ? row : c)))
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat menyimpan tanda tangan.')
    }
  }

  // ---------- Foto evidence ----------
  const tambahEvidence = async (dariKamera: boolean) => {
    if (!profile || !wo) return
    try {
      const izinKamera = dariKamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (izinKamera.status !== 'granted') {
        Alert.alert('Izin ditolak', 'Aktifkan izin yang diperlukan lalu coba lagi.')
        return
      }
      const hasil = dariKamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 })
      if (hasil.canceled || !hasil.assets?.length) return
      const lokasi = await ambilLokasi().catch(() => null)
      const path = await uploadFile(profile.company_id, 'wo_evidence', hasil.assets[0].uri, 'evidence.jpg')
      const row = await insert<Attachment>('attachments', {
        company_id: profile.company_id,
        entity_type: 'work_order',
        entity_id: wo.id,
        file_name: `evidence-${Date.now()}.jpg`,
        file_url: path,
        mime_type: 'image/jpeg',
        lat: lokasi?.lat ?? null,
        lng: lokasi?.lng ?? null,
        taken_at: new Date().toISOString(),
        uploaded_by: profile.id,
      })
      const url = await signedUrl(path)
      setEvidence((prev) => [row, ...prev])
      setEvidenceUrl((prev) => ({ ...prev, [row.id]: url ?? '' }))
      await update('work_orders', wo.id, { evidence_count: evidence.length + 1 })
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat mengunggah foto evidence.')
    }
  }

  // ---------- Material ----------
  const pilihMaterial = (item: ItemCatalog) => {
    setPilihItemVisible(false)
    setItemTerpilih(item)
    setQtyInput('')
  }

  const simpanMaterial = async () => {
    if (!profile || !wo || !itemTerpilih) return
    const qty = Number(qtyInput)
    if (!qtyInput || isNaN(qty) || qty <= 0) {
      Alert.alert('Qty tidak valid', 'Masukkan angka lebih dari 0.')
      return
    }
    setMaterialProses(true)
    try {
      const row = await insert<MaterialUsage>('material_usages', {
        company_id: profile.company_id,
        work_order_id: wo.id,
        project_id: wo.project_id,
        item_id: itemTerpilih.id,
        qty_actual: qty,
        qty_plan: 0,
        reported_by: profile.id,
        reported_at: new Date().toISOString(),
      })
      setMaterial((prev) => [row, ...prev])
      setItemTerpilih(null)
      setQtyInput('')
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat menyimpan pemakaian material.')
    } finally {
      setMaterialProses(false)
    }
  }

  // ---------- Serial NTE ----------
  const pasangSerial = async (kode: string) => {
    if (!profile || !wo || !employee) return
    const serialNo = kode.trim()
    if (!serialNo) return
    setSerialProses(true)
    try {
      const { data: found, error: err } = await supabase
        .from('serials')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('serial_no', serialNo)
        .maybeSingle()
      if (err) throw err
      if (!found) {
        Alert.alert('Tidak Ditemukan', `Nomor seri "${serialNo}" tidak ditemukan di data master inventory.`)
        return
      }
      const dariStatus = (found as Serial).status
      const updated = await update<Serial>('serials', (found as Serial).id, {
        status: 'installed',
        work_order_id: wo.id,
        holder_employee_id: employee.id,
        install_date: todayISO(),
      })
      await insert('serial_movements', {
        company_id: profile.company_id,
        serial_id: (found as Serial).id,
        move_type: 'install',
        from_status: dariStatus,
        to_status: 'installed',
        to_employee_id: employee.id,
        ref_type: 'work_order',
        ref_id: wo.id,
        moved_by: profile.id,
        moved_at: new Date().toISOString(),
      })
      setSerials((prev) => [updated, ...prev.filter((s) => s.id !== updated.id)])
      setSerialInput('')
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat memproses nomor seri.')
    } finally {
      setSerialProses(false)
    }
  }

  // ---------- BAST / tanda tangan ----------
  const simpanBast = async () => {
    if (!profile || !wo) return
    if (!signerName.trim() || !signerPosition.trim()) {
      Alert.alert('Data belum lengkap', 'Nama dan jabatan penanda tangan wajib diisi.')
      return
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      Alert.alert('Tanda tangan kosong', 'Mohon minta pelanggan menandatangani kanvas.')
      return
    }
    setBastProses(true)
    try {
      const { data: cust } = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', profile.company_id)
        .ilike('name', `%${wo.customer_name ?? ''}%`)
        .limit(1)
        .maybeSingle()
      if (!cust) {
        Alert.alert(
          'Pelanggan Tidak Ditemukan',
          'Data pelanggan pada Work Order ini belum ada di master Pelanggan. Hubungi admin sebelum menyimpan BAST.'
        )
        return
      }
      const lokasi = await ambilLokasi().catch(() => null)
      const uri = await sigRef.current.capture()
      const path = await uploadFile(profile.company_id, 'bast', uri, 'ttd-pelanggan.png', 'image/png')
      const bastNo = await nextDocNo(profile.company_id, 'BAST')
      const row = await insert<Bast>('bast', {
        company_id: profile.company_id,
        bast_no: bastNo,
        bast_date: todayISO(),
        work_order_id: wo.id,
        project_id: wo.project_id,
        customer_id: (cust as any).id,
        title: `BAST ${wo.wo_no}`,
        scope: wo.title ?? wo.description ?? '-',
        signed_by_customer: true,
        signer_name: signerName.trim(),
        signer_position: signerPosition.trim(),
        signature_url: path,
        geotag_lat: lokasi?.lat ?? null,
        geotag_lng: lokasi?.lng ?? null,
        status: 'final',
      })
      setBast(row)
      Alert.alert('Berhasil', `BAST ${row.bast_no} berhasil disimpan.`)
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat menyimpan BAST.')
    } finally {
      setBastProses(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} size="large" />
      </View>
    )
  }
  if (error && !wo) {
    return <KesalahanState pesan={error} onCoba={muat} />
  }
  if (!wo) {
    return <KesalahanState pesan="Work Order tidak ditemukan." onCoba={muat} />
  }

  const langkahAktif = wo.status === 'gagal' ? -1 : LANGKAH.indexOf(wo.status)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
    >
      <Kartu style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ color: t.primary, fontWeight: '800', fontSize: 16 }}>{wo.wo_no}</Text>
          <Lencana>{wo.status}</Lencana>
        </View>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 17 }}>
          {JENIS_LABEL[wo.wo_type] ?? wo.wo_type} — {wo.title ?? '-'}
        </Text>
        {wo.description ? <Text style={{ color: t.textMuted, fontSize: 14 }}>{wo.description}</Text> : null}

        <View style={[styles.divider, { backgroundColor: t.border }]} />
        <Baris t={t} label="Pelanggan" value={wo.customer_name ?? '-'} />
        <Baris t={t} label="No. Pelanggan" value={wo.customer_no ?? '-'} />
        <Baris t={t} label="Alamat" value={wo.address ?? '-'} />
        <Baris t={t} label="Jadwal" value={tglJam(wo.scheduled_at)} />

        {wo.lat != null && wo.lng != null ? (
          <View style={{ marginTop: 6 }}>
            <Tombol
              label="Buka di Google Maps"
              varian="sekunder"
              icon={<Ionicons name="navigate-outline" size={18} color={t.primary} />}
              onPress={() => {
                const url = bukaGoogleMaps(wo.lat, wo.lng, wo.address ?? undefined)
                if (url) Linking.openURL(url)
              }}
            />
          </View>
        ) : null}
      </Kartu>

      <Kartu>
        <Text style={[styles.judulKartu, { color: t.text }]}>Status Pekerjaan</Text>
        <View style={styles.stepperRow}>
          {LANGKAH.map((s, i) => {
            const tercapai = wo.status === 'selesai' ? true : wo.status === 'gagal' ? i === 0 : i <= langkahAktif
            return (
              <React.Fragment key={s}>
                <View style={styles.stepDotWrap}>
                  <View style={[styles.stepDot, { backgroundColor: tercapai ? t.primary : t.border }]} />
                  <Text style={[styles.stepLabel, { color: tercapai ? t.text : t.textMuted }]} numberOfLines={1}>
                    {s}
                  </Text>
                </View>
                {i < LANGKAH.length - 1 ? <View style={[styles.stepLine, { backgroundColor: tercapai ? t.primary : t.border }]} /> : null}
              </React.Fragment>
            )
          })}
        </View>
        {wo.status === 'gagal' ? (
          <View style={{ marginTop: 10 }}>
            <Lencana>gagal</Lencana>
            <Text style={{ color: t.textMuted, marginTop: 6, fontSize: 14 }}>Alasan: {wo.fail_reason ?? '-'}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 14, gap: 10 }}>
          {(wo.status === 'draft' || wo.status === 'ditugaskan') && (
            <Tombol label="Terima Work Order" onPress={terima} loading={aksiProses} full />
          )}
          {wo.status === 'diterima' && <Tombol label="Mulai Pekerjaan" onPress={mulai} loading={aksiProses} full />}
          {wo.status === 'berjalan' && !gagalMode && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Tombol label="Selesai" onPress={selesaikan} loading={aksiProses} full />
              </View>
              <View style={{ flex: 1 }}>
                <Tombol label="Gagal" varian="bahaya" onPress={() => setGagalMode(true)} full />
              </View>
            </View>
          )}
          {wo.status === 'berjalan' && gagalMode && (
            <View style={{ gap: 10 }}>
              <Ladang label="Alasan Kegagalan" wajib multiline value={alasanGagal} onChangeText={setAlasanGagal} placeholder="Jelaskan kendala di lapangan..." />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Tombol label="Batal" varian="sekunder" onPress={() => setGagalMode(false)} full />
                </View>
                <View style={{ flex: 1 }}>
                  <Tombol label="Kirim" varian="bahaya" onPress={kirimGagal} loading={aksiProses} full />
                </View>
              </View>
            </View>
          )}
        </View>
      </Kartu>

      <Kartu>
        <Text style={[styles.judulKartu, { color: t.text }]}>Checklist Pekerjaan</Text>
        {checklist.length === 0 ? (
          <Text style={{ color: t.textMuted, marginTop: 8 }}>Tidak ada item checklist untuk WO ini.</Text>
        ) : (
          <View style={{ gap: 14, marginTop: 10 }}>
            {checklist.map((c) => (
              <ItemChecklist
                key={c.id}
                item={c}
                onSimpanTeks={(v) => simpanChecklistTeks(c, v)}
                onSimpanBoolean={(v) => simpanChecklistBoolean(c, v)}
                onFoto={() => isiFotoChecklist(c)}
                onSimpanTtd={(ref) => tandaTanganChecklist(c, ref)}
              />
            ))}
          </View>
        )}
      </Kartu>

      <Kartu>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.judulKartu, { color: t.text }]}>Foto Evidence</Text>
          <Text style={{ color: evidence.length >= 2 ? t.sukses : t.bahaya, fontWeight: '700', fontSize: 13 }}>
            {evidence.length}/2 minimal
          </Text>
        </View>
        <View style={styles.gridFoto}>
          {evidence.map((a) => (
            <Image key={a.id} source={{ uri: evidenceUrl[a.id] }} style={[styles.thumb, { borderColor: t.border }]} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Tombol label="Kamera" icon={<Ionicons name="camera-outline" size={18} color={t.primary} />} varian="sekunder" onPress={() => tambahEvidence(true)} full />
          </View>
          <View style={{ flex: 1 }}>
            <Tombol label="Galeri" icon={<Ionicons name="images-outline" size={18} color={t.primary} />} varian="sekunder" onPress={() => tambahEvidence(false)} full />
          </View>
        </View>
      </Kartu>

      <Kartu>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.judulKartu, { color: t.text }]}>Pemakaian Material</Text>
          <Tombol label="Tambah" onPress={() => setPilihItemVisible(true)} varian="sekunder" />
        </View>
        {material.length === 0 ? (
          <Text style={{ color: t.textMuted, marginTop: 8 }}>Belum ada material dicatat.</Text>
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            {material.map((m) => {
              const it = items.find((i) => i.id === m.item_id)
              return (
                <View key={m.id} style={[styles.baris2, { borderColor: t.border }]}>
                  <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>{it?.name ?? m.item_id}</Text>
                  <Text style={{ color: t.textMuted }}>
                    {num(m.qty_actual)} {it?.uom ?? ''}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
        {itemTerpilih ? (
          <View style={[styles.checklistBox, { borderColor: t.primary, marginTop: 12, gap: 10 }]}>
            <Text style={{ color: t.text, fontWeight: '700' }}>
              {itemTerpilih.name} ({itemTerpilih.uom ?? '-'})
            </Text>
            <Ladang label="Qty Pemakaian" wajib keyboardType="numeric" value={qtyInput} onChangeText={setQtyInput} placeholder="0" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Tombol label="Batal" varian="sekunder" onPress={() => setItemTerpilih(null)} full />
              </View>
              <View style={{ flex: 1 }}>
                <Tombol label="Simpan" onPress={simpanMaterial} loading={materialProses} full />
              </View>
            </View>
          </View>
        ) : null}
      </Kartu>

      <Kartu>
        <Text style={[styles.judulKartu, { color: t.text }]}>Nomor Seri NTE</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Ladang label="Nomor Seri" value={serialInput} onChangeText={setSerialInput} placeholder="Masukkan / pindai nomor seri" autoCapitalize="characters" />
          </View>
          <Tombol label="" icon={<Ionicons name="scan-outline" size={20} color={t.primary} />} varian="sekunder" onPress={() => setPindaiVisible(true)} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Tombol label="Cari & Pasang" onPress={() => pasangSerial(serialInput)} loading={serialProses} full />
        </View>
        {serials.length > 0 ? (
          <View style={{ gap: 8, marginTop: 14 }}>
            {serials.map((s) => (
              <View key={s.id} style={[styles.baris2, { borderColor: t.border }]}>
                <Text style={{ color: t.text, fontWeight: '600' }}>{s.serial_no}</Text>
                <Lencana>{s.status}</Lencana>
              </View>
            ))}
          </View>
        ) : null}
      </Kartu>

      <Kartu>
        <Text style={[styles.judulKartu, { color: t.text }]}>Tanda Tangan Pelanggan (BAST)</Text>
        {bast ? (
          <View style={{ marginTop: 10 }}>
            <Lencana>{bast.status}</Lencana>
            <Text style={{ color: t.textMuted, marginTop: 6 }}>
              {bast.bast_no} ditandatangani oleh {bast.signer_name} ({bast.signer_position})
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 10 }}>
            <Ladang label="Nama Penanda Tangan" wajib value={signerName} onChangeText={setSignerName} />
            <Ladang label="Jabatan" wajib value={signerPosition} onChangeText={setSignerPosition} placeholder="mis. Pemilik Rumah / PIC" />
            <Text style={{ color: t.textMuted, fontSize: 14 }}>Minta pelanggan menandatangani di area berikut:</Text>
            <SignaturePad ref={sigRef} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Tombol label="Bersihkan" varian="sekunder" onPress={() => sigRef.current?.clear()} full />
              </View>
              <View style={{ flex: 1 }}>
                <Tombol label="Simpan BAST" onPress={simpanBast} loading={bastProses} full />
              </View>
            </View>
          </View>
        )}
      </Kartu>

      {punchLists.length > 0 ? (
        <Kartu>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.judulKartu, { color: t.text }]}>Punch List Terkait</Text>
            <Tombol label="Kelola" varian="sekunder" onPress={() => router.push('/punch-list')} />
          </View>
          <View style={{ gap: 8, marginTop: 10 }}>
            {punchLists.map((p) => (
              <View key={p.id} style={[styles.baris2, { borderColor: t.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '600' }}>{p.punch_no} — {p.category ?? 'Temuan'}</Text>
                  <Text style={{ color: t.textMuted, fontSize: 13 }} numberOfLines={1}>{p.description ?? '-'}</Text>
                </View>
                <Lencana>{p.status}</Lencana>
              </View>
            ))}
          </View>
        </Kartu>
      ) : null}

      <PilihItemModal visible={pilihItemVisible} items={items} onClose={() => setPilihItemVisible(false)} onPilih={pilihMaterial} />
      <PindaiBarcodeModal
        visible={pindaiVisible}
        onClose={() => setPindaiVisible(false)}
        onScanned={(kode) => {
          setPindaiVisible(false)
          setSerialInput(kode)
          pasangSerial(kode)
        }}
      />
      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

function isiKosong(c: WoChecklist) {
  if (c.answer_type === 'photo' || c.answer_type === 'signature') return !c.photo_url
  return !c.answer_value || c.answer_value.trim() === ''
}

function Baris({ t, label, value }: { t: ReturnType<typeof useTheme>; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ color: t.textMuted, fontSize: 14, width: 110 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 14, flex: 1, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

function ItemChecklist({
  item,
  onSimpanTeks,
  onSimpanBoolean,
  onFoto,
  onSimpanTtd,
}: {
  item: WoChecklist
  onSimpanTeks: (v: string) => void
  onSimpanBoolean: (v: boolean) => void
  onFoto: () => void
  onSimpanTtd: (ref: SignaturePadHandle | null) => void
}) {
  const t = useTheme()
  const [teks, setTeks] = useState(item.answer_value ?? '')
  const localSigRef = useRef<SignaturePadHandle>(null)
  const kosong = isiKosong(item)

  return (
    <View style={[styles.checklistBox, { borderColor: kosong && item.is_mandatory ? t.bahaya : t.border }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: t.text, fontWeight: '600', flex: 1, fontSize: 15 }}>
          {item.seq}. {item.question}
          {item.is_mandatory ? <Text style={{ color: t.bahaya }}> *</Text> : null}
        </Text>
      </View>

      {item.answer_type === 'boolean' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <Switch value={item.answer_value === 'ya'} onValueChange={onSimpanBoolean} trackColor={{ true: t.primary }} />
          <Text style={{ color: t.textMuted }}>{item.answer_value === 'ya' ? 'Ya' : item.answer_value === 'tidak' ? 'Tidak' : 'Belum diisi'}</Text>
        </View>
      )}

      {(item.answer_type === 'text' || item.answer_type === 'number') && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TextInput
            value={teks}
            onChangeText={setTeks}
            onBlur={() => onSimpanTeks(teks)}
            keyboardType={item.answer_type === 'number' ? 'numeric' : 'default'}
            placeholder="Isi jawaban..."
            placeholderTextColor={t.textMuted}
            style={[styles.checklistInput, { borderColor: t.border, color: t.text, backgroundColor: t.card }]}
          />
        </View>
      )}

      {item.answer_type === 'photo' && (
        <View style={{ marginTop: 8 }}>
          <Tombol
            label={item.photo_url ? 'Foto Tersimpan — Ambil Ulang' : 'Ambil Foto'}
            varian="sekunder"
            icon={<Ionicons name="camera-outline" size={18} color={t.primary} />}
            onPress={onFoto}
          />
        </View>
      )}

      {item.answer_type === 'signature' && (
        <View style={{ marginTop: 8, gap: 8 }}>
          {item.photo_url ? (
            <Text style={{ color: t.sukses, fontWeight: '600' }}>Sudah ditandatangani</Text>
          ) : (
            <>
              <SignaturePad ref={localSigRef} height={140} />
              <Tombol label="Simpan Tanda Tangan" varian="sekunder" onPress={() => onSimpanTtd(localSigRef.current)} />
            </>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginVertical: 4 },
  judulKartu: { fontSize: 16, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  stepDotWrap: { alignItems: 'center', width: 60 },
  stepDot: { width: 16, height: 16, borderRadius: 8 },
  stepLabel: { fontSize: 11, marginTop: 4, textTransform: 'capitalize', textAlign: 'center' },
  stepLine: { flex: 1, height: 2, marginBottom: 16 },
  gridFoto: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumb: { width: 84, height: 84, borderRadius: RADIUS, borderWidth: 1 },
  baris2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: RADIUS, padding: 10 },
  checklistBox: { borderWidth: 1, borderRadius: RADIUS, padding: 12 },
  checklistInput: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 12, fontSize: 16 },
})
