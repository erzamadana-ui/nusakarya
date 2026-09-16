import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import Ladang from '@/components/Ladang'
import Lencana from '@/components/Lencana'
import KosongState from '@/components/KosongState'
import KesalahanState from '@/components/KesalahanState'
import PilihOpsiModal, { Opsi } from '@/components/PilihOpsiModal'
import { useAuth } from '@/lib/auth'
import { insert, list, nextDocNo } from '@/lib/db'
import { num, rupiah, tgl, todayISO } from '@/lib/format'
import type { BusinessTrip, EmployeeAdvance, OvertimeRequest, WorkOrder } from '@/types/db'

type TabKey = 'lembur' | 'dinas' | 'kasbon'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'lembur', label: 'Lembur' },
  { key: 'dinas', label: 'Dinas & Biaya' },
  { key: 'kasbon', label: 'Kasbon' },
]

export default function PengajuanSaya() {
  const t = useTheme()
  const [tab, setTab] = useState<TabKey>('lembur')

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.tabBar, { backgroundColor: t.card, borderColor: t.border }]}>
        {TABS.map((tb) => {
          const aktif = tab === tb.key
          return (
            <Pressable key={tb.key} onPress={() => setTab(tb.key)} style={[styles.tabItem, aktif && { backgroundColor: t.primary }]}>
              <Text style={[styles.tabLabel, { color: aktif ? '#FFFFFF' : t.textMuted }]}>{tb.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {tab === 'lembur' ? <TabLembur /> : tab === 'dinas' ? <TabDinas /> : <TabKasbon />}
    </View>
  )
}

// ============================= LEMBUR =============================
function TabLembur() {
  const t = useTheme()
  const { profile, employee } = useAuth()
  const [data, setData] = useState<OvertimeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const [woList, setWoList] = useState<WorkOrder[]>([])
  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [woVisible, setWoVisible] = useState(false)
  const [jamMulai, setJamMulai] = useState('18:00')
  const [jamSelesai, setJamSelesai] = useState('20:00')
  const [alasan, setAlasan] = useState('')
  const [simpanProses, setSimpanProses] = useState(false)

  const muat = useCallback(async () => {
    if (!employee?.id) {
      setLoading(false)
      return
    }
    setError('')
    try {
      const rows = await list<OvertimeRequest>('overtime_requests', { eq: { employee_id: employee.id }, order: { col: 'created_at', asc: false }, limit: 100 })
      setData(rows)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat pengajuan lembur.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [employee?.id])

  useFocusEffect(useCallback(() => { muat() }, [muat]))

  useEffect(() => {
    if (!employee?.id) return
    list<WorkOrder>('work_orders', { eq: { assigned_to: employee.id }, order: { col: 'scheduled_at', asc: false }, limit: 30 })
      .then(setWoList)
      .catch(() => {})
  }, [employee?.id])

  const parseJam = (jam: string, tambahHari = 0) => {
    const m = jam.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const d = new Date(`${todayISO()}T00:00:00`)
    d.setDate(d.getDate() + tambahHari)
    d.setHours(Number(m[1]), Number(m[2]), 0, 0)
    return d
  }

  const simpan = async () => {
    if (!profile || !employee) return
    const mulai = parseJam(jamMulai)
    let selesai = parseJam(jamSelesai)
    if (!mulai || !selesai) {
      Alert.alert('Jam tidak valid', 'Gunakan format HH:mm, mis. 18:00.')
      return
    }
    if (selesai.getTime() <= mulai.getTime()) {
      selesai = parseJam(jamSelesai, 1) // dianggap lembur menyeberang tengah malam
    }
    if (!alasan.trim()) {
      Alert.alert('Alasan wajib diisi', 'Jelaskan alasan pengajuan lembur.')
      return
    }
    setSimpanProses(true)
    try {
      const jam = Math.round(((selesai!.getTime() - mulai.getTime()) / 3600000) * 100) / 100
      const splNo = await nextDocNo(profile.company_id, 'SPL')
      const row = await insert('overtime_requests', {
        company_id: profile.company_id,
        spl_no: splNo,
        employee_id: employee.id,
        work_order_id: wo?.id ?? null,
        work_date: todayISO(),
        start_at: mulai.toISOString(),
        end_at: selesai!.toISOString(),
        hours: jam,
        reason: alasan.trim(),
        status: 'diajukan',
        created_by: profile.id,
      })
      setData((prev) => [row as OvertimeRequest, ...prev])
      setFormOpen(false)
      setAlasan('')
      setWo(null)
      Alert.alert('Berhasil', `Pengajuan lembur ${(row as any).spl_no} berhasil diajukan.`)
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat mengajukan lembur.')
    } finally {
      setSimpanProses(false)
    }
  }

  return (
    <>
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
      data={data}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          {!formOpen ? (
            <Pressable onPress={() => setFormOpen(true)} style={[styles.tombolBaru, { backgroundColor: t.primary }]}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.tombolBaruLabel}>Ajukan Lembur (SPL)</Text>
            </Pressable>
          ) : (
            <Kartu style={{ gap: 12 }}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Ajukan Lembur — {tgl(todayISO())}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Ladang label="Jam Mulai" wajib value={jamMulai} onChangeText={setJamMulai} placeholder="18:00" />
                </View>
                <View style={{ flex: 1 }}>
                  <Ladang label="Jam Selesai" wajib value={jamSelesai} onChangeText={setJamSelesai} placeholder="20:00" />
                </View>
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
              <Ladang label="Alasan Lembur" wajib multiline value={alasan} onChangeText={setAlasan} placeholder="Jelaskan alasan lembur..." />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Tombol label="Batal" varian="sekunder" onPress={() => setFormOpen(false)} full />
                </View>
                <View style={{ flex: 1 }}>
                  <Tombol label="Ajukan" onPress={simpan} loading={simpanProses} full />
                </View>
              </View>
            </Kartu>
          )}
        </View>
      }
      ListEmptyComponent={
        loading ? null : error ? (
          <KesalahanState pesan={error} onCoba={muat} />
        ) : (
          <KosongState judul="Belum ada pengajuan lembur" ikon="time-outline" />
        )
      }
      renderItem={({ item }) => (
        <Kartu style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{item.spl_no}</Text>
            <Lencana>{item.status}</Lencana>
          </View>
          <Text style={{ color: t.text, fontSize: 15 }}>{tgl(item.work_date)} · {num(item.hours, 2)} jam</Text>
          <Text style={{ color: t.textMuted, fontSize: 14 }}>{item.reason ?? '-'}</Text>
        </Kartu>
      )}
      ListFooterComponent={<View style={{ height: 24 }} />}
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
    </>
  )
}

// ============================= DINAS & BIAYA =============================
function TabDinas() {
  const t = useTheme()
  const router = useRouter()
  const { profile, employee } = useAuth()
  const [data, setData] = useState<BusinessTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const [tujuan, setTujuan] = useState('')
  const [transport, setTransport] = useState<Opsi | null>(null)
  const [transportVisible, setTransportVisible] = useState(false)
  const [durasiHari, setDurasiHari] = useState(3)
  const [uangHarian, setUangHarian] = useState('')
  const [totalUangMuka, setTotalUangMuka] = useState('')
  const [simpanProses, setSimpanProses] = useState(false)

  const muat = useCallback(async () => {
    if (!employee?.id) {
      setLoading(false)
      return
    }
    setError('')
    try {
      const rows = await list<BusinessTrip>('business_trips', { eq: { employee_id: employee.id }, order: { col: 'created_at', asc: false }, limit: 100 })
      setData(rows)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat perjalanan dinas.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [employee?.id])

  useFocusEffect(useCallback(() => { muat() }, [muat]))

  const simpan = async () => {
    if (!profile || !employee) return
    if (!tujuan.trim()) {
      Alert.alert('Tujuan wajib diisi', 'Isi tujuan/kota perjalanan dinas.')
      return
    }
    setSimpanProses(true)
    try {
      const mulai = todayISO()
      const akhir = new Date(Date.now() + (durasiHari - 1) * 86400000).toISOString().slice(0, 10)
      const sppdNo = await nextDocNo(profile.company_id, 'SPPD')
      const row = await insert('business_trips', {
        company_id: profile.company_id,
        sppd_no: sppdNo,
        employee_id: employee.id,
        purpose: tujuan.trim(),
        destination: tujuan.trim(),
        transport_type: transport?.value ?? null,
        start_date: mulai,
        end_date: akhir,
        daily_allowance: uangHarian ? Number(uangHarian) : 0,
        total_advance: totalUangMuka ? Number(totalUangMuka) : 0,
        status: 'diajukan',
        created_by: profile.id,
      })
      setData((prev) => [row as BusinessTrip, ...prev])
      setFormOpen(false)
      setTujuan('')
      setTransport(null)
      setUangHarian('')
      setTotalUangMuka('')
      Alert.alert('Berhasil', `Perjalanan dinas ${(row as any).sppd_no} berhasil diajukan.`)
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat mengajukan perjalanan dinas.')
    } finally {
      setSimpanProses(false)
    }
  }

  return (
    <>
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
      data={data}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          {!formOpen ? (
            <Pressable onPress={() => setFormOpen(true)} style={[styles.tombolBaru, { backgroundColor: t.primary }]}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.tombolBaruLabel}>Ajukan Perjalanan Dinas</Text>
            </Pressable>
          ) : (
            <Kartu style={{ gap: 12 }}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Ajukan Perjalanan Dinas (SPPD)</Text>
              <Ladang label="Tujuan / Kota" wajib value={tujuan} onChangeText={setTujuan} placeholder="mis. Site Bandung" />
              <View style={{ gap: 6 }}>
                <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>Moda Transportasi</Text>
                <Tombol
                  label={transport?.label ?? 'Pilih moda transportasi'}
                  varian="sekunder"
                  onPress={() => setTransportVisible(true)}
                  full
                  icon={<Ionicons name="chevron-down" size={16} color={t.primary} />}
                />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>Durasi</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[1, 2, 3, 5, 7].map((d) => (
                    <Pressable
                      key={d}
                      onPress={() => setDurasiHari(d)}
                      style={[styles.chip, { borderColor: durasiHari === d ? t.primary : t.border, backgroundColor: durasiHari === d ? t.primary : t.card }]}
                    >
                      <Text style={{ color: durasiHari === d ? '#FFFFFF' : t.text, fontWeight: '700', fontSize: 13 }}>{d} hari</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Ladang label="Uang Harian (opsional)" keyboardType="numeric" value={uangHarian} onChangeText={setUangHarian} placeholder="0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Ladang label="Uang Muka (opsional)" keyboardType="numeric" value={totalUangMuka} onChangeText={setTotalUangMuka} placeholder="0" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Tombol label="Batal" varian="sekunder" onPress={() => setFormOpen(false)} full />
                </View>
                <View style={{ flex: 1 }}>
                  <Tombol label="Ajukan" onPress={simpan} loading={simpanProses} full />
                </View>
              </View>
            </Kartu>
          )}
        </View>
      }
      ListEmptyComponent={
        loading ? null : error ? (
          <KesalahanState pesan={error} onCoba={muat} />
        ) : (
          <KosongState judul="Belum ada perjalanan dinas" ikon="airplane-outline" />
        )
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/pengajuan/dinas/${item.id}`)}>
          <Kartu style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{item.sppd_no}</Text>
              <Lencana>{item.status}</Lencana>
            </View>
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{item.destination ?? '-'}</Text>
            <Text style={{ color: t.textMuted, fontSize: 13 }}>{tgl(item.start_date)} — {tgl(item.end_date)}</Text>
          </Kartu>
        </Pressable>
      )}
      ListFooterComponent={<View style={{ height: 24 }} />}
    />
    <PilihOpsiModal
      visible={transportVisible}
      judul="Pilih Moda Transportasi"
      cariAktif={false}
      opsi={TRANSPORT_OPSI}
      onClose={() => setTransportVisible(false)}
      onPilih={(o) => {
        setTransport(o)
        setTransportVisible(false)
      }}
    />
    </>
  )
}

// ============================= KASBON =============================
function TabKasbon() {
  const t = useTheme()
  const { profile, employee } = useAuth()
  const [data, setData] = useState<EmployeeAdvance[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const [tujuan, setTujuan] = useState('')
  const [jumlah, setJumlah] = useState('')
  const [simpanProses, setSimpanProses] = useState(false)

  const muat = useCallback(async () => {
    if (!employee?.id) {
      setLoading(false)
      return
    }
    setError('')
    try {
      const rows = await list<EmployeeAdvance>('employee_advances', { eq: { employee_id: employee.id }, order: { col: 'created_at', asc: false }, limit: 100 })
      setData(rows)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat kasbon.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [employee?.id])

  useFocusEffect(useCallback(() => { muat() }, [muat]))

  const totalBelumLunas = data.reduce((s, d) => s + Math.max(0, Number(d.amount) - Number(d.settled_amount)), 0)

  const simpan = async () => {
    if (!profile || !employee) return
    const jml = Number(jumlah)
    if (!jumlah || isNaN(jml) || jml <= 0) {
      Alert.alert('Jumlah tidak valid', 'Masukkan nominal lebih dari 0.')
      return
    }
    if (!tujuan.trim()) {
      Alert.alert('Keperluan wajib diisi', 'Jelaskan keperluan kasbon.')
      return
    }
    setSimpanProses(true)
    try {
      const advanceNo = await nextDocNo(profile.company_id, 'KASBON')
      const row = await insert('employee_advances', {
        company_id: profile.company_id,
        advance_no: advanceNo,
        employee_id: employee.id,
        request_date: todayISO(),
        purpose: tujuan.trim(),
        amount: jml,
        settled_amount: 0,
        status: 'diajukan',
        created_by: profile.id,
      })
      setData((prev) => [row as EmployeeAdvance, ...prev])
      setFormOpen(false)
      setTujuan('')
      setJumlah('')
      Alert.alert('Berhasil', `Pengajuan kasbon ${(row as any).advance_no} berhasil diajukan.`)
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat mengajukan kasbon.')
    } finally {
      setSimpanProses(false)
    }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
      data={data}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          {data.length > 0 ? (
            <Kartu style={{ backgroundColor: t.dark, borderColor: t.dark }}>
              <Text style={{ color: '#C9DEE0', fontSize: 13 }}>Total Belum Lunas</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }}>{rupiah(totalBelumLunas)}</Text>
            </Kartu>
          ) : null}
          {!formOpen ? (
            <Pressable onPress={() => setFormOpen(true)} style={[styles.tombolBaru, { backgroundColor: t.primary }]}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.tombolBaruLabel}>Ajukan Kasbon</Text>
            </Pressable>
          ) : (
            <Kartu style={{ gap: 12 }}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Ajukan Kasbon</Text>
              <Ladang label="Keperluan" wajib value={tujuan} onChangeText={setTujuan} placeholder="mis. Kebutuhan mendesak keluarga" />
              <Ladang label="Jumlah (Rp)" wajib keyboardType="numeric" value={jumlah} onChangeText={setJumlah} placeholder="0" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Tombol label="Batal" varian="sekunder" onPress={() => setFormOpen(false)} full />
                </View>
                <View style={{ flex: 1 }}>
                  <Tombol label="Ajukan" onPress={simpan} loading={simpanProses} full />
                </View>
              </View>
            </Kartu>
          )}
        </View>
      }
      ListEmptyComponent={
        loading ? null : error ? (
          <KesalahanState pesan={error} onCoba={muat} />
        ) : (
          <KosongState judul="Belum ada pengajuan kasbon" ikon="wallet-outline" />
        )
      }
      renderItem={({ item }) => {
        const sisa = Math.max(0, Number(item.amount) - Number(item.settled_amount))
        return (
          <Kartu style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{item.advance_no}</Text>
              <Lencana>{item.status}</Lencana>
            </View>
            <Text style={{ color: t.text, fontSize: 15 }}>{item.purpose ?? '-'}</Text>
            <Text style={{ color: t.textMuted, fontSize: 14 }}>Diajukan {rupiah(item.amount)} · {tgl(item.request_date)}</Text>
            {sisa > 0 ? <Text style={{ color: t.bahaya, fontWeight: '700', fontSize: 14 }}>Sisa belum lunas: {rupiah(sisa)}</Text> : null}
          </Kartu>
        )
      }}
      ListFooterComponent={<View style={{ height: 24 }} />}
    />
  )
}

const TRANSPORT_OPSI: Opsi[] = [
  { value: 'darat', label: 'Darat (Mobil/Bus)' },
  { value: 'udara', label: 'Udara (Pesawat)' },
  { value: 'laut', label: 'Laut (Kapal)' },
  { value: 'kereta', label: 'Kereta Api' },
]

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', margin: 16, marginBottom: 0, borderRadius: RADIUS, borderWidth: 1, padding: 4, gap: 4 },
  tabItem: { flex: 1, paddingVertical: 10, borderRadius: RADIUS - 3, alignItems: 'center' },
  tabLabel: { fontSize: 14, fontWeight: '700' },
  tombolBaru: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: RADIUS },
  tombolBaruLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS, borderWidth: 1, minHeight: 44, justifyContent: 'center' },
})
