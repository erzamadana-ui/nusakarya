import React, { useCallback, useState } from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import Lencana from '@/components/Lencana'
import KosongState from '@/components/KosongState'
import { ROLE_LABEL, useAuth } from '@/lib/auth'
import { list } from '@/lib/db'
import { inisial, num, periodCode, pctBulan, tgl } from '@/lib/format'
import type { EmployeeCertification, ProductivityRow } from '@/types/db'

export default function Profil() {
  const t = useTheme()
  const { profile, employee, company, signOut } = useAuth()
  const [produktivitas, setProduktivitas] = useState<ProductivityRow | null>(null)
  const [sertifikasi, setSertifikasi] = useState<EmployeeCertification[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const muat = useCallback(async () => {
    if (!employee?.id) return
    try {
      const [prod, sert] = await Promise.all([
        list<ProductivityRow>('v_dashboard_productivity', { eq: { employee_id: employee.id, period_code: periodCode() } }),
        list<EmployeeCertification>('employee_certifications', { eq: { employee_id: employee.id }, order: { col: 'expiry_date', asc: true } }),
      ])
      setProduktivitas(prod[0] ?? null)
      setSertifikasi(sert)
    } finally {
      setRefreshing(false)
    }
  }, [employee?.id])

  useFocusEffect(
    useCallback(() => {
      muat()
    }, [muat])
  )

  const keluar = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar dari aplikasi?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => signOut() },
    ])
  }

  const statusSertifikat = (c: EmployeeCertification) => {
    if (!c.expiry_date) return 'aktif'
    const sisaHari = (new Date(c.expiry_date).getTime() - Date.now()) / 86400000
    if (sisaHari < 0) return 'kedaluwarsa'
    if (sisaHari <= 60) return 'segera berakhir'
    return 'aktif'
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); muat() }} tintColor={t.primary} />}
    >
      <Kartu style={{ alignItems: 'center', paddingVertical: 24 }}>
        <View style={[styles.avatar, { backgroundColor: t.primary }]}>
          <Text style={styles.avatarTxt}>{inisial(profile?.full_name)}</Text>
        </View>
        <Text style={[styles.nama, { color: t.text }]}>{profile?.full_name ?? '-'}</Text>
        <Text style={{ color: t.textMuted, fontSize: 15, marginTop: 2 }}>{ROLE_LABEL[profile?.role ?? ''] ?? profile?.role}</Text>
        <View style={{ marginTop: 8 }}>
          <Lencana>{employee?.status ?? 'aktif'}</Lencana>
        </View>
      </Kartu>

      <Kartu>
        <Text style={[styles.judul, { color: t.text }]}>Data Diri</Text>
        <View style={{ gap: 10, marginTop: 10 }}>
          <Baris t={t} label="NIP" value={employee?.nip ?? '-'} />
          <Baris t={t} label="Jabatan" value={employee?.position ?? '-'} />
          <Baris t={t} label="Unit" value={employee?.unit ?? profile?.unit ?? '-'} />
          <Baris t={t} label="Telepon" value={profile?.phone ?? employee?.phone ?? '-'} />
          <Baris t={t} label="Email" value={profile?.email ?? employee?.email ?? '-'} />
          <Baris t={t} label="Perusahaan" value={company?.name ?? '-'} />
        </View>
      </Kartu>

      <Kartu>
        <Text style={[styles.judul, { color: t.text }]}>Poin & Pencapaian Bulan Ini</Text>
        {produktivitas ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Text style={{ color: t.textMuted, fontSize: 15 }}>
              {num(produktivitas.total_points)} dari target {num(produktivitas.target_points)} poin
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: t.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: t.primary, width: `${Math.min(100, produktivitas.achievement_percent ?? 0)}%` },
                ]}
              />
            </View>
            <Text style={{ color: t.primary, fontWeight: '800', fontSize: 15 }}>{pctBulan(produktivitas.achievement_percent)} tercapai</Text>
          </View>
        ) : (
          <Text style={{ color: t.textMuted, marginTop: 8 }}>Belum ada data produktivitas bulan ini.</Text>
        )}
      </Kartu>

      <Kartu>
        <Text style={[styles.judul, { color: t.text }]}>Sertifikasi</Text>
        {sertifikasi.length === 0 ? (
          <KosongState judul="Belum ada sertifikasi" ikon="ribbon-outline" />
        ) : (
          <View style={{ gap: 10, marginTop: 10 }}>
            {sertifikasi.map((c) => {
              const st = statusSertifikat(c)
              return (
                <View key={c.id} style={[styles.sertifikatBox, { borderColor: t.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: t.text, fontWeight: '700', flex: 1 }}>{c.cert_name}</Text>
                    <Lencana>{st}</Lencana>
                  </View>
                  <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 4 }}>
                    {c.issuer ?? '-'} · Berlaku s.d. {tgl(c.expiry_date)}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </Kartu>

      <Tombol label="Keluar" varian="bahaya" onPress={keluar} full />
      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

function Baris({ t, label, value }: { t: ReturnType<typeof useTheme>; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ color: t.textMuted, fontSize: 14, width: 100 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 14, flex: 1, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  nama: { fontSize: 19, fontWeight: '800', marginTop: 12 },
  judul: { fontSize: 16, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999 },
  sertifikatBox: { borderWidth: 1, borderRadius: RADIUS, padding: 12 },
})
