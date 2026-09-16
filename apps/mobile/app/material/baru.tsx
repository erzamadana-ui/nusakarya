import React, { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme, RADIUS } from '@/components/theme'
import Kartu from '@/components/Kartu'
import Tombol from '@/components/Tombol'
import Ladang from '@/components/Ladang'
import PilihItemModal from '@/components/PilihItemModal'
import { useAuth } from '@/lib/auth'
import supabase from '@/lib/supabase'
import { insert, list, nextDocNo } from '@/lib/db'
import { todayISO } from '@/lib/format'
import type { ItemCatalog } from '@/types/db'

type BarisItem = { item: ItemCatalog; qty: string }

export default function MaterialBaru() {
  const t = useTheme()
  const router = useRouter()
  const { profile } = useAuth()

  const [tujuan, setTujuan] = useState('')
  const [items, setItems] = useState<ItemCatalog[]>([])
  const [barisItem, setBarisItem] = useState<BarisItem[]>([])
  const [pilihVisible, setPilihVisible] = useState(false)
  const [pending, setPending] = useState<ItemCatalog | null>(null)
  const [qtyInput, setQtyInput] = useState('')
  const [simpanProses, setSimpanProses] = useState(false)
  const [error, setError] = useState('')

  const bukaPilih = async () => {
    if (!profile) return
    if (items.length === 0) {
      const rows = await list<ItemCatalog>('item_catalog', {
        eq: { company_id: profile.company_id, is_active: true },
        order: { col: 'name', asc: true },
        limit: 300,
      })
      setItems(rows)
    }
    setPilihVisible(true)
  }

  const tambahBaris = () => {
    if (!pending || !qtyInput || isNaN(Number(qtyInput)) || Number(qtyInput) <= 0) {
      Alert.alert('Qty tidak valid', 'Masukkan angka lebih dari 0.')
      return
    }
    setBarisItem((prev) => [...prev, { item: pending, qty: qtyInput }])
    setPending(null)
    setQtyInput('')
  }

  const simpan = async () => {
    if (!profile) return
    if (barisItem.length === 0) {
      setError('Tambahkan minimal satu item material.')
      return
    }
    setError('')
    setSimpanProses(true)
    try {
      const mrNo = await nextDocNo(profile.company_id, 'MR')
      const header = await insert('material_requests', {
        company_id: profile.company_id,
        mr_no: mrNo,
        request_date: todayISO(),
        requester_id: profile.id,
        purpose: tujuan.trim() || null,
        status: 'diajukan',
      })
      const rows = barisItem.map((b) => ({
        company_id: profile.company_id,
        mr_id: (header as any).id,
        item_id: b.item.id,
        qty_request: Number(b.qty),
        uom: b.item.uom,
      }))
      const { error: err } = await supabase.from('material_request_items').insert(rows)
      if (err) throw err
      Alert.alert('Berhasil', `Permintaan ${mrNo} berhasil diajukan.`)
      router.replace(`/material/${(header as any).id}`)
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menyimpan permintaan material.')
    } finally {
      setSimpanProses(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Kartu style={{ gap: 12 }}>
        <Text style={[styles.judul, { color: t.text }]}>Permintaan Material Baru</Text>
        <Ladang label="Tujuan / Keperluan" value={tujuan} onChangeText={setTujuan} placeholder="mis. Kebutuhan WO INS-0001" />
      </Kartu>

      <Kartu>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.judul, { color: t.text }]}>Item Material</Text>
          <Tombol label="Tambah Item" varian="sekunder" onPress={bukaPilih} />
        </View>
        {barisItem.length === 0 ? (
          <Text style={{ color: t.textMuted, marginTop: 8 }}>Belum ada item ditambahkan.</Text>
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            {barisItem.map((b, i) => (
              <View key={i} style={[styles.baris, { borderColor: t.border }]}>
                <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>{b.item.name}</Text>
                <Text style={{ color: t.textMuted }}>
                  {b.qty} {b.item.uom ?? ''}
                </Text>
              </View>
            ))}
          </View>
        )}
        {pending ? (
          <View style={[styles.baris, { borderColor: t.primary, marginTop: 10, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
            <Text style={{ color: t.text, fontWeight: '700' }}>
              {pending.name} ({pending.uom ?? '-'})
            </Text>
            <Ladang label="Qty" wajib keyboardType="numeric" value={qtyInput} onChangeText={setQtyInput} placeholder="0" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Tombol label="Batal" varian="sekunder" onPress={() => setPending(null)} full />
              </View>
              <View style={{ flex: 1 }}>
                <Tombol label="Tambahkan" onPress={tambahBaris} full />
              </View>
            </View>
          </View>
        ) : null}
      </Kartu>

      {error ? <Text style={{ color: t.bahaya, paddingHorizontal: 4 }}>{error}</Text> : null}
      <Tombol label="Ajukan Permintaan" onPress={simpan} loading={simpanProses} full />

      <PilihItemModal
        visible={pilihVisible}
        items={items}
        onClose={() => setPilihVisible(false)}
        onPilih={(item) => {
          setPilihVisible(false)
          setPending(item)
          setQtyInput('')
        }}
      />
      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  judul: { fontSize: 16, fontWeight: '700' },
  baris: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: RADIUS, padding: 10 },
})
